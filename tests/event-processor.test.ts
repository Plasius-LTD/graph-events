import { describe, expect, it } from "vitest";

import type { CacheEnvelope, CacheStore } from "@plasius/graph-contracts";
import { GraphEventProcessor, InMemoryProcessedEventStore } from "../src/event-processor.js";

class FakeCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEnvelope<unknown>>();
  public readonly invalidations: string[][] = [];

  async get<T>(key: string): Promise<CacheEnvelope<T> | null> {
    return (this.map.get(key) as CacheEnvelope<T> | undefined) ?? null;
  }

  async mget<T>(keys: string[]): Promise<Array<CacheEnvelope<T> | null>> {
    return keys.map((key) => (this.map.get(key) as CacheEnvelope<T> | undefined) ?? null);
  }

  async set<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    this.map.set(key, envelope as CacheEnvelope<unknown>);
  }

  async mset<T>(entries: Array<{ key: string; envelope: CacheEnvelope<T> }>): Promise<void> {
    for (const entry of entries) {
      this.map.set(entry.key, entry.envelope as CacheEnvelope<unknown>);
    }
  }

  async invalidate(keys: string[]): Promise<number> {
    this.invalidations.push([...keys]);
    let removed = 0;
    for (const key of keys) {
      if (this.map.delete(key)) {
        removed += 1;
      }
    }

    return removed;
  }

  async compareAndSet<T>(
    key: string,
    nextEnvelope: CacheEnvelope<T>,
    _expectedVersion?: string | number,
  ): Promise<boolean> {
    this.map.set(key, nextEnvelope as CacheEnvelope<unknown>);
    return true;
  }
}

describe("GraphEventProcessor", () => {
  it("hydrates cache on update event", async () => {
    const cache = new FakeCacheStore();
    const processor = new GraphEventProcessor({
      cacheStore: cache,
      processedStore: new InMemoryProcessedEventStore(),
    });

    const result = await processor.process({
      id: "evt_1",
      type: "graph.entity.updated",
      occurredAtEpochMs: 1,
      aggregateKey: "agg:1",
      entityKey: "entity:1",
      version: 2,
      payload: {
        data: {
          value: 5,
        },
      },
      tags: ["entity"],
      schemaVersion: "1",
      source: "event-source",
    });

    const cached = await cache.get<{ value: number }>("entity:1");

    expect(result.action).toBe("hydrated");
    expect(cached?.value).toEqual({ value: 5 });
  });

  it("invalidates keys on delete event", async () => {
    const cache = new FakeCacheStore();
    await cache.set("agg:1", {
      key: "agg:1",
      value: { ok: true },
      fetchedAtEpochMs: 1,
      policy: { softTtlSeconds: 10, hardTtlSeconds: 30 },
      version: 1,
      schemaVersion: "1",
      source: "test",
      tags: ["agg"],
    });

    const processor = new GraphEventProcessor({ cacheStore: cache });
    const result = await processor.process({
      id: "evt_2",
      type: "graph.aggregate.deleted",
      occurredAtEpochMs: 2,
      aggregateKey: "agg:1",
      version: 2,
      payload: {},
      tags: ["agg"],
      schemaVersion: "1",
      source: "event-source",
    });

    expect(result.action).toBe("invalidated");
    expect(await cache.get("agg:1")).toBeNull();
  });

  it("skips already processed events", async () => {
    const store = new InMemoryProcessedEventStore();
    await store.mark("evt_3", 60);

    const processor = new GraphEventProcessor({
      cacheStore: new FakeCacheStore(),
      processedStore: store,
    });

    const result = await processor.process({
      id: "evt_3",
      type: "graph.entity.updated",
      occurredAtEpochMs: 3,
      aggregateKey: "agg:1",
      version: 3,
      payload: {
        data: { x: 1 },
      },
      tags: ["agg"],
      schemaVersion: "1",
      source: "event-source",
    });

    expect(result.skipped).toBe(true);
  });

  it("invalidates aggregate and entity keys for malformed update payloads", async () => {
    const cache = new FakeCacheStore();
    await cache.set("agg:4", {
      key: "agg:4",
      value: { ok: true },
      fetchedAtEpochMs: 1,
      policy: { softTtlSeconds: 10, hardTtlSeconds: 30 },
      version: 1,
      schemaVersion: "1",
      source: "test",
      tags: ["agg"],
    });
    await cache.set("entity:4", {
      key: "entity:4",
      value: { ok: true },
      fetchedAtEpochMs: 1,
      policy: { softTtlSeconds: 10, hardTtlSeconds: 30 },
      version: 1,
      schemaVersion: "1",
      source: "test",
      tags: ["entity"],
    });

    const processor = new GraphEventProcessor({ cacheStore: cache });
    const result = await processor.process({
      id: "evt_4",
      type: "graph.entity.updated",
      occurredAtEpochMs: 4,
      aggregateKey: "agg:4",
      entityKey: "entity:4",
      version: 4,
      payload: {
        data: ["not-an-object"],
      },
      tags: ["entity"],
      schemaVersion: "1",
      source: "event-source",
    });

    expect(result.action).toBe("invalidated");
    expect(cache.invalidations.at(-1)).toEqual(["agg:4", "entity:4"]);
    expect(await cache.get("agg:4")).toBeNull();
    expect(await cache.get("entity:4")).toBeNull();
  });

  it("processes event batches", async () => {
    const cache = new FakeCacheStore();
    const processor = new GraphEventProcessor({ cacheStore: cache });

    const results = await processor.processBatch([
      {
        id: "evt_5",
        type: "graph.entity.updated",
        occurredAtEpochMs: 5,
        aggregateKey: "agg:5",
        entityKey: "entity:5",
        version: 5,
        payload: { data: { value: 1 } },
        tags: ["entity"],
        schemaVersion: "1",
        source: "event-source",
      },
      {
        id: "evt_6",
        type: "graph.entity.deleted",
        occurredAtEpochMs: 6,
        aggregateKey: "agg:5",
        entityKey: "entity:5",
        version: 6,
        payload: {},
        tags: ["entity"],
        schemaVersion: "1",
        source: "event-source",
      },
    ]);

    expect(results).toEqual([
      { skipped: false, action: "hydrated" },
      { skipped: false, action: "invalidated" },
    ]);
  });
});
