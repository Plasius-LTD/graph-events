import type { CacheEnvelope, CacheStore, DomainEvent, TelemetrySink, Version } from "@plasius/graph-contracts";
import { DEFAULT_SCHEMA_VERSION } from "@plasius/graph-contracts";

export interface ProcessedEventStore {
  has(eventId: string): Promise<boolean>;
  mark(eventId: string, ttlSeconds: number): Promise<void>;
}

export class InMemoryProcessedEventStore implements ProcessedEventStore {
  private readonly store = new Map<string, number>();
  private readonly now: () => number;

  public constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  public async has(eventId: string): Promise<boolean> {
    const expiresAt = this.store.get(eventId);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= this.now()) {
      this.store.delete(eventId);
      return false;
    }

    return true;
  }

  public async mark(eventId: string, ttlSeconds: number): Promise<void> {
    this.store.set(eventId, this.now() + ttlSeconds * 1000);
  }
}

export interface GraphEventProcessorOptions {
  cacheStore: CacheStore;
  processedStore?: ProcessedEventStore;
  telemetry?: TelemetrySink;
  now?: () => number;
  processedEventTtlSeconds?: number;
  cacheTtlSeconds?: number;
  supportedSchemaVersions?: string[];
}

export interface GraphEventProcessResult {
  skipped: boolean;
  action: "invalidated" | "hydrated" | "none";
  reason?: "already_processed" | "unsupported_schema" | "out_of_order";
}

export class GraphEventProcessor {
  private readonly cacheStore: CacheStore;
  private readonly processedStore: ProcessedEventStore;
  private readonly telemetry?: TelemetrySink;
  private readonly now: () => number;
  private readonly processedEventTtlSeconds: number;
  private readonly cacheTtlSeconds: number;
  private readonly supportedSchemaVersions: ReadonlySet<string>;

  public constructor(options: GraphEventProcessorOptions) {
    this.cacheStore = options.cacheStore;
    this.processedStore = options.processedStore ?? new InMemoryProcessedEventStore(options.now);
    this.telemetry = options.telemetry;
    this.now = options.now ?? (() => Date.now());
    this.processedEventTtlSeconds = options.processedEventTtlSeconds ?? 24 * 60 * 60;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 300;
    this.supportedSchemaVersions = new Set(options.supportedSchemaVersions ?? [DEFAULT_SCHEMA_VERSION]);
  }

  public async process(event: DomainEvent): Promise<GraphEventProcessResult> {
    this.telemetry?.metric({
      name: "graph.events.lag_ms",
      value: Math.max(0, this.now() - event.occurredAtEpochMs),
      unit: "ms",
      tags: {
        type: event.type,
      },
    });

    if (await this.processedStore.has(event.id)) {
      const skippedResult: GraphEventProcessResult = { skipped: true, action: "none", reason: "already_processed" };
      this.recordProcessedMetric(event, skippedResult);
      return skippedResult;
    }

    if (!this.supportedSchemaVersions.has(event.schemaVersion)) {
      const skippedResult: GraphEventProcessResult = { skipped: true, action: "none", reason: "unsupported_schema" };
      this.recordProcessedMetric(event, skippedResult);
      return skippedResult;
    }

    try {
      if (event.type.endsWith("deleted")) {
        const keys = this.keysForEvent(event);
        await this.cacheStore.invalidate(keys);
        const result: GraphEventProcessResult = { skipped: false, action: "invalidated" };
        this.recordProcessedMetric(event, result);
        return result;
      }

      const targetKey = this.primaryKeyForEvent(event);
      const existing = await this.cacheStore.get<Record<string, unknown>>(targetKey);
      if (existing && this.isIncomingVersionOlder(existing.version, event.version)) {
        const skippedResult: GraphEventProcessResult = { skipped: true, action: "none", reason: "out_of_order" };
        this.recordProcessedMetric(event, skippedResult);
        return skippedResult;
      }

      const data = event.payload.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        await this.cacheStore.invalidate(this.keysForEvent(event));
        const result: GraphEventProcessResult = { skipped: false, action: "invalidated" };
        this.recordProcessedMetric(event, result);
        return result;
      }

      const envelope: CacheEnvelope<Record<string, unknown>> = {
        key: targetKey,
        value: data as Record<string, unknown>,
        fetchedAtEpochMs: this.now(),
        policy: {
          softTtlSeconds: Math.max(1, Math.floor(this.cacheTtlSeconds / 5)),
          hardTtlSeconds: this.cacheTtlSeconds,
        },
        version: event.version,
        schemaVersion: event.schemaVersion,
        source: event.source,
        tags: event.tags,
      };

      await this.cacheStore.compareAndSet(targetKey, envelope, undefined, {
        ttlSeconds: this.cacheTtlSeconds,
      });

      const result: GraphEventProcessResult = { skipped: false, action: "hydrated" };
      this.recordProcessedMetric(event, result);
      return result;
    } catch (error) {
      this.telemetry?.metric({
        name: "graph.events.failure",
        value: 1,
        unit: "count",
        tags: {
          type: event.type,
        },
      });
      this.telemetry?.error({
        message: error instanceof Error ? error.message : "event processing failure",
        source: "graph-events",
        code: "EVENT_PROCESSING_FAILED",
        tags: {
          eventType: event.type,
          schemaVersion: event.schemaVersion,
        },
      });
      throw error;
    } finally {
      await this.processedStore.mark(event.id, this.processedEventTtlSeconds);
    }
  }

  public async processBatch(events: DomainEvent[]): Promise<GraphEventProcessResult[]> {
    const results: GraphEventProcessResult[] = [];
    for (const event of events) {
      results.push(await this.process(event));
    }

    return results;
  }

  private keysForEvent(event: DomainEvent): string[] {
    const keys = new Set<string>([event.aggregateKey]);
    if (event.entityKey) {
      keys.add(event.entityKey);
    }

    return Array.from(keys);
  }

  private primaryKeyForEvent(event: DomainEvent): string {
    return event.entityKey ?? event.aggregateKey;
  }

  private recordProcessedMetric(event: DomainEvent, result: GraphEventProcessResult): void {
    this.telemetry?.metric({
      name: "graph.events.processed",
      value: 1,
      unit: "count",
      tags: {
        type: event.type,
        action: result.action,
        skipped: result.skipped ? "true" : "false",
        reason: result.reason ?? "none",
      },
    });
  }

  private isIncomingVersionOlder(existingVersion: Version, incomingVersion: Version): boolean {
    if (typeof existingVersion === "number" && typeof incomingVersion === "number") {
      return incomingVersion < existingVersion;
    }

    return String(incomingVersion) < String(existingVersion);
  }
}
