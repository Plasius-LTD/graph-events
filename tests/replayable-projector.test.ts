import { describe, expect, it } from "vitest";

import {
  InMemoryProjectorCheckpointStore,
  ReplayableProjector,
} from "../src/index.js";

type TestEvent = {
  readonly streamId: string;
  readonly eventId: string;
  readonly version: number;
};

describe("ReplayableProjector", () => {
  it("skips already applied versions and replays only new events", async () => {
    const checkpointStore = new InMemoryProjectorCheckpointStore();
    await checkpointStore.setCheckpoint({
      streamId: "world:stream",
      lastEventId: "evt-2",
      lastEventVersion: 2,
      processedEventCount: 1,
      lastUpdatedEpochMs: 10,
    });

    const seen: string[] = [];

    const projector = new ReplayableProjector(
      async (event) => {
        seen.push(event.eventId);
      },
      {
        streamId: "world:stream",
        checkpointStore,
      },
    );

    const result = await projector.processBatch([
      { streamId: "world:stream", eventId: "evt-1", version: 1 },
      { streamId: "world:stream", eventId: "evt-2", version: 2 },
      { streamId: "world:stream", eventId: "evt-3", version: 3 },
    ]);

    expect(seen).toEqual(["evt-3"]);
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(2);

    await expect(checkpointStore.getCheckpoint("world:stream")).resolves.toMatchObject({
      lastEventId: "evt-3",
      lastEventVersion: 3,
      processedEventCount: 2,
    });
  });

  it("supports duplicate event ids as idempotent no-ops", async () => {
    const checkpointStore = new InMemoryProjectorCheckpointStore();

    const seen: string[] = [];
    const projector = new ReplayableProjector(
      async (event) => {
        seen.push(event.eventId);
      },
      {
        streamId: "stream-batch",
        checkpointStore,
      },
    );

    const result = await projector.processBatch([
      { streamId: "stream-batch", eventId: "evt-1", version: 1 },
      { streamId: "stream-batch", eventId: "evt-1", version: 1 },
      { streamId: "stream-batch", eventId: "evt-2", version: 2 },
    ]);

    expect(seen).toEqual(["evt-1", "evt-2"]);
    expect(result.processed).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it("updates checkpoint after each event with monotonic versions", async () => {
    const checkpointStore = new InMemoryProjectorCheckpointStore();
    const projector = new ReplayableProjector<TestEvent>(
      async () => {
        /* no-op */
      },
      {
        streamId: "stream-batch",
        checkpointStore,
      },
    );

    await projector.processBatch([
      { streamId: "stream-batch", eventId: "evt-1", version: 1 },
      { streamId: "stream-batch", eventId: "evt-2", version: 2 },
    ]);

    const final = await checkpointStore.getCheckpoint("stream-batch");
    expect(final).toMatchObject({
      lastEventId: "evt-2",
      lastEventVersion: 2,
      processedEventCount: 2,
    });
  });

  it("rejects stream mismatch during batch processing", async () => {
    const checkpointStore = new InMemoryProjectorCheckpointStore();
    const projector = new ReplayableProjector(
      async () => {
        /* no-op */
      },
      {
        streamId: "stream-1",
        checkpointStore,
      },
    );

    await expect(
      projector.processBatch([
        { streamId: "stream-1", eventId: "evt-1", version: 1 },
        { streamId: "stream-2", eventId: "evt-2", version: 2 },
      ]),
    ).rejects.toThrow("stream mismatch");
  });
});
