import type { TelemetrySink, Version } from "@plasius/graph-contracts";

export interface ProjectedEvent {
  readonly streamId: string;
  readonly eventId: string;
  readonly version: Version;
}

export interface GraphProjectorCheckpoint {
  readonly streamId: string;
  readonly lastEventId: string;
  readonly lastEventVersion: Version;
  readonly processedEventCount: number;
  readonly lastUpdatedEpochMs: number;
}

export interface ProjectorCheckpointStore {
  getCheckpoint(streamId: string): Promise<GraphProjectorCheckpoint | null>;
  setCheckpoint(checkpoint: GraphProjectorCheckpoint): Promise<void>;
}

export interface ReplayableProjectorResult {
  readonly processed: number;
  readonly skipped: number;
  readonly finalCheckpoint: GraphProjectorCheckpoint | null;
}

export interface ReplayableProjectorOptions {
  readonly streamId: string;
  readonly checkpointStore: ProjectorCheckpointStore;
  readonly now?: () => number;
  readonly telemetry?: TelemetrySink;
}

export class InMemoryProjectorCheckpointStore implements ProjectorCheckpointStore {
  private readonly store = new Map<string, GraphProjectorCheckpoint>();

  public async getCheckpoint(streamId: string): Promise<GraphProjectorCheckpoint | null> {
    return this.store.get(streamId) ?? null;
  }

  public async setCheckpoint(checkpoint: GraphProjectorCheckpoint): Promise<void> {
    this.store.set(checkpoint.streamId, checkpoint);
  }
}

export interface ReplayableProjectorProjector<TEvent extends ProjectedEvent> {
  (event: TEvent, checkpoint: GraphProjectorCheckpoint | null): Promise<void>;
}

function compareVersions(a: Version, b: Version): number {
  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const normalizedA = String(a);
  const normalizedB = String(b);

  return normalizedA < normalizedB ? -1 : normalizedA > normalizedB ? 1 : 0;
}

export class ReplayableProjector<TEvent extends ProjectedEvent> {
  private readonly now: () => number;
  private readonly streamId: string;
  private readonly checkpointStore: ProjectorCheckpointStore;
  private readonly telemetry?: TelemetrySink;

  public constructor(
    private readonly projector: ReplayableProjectorProjector<TEvent>,
    private readonly options: ReplayableProjectorOptions,
  ) {
    this.now = options.now ?? (() => Date.now());
    this.streamId = options.streamId;
    this.checkpointStore = options.checkpointStore;
    this.telemetry = options.telemetry;
  }

  public async processBatch(events: readonly TEvent[]): Promise<ReplayableProjectorResult> {
    const checkpoint = await this.checkpointStore.getCheckpoint(this.streamId);
    let lastCheckpoint = checkpoint;
    let processed = 0;
    let skipped = 0;

    for (const event of events) {
      if (event.streamId !== this.streamId) {
        throw new Error(`stream mismatch: expected=${this.streamId} actual=${event.streamId}`);
      }

      if (!lastCheckpoint) {
        await this.apply(event, lastCheckpoint);
        lastCheckpoint = this.makeCheckpoint(event, 1);
        await this.checkpointStore.setCheckpoint(lastCheckpoint);
        processed += 1;
        this.recordMetric("processed", event);
        continue;
      }

      if (this.isEventReplaySafe(lastCheckpoint, event)) {
        await this.apply(event, lastCheckpoint);
        const processedEventCount = lastCheckpoint.processedEventCount + 1;
        lastCheckpoint = this.makeCheckpoint(event, processedEventCount);
        await this.checkpointStore.setCheckpoint(lastCheckpoint);
        processed += 1;
        this.recordMetric("processed", event);
      } else {
        skipped += 1;
        this.recordMetric("skipped", event);
      }
    }

    return {
      processed,
      skipped,
      finalCheckpoint: lastCheckpoint,
    };
  }

  private isEventReplaySafe(checkpoint: GraphProjectorCheckpoint, event: TEvent): boolean {
    if (event.version === checkpoint.lastEventVersion && event.eventId === checkpoint.lastEventId) {
      return false;
    }

    return compareVersions(event.version, checkpoint.lastEventVersion) > 0;
  }

  private async apply(event: TEvent, checkpoint: GraphProjectorCheckpoint | null): Promise<void> {
    await this.projector(event, checkpoint);
  }

  private makeCheckpoint(event: TEvent, processedEventCount: number): GraphProjectorCheckpoint {
    return {
      streamId: this.streamId,
      lastEventId: event.eventId,
      lastEventVersion: event.version,
      processedEventCount,
      lastUpdatedEpochMs: this.now(),
    };
  }

  private recordMetric(action: "processed" | "skipped", event: TEvent): void {
    this.telemetry?.metric({
      name: "graph.projector.replay",
      value: 1,
      unit: "count",
      tags: {
        action,
        streamId: event.streamId,
      },
    });
  }
}
