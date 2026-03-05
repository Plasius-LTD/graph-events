import type { CacheEnvelope, CacheStore, DomainEvent } from "@plasius/graph-contracts";

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
  now?: () => number;
  processedEventTtlSeconds?: number;
  cacheTtlSeconds?: number;
}

export interface GraphEventProcessResult {
  skipped: boolean;
  action: "invalidated" | "hydrated" | "none";
}

export class GraphEventProcessor {
  private readonly cacheStore: CacheStore;
  private readonly processedStore: ProcessedEventStore;
  private readonly now: () => number;
  private readonly processedEventTtlSeconds: number;
  private readonly cacheTtlSeconds: number;

  public constructor(options: GraphEventProcessorOptions) {
    this.cacheStore = options.cacheStore;
    this.processedStore = options.processedStore ?? new InMemoryProcessedEventStore(options.now);
    this.now = options.now ?? (() => Date.now());
    this.processedEventTtlSeconds = options.processedEventTtlSeconds ?? 24 * 60 * 60;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 300;
  }

  public async process(event: DomainEvent): Promise<GraphEventProcessResult> {
    if (await this.processedStore.has(event.id)) {
      return { skipped: true, action: "none" };
    }

    try {
      if (event.type.endsWith("deleted")) {
        const keys = this.keysForEvent(event);
        await this.cacheStore.invalidate(keys);
        return { skipped: false, action: "invalidated" };
      }

      const targetKey = this.primaryKeyForEvent(event);
      const data = event.payload.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        await this.cacheStore.invalidate(this.keysForEvent(event));
        return { skipped: false, action: "invalidated" };
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

      return { skipped: false, action: "hydrated" };
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
}
