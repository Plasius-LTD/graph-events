# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.10] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.9] - 2026-06-22

- **Added**
  - Added replayable projection checkpoint primitives (`ReplayableProjector`, `InMemoryProjectorCheckpointStore`) for stream-safe, idempotent downstream projection batch processing.

- **Changed**
  - `GraphEventProcessor` remains unchanged; public package API now includes reusable checkpointing utilities in addition.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.6] - 2026-05-13

- **Added**
  - Version ordering guard to skip out-of-order hydration events.
  - Schema compatibility guard via `supportedSchemaVersions`.
  - Event telemetry for lag, processed outcomes, and failures.
  - Contract compatibility test suite for event envelope/schema handling.
  - ADR-0003 documenting event ordering and telemetry baseline.

- **Changed**
  - `GraphEventProcessResult` now includes optional `reason` for skipped events.
  - README now documents processing guarantees and TTL fallback linkage.

- **Fixed**
  - N/A

- **Security**
  - N/A

## [0.1.5] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.4] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.3] - 2026-04-02

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-03-06

- **Added**
  - Version ordering guard to skip out-of-order hydration events.
  - Schema compatibility guard via `supportedSchemaVersions`.
  - Event telemetry for lag, processed outcomes, and failures.
  - Contract compatibility test suite for event envelope/schema handling.
  - ADR-0003 documenting event ordering and telemetry baseline.

- **Changed**
  - `GraphEventProcessResult` now includes optional `reason` for skipped events.
  - README now documents processing guarantees and TTL fallback linkage.

- **Fixed**
  - N/A

- **Security**
  - N/A

## [0.1.1] - 2026-03-05

### Added

- Initial package scaffolding.
- Initial source implementation and baseline tests.
- CI/CD workflow baseline for GitHub Actions and npm publish path.

[0.1.1]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.3
[0.1.4]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.4
[0.1.5]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.5
[0.1.6]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.6
[0.1.9]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.9
[0.1.10]: https://github.com/Plasius-LTD/graph-events/releases/tag/v0.1.10
