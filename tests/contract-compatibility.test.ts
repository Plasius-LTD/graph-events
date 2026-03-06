import { isDomainEvent, type CacheEnvelope, type CacheStore } from "@plasius/graph-contracts";
import { describe, expect, it } from "vitest";

import { GraphEventProcessor } from "../src/event-processor.js";

class InMemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEnvelope<unknown>>();

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

describe("event contract compatibility", () => {
  it("accepts valid domain event envelopes from graph-contracts", () => {
    expect(
      isDomainEvent({
        id: "evt_contract",
        type: "graph.entity.updated",
        occurredAtEpochMs: 1,
        aggregateKey: "agg:1",
        entityKey: "entity:1",
        version: 1,
        payload: { data: { id: 1 } },
        tags: ["entity"],
        schemaVersion: "1",
        source: "event-source",
      }),
    ).toBe(true);
  });

  it("hydrates cache envelopes preserving incoming schema version", async () => {
    const cache = new InMemoryCacheStore();
    const processor = new GraphEventProcessor({ cacheStore: cache });

    await processor.process({
      id: "evt_contract_hydrate",
      type: "graph.entity.updated",
      occurredAtEpochMs: 2,
      aggregateKey: "agg:2",
      entityKey: "entity:2",
      version: 2,
      payload: { data: { id: 2 } },
      tags: ["entity"],
      schemaVersion: "1",
      source: "event-source",
    });

    const cached = await cache.get<{ id: number }>("entity:2");
    expect(cached?.schemaVersion).toBe("1");
    expect(cached?.value).toEqual({ id: 2 });
  });

  it("rejects unsupported schema versions via processor compatibility guard", async () => {
    const cache = new InMemoryCacheStore();
    const processor = new GraphEventProcessor({
      cacheStore: cache,
      supportedSchemaVersions: ["1"],
    });

    const result = await processor.process({
      id: "evt_contract_unsupported",
      type: "graph.entity.updated",
      occurredAtEpochMs: 3,
      aggregateKey: "agg:3",
      entityKey: "entity:3",
      version: 3,
      payload: { data: { id: 3 } },
      tags: ["entity"],
      schemaVersion: "2",
      source: "event-source",
    });

    expect(result).toEqual({
      skipped: true,
      action: "none",
      reason: "unsupported_schema",
    });
    expect(await cache.get("entity:3")).toBeNull();
  });
});
