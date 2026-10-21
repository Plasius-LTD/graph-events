# @plasius/graph-events

[![npm version](https://img.shields.io/npm/v/@plasius/graph-events.svg)](https://www.npmjs.com/package/@plasius/graph-events)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/graph-events/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/graph-events/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/graph-events)](https://codecov.io/gh/Plasius-LTD/graph-events)
[![License](https://img.shields.io/github/license/Plasius-LTD/graph-events)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Event-driven cache invalidation and hydration pipeline for graph data.

Apache-2.0. ESM + CJS builds. TypeScript types included.

---

## Requirements

- Node.js 24+ (matches `.nvmrc` and CI/CD)
- `@plasius/graph-contracts`

---

## Installation

```bash
npm install @plasius/graph-events
```

---

## Exports

```ts
import {
  GraphEventProcessor,
  InMemoryProcessedEventStore,
  type GraphEventProcessorOptions,
  type GraphEventProcessResult,
  type ProcessedEventStore,
  type ProjectedEvent,
  type GraphProjectorCheckpoint,
  ReplayableProjector,
  InMemoryProjectorCheckpointStore,
} from "@plasius/graph-events";
```

---

## Quick Start

```ts
import { GraphEventProcessor } from "@plasius/graph-events";

const processor = new GraphEventProcessor({ cacheStore });

await processor.process({
  id: "evt_1",
  type: "graph.entity.updated",
  occurredAtEpochMs: Date.now(),
  aggregateKey: "user:1",
  entityKey: "user:1",
  version: 2,
  payload: { data: { id: 1, name: "Alice" } },
  tags: ["user"],
  schemaVersion: "1",
  source: "user-service",
});
```

### Replayable checkpointing for downstream projections

```ts
import { InMemoryProjectorCheckpointStore, ReplayableProjector } from "@plasius/graph-events";

const checkpointStore = new InMemoryProjectorCheckpointStore();
const projector = new ReplayableProjector(
  async (event, _checkpoint) => {
    // apply event into a projection or materialized view
  },
  {
    streamId: "world-events:stream",
    checkpointStore,
  },
);

await projector.processBatch([
  { streamId: "world-events:stream", eventId: "evt-1", version: 1 },
  { streamId: "world-events:stream", eventId: "evt-2", version: 2 },
]);
```

---

## Development

```bash
npm run clean
npm install
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

---

## Processing Guarantees

- Idempotency/replay: processed event store prevents duplicate handling.
- Version ordering guard: older versions are skipped to prevent cache rollback.
- Schema compatibility guard: `supportedSchemaVersions` controls accepted envelope versions.
- Telemetry:
  - `graph.events.lag_ms`
  - `graph.events.processed`
  - `graph.events.failure`
- Replayable projection checkpoints:
  - resume safely from checkpointed stream state
  - skip stale versions and duplicate event ids at checkpoint level
  - enforce stream correctness per batch input

Missed events rely on cache TTL fallback strategy (cross-package ADR 0021).

---

## Architecture

- Package ADRs: [`docs/adrs`](./docs/adrs)
- Cross-package ADRs: `plasius-ltd-site/docs/adrs/adr-0020` to `adr-0024`

---

## License

Licensed under the [Apache-2.0 License](./LICENSE).

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using exact, case-normalised path checks. Both CI jobs use the literal
`Public CI - Quarantined` group and `[self-hosted, Linux, X64]` labels for trusted
repository pushes only. Fork and PR events cannot schedule self-hosted work.
The group independently restricts repositories and workflow refs; a reviewed
maintainer branch needs a temporary explicit workflow admission, removed after
delivery. Missing capacity fails closed with no hosted fallback. Checkout does
not persist credentials, package-manager cache finalization stays disabled,
and ordinary `npm ci` retains the committed lockfile. Bounded jobs preserve
lint, types, runtime audit, build, 80% line coverage and final pack checks.
Publication uses the GitHub-hosted `production` job with Node 24 and a pinned
npm 11.6.2 client. It is token-free and proceeds only while the prepared SHA
is the exact `main` head after successful push-triggered CI. Do not dispatch CD
until the npm trusted-publisher binding is verified. Use the approved two-phase
`cd.yml` prepare/publish path on `main` with a fresh version; verify exact-main
CI, immutable registry bytes/provenance and the GitHub release before completion.

Feature `platform.public-artifact-integrity.enabled` governs staged public
restoration. Enabled permits verified restoration; disabled pauses restoration;
rollback disables the affected workflow/channel or removes its admission.
Mandatory source/package admission remains enforced in all three states.
No local override or capability is introduced. Never restore the prohibited
administrative path during rollback. See [ADR-0006](docs/adrs/adr-0006-quarantined-push-ci.md).
<!-- END PLASIUS RELEASE INTEGRITY -->
