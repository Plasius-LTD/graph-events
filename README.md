# @plasius/graph-events

[![npm version](https://img.shields.io/npm/v/@plasius/graph-events.svg)](https://www.npmjs.com/package/@plasius/graph-events)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/graph-events/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/graph-events/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/graph-events)](https://codecov.io/gh/Plasius-LTD/graph-events)
[![License](https://img.shields.io/github/license/Plasius-LTD/graph-events)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

[![CI](https://github.com/Plasius-LTD/graph-events/actions/workflows/ci.yml/badge.svg)](https://github.com/Plasius-LTD/graph-events/actions/workflows/ci.yml)
[![CD](https://github.com/Plasius-LTD/graph-events/actions/workflows/cd.yml/badge.svg)](https://github.com/Plasius-LTD/graph-events/actions/workflows/cd.yml)

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

Missed events rely on cache TTL fallback strategy (cross-package ADR 0021).

---

## Architecture

- Package ADRs: [`docs/adrs`](./docs/adrs)
- Cross-package ADRs: `plasius-ltd-site/docs/adrs/adr-0020` to `adr-0024`

---

## License

Licensed under the [Apache-2.0 License](./LICENSE).
