# ADR-0004: Reusable Replayable Checkpoint Primitives for Projection Batches

## Status

- Accepted
- Date: 2026-05-14
- Version: 1.0

## Context

Multiple downstream consumers in the AI/game and graph ecosystems need deterministic replay behavior for event-derived projection work. Each consumer needs a minimal, package-agnostic checkpoint protocol so processing can resume from the last applied event after restarts, retries, or scaled-out workers.

## Decision

- Add generic replayable checkpoint interfaces to `@plasius/graph-events`:
  - immutable stream checkpoint shape
  - checkpoint store interface
  - in-memory checkpoint store implementation
- Add a generic `ReplayableProjector` that applies idempotent batch processing:
  - rejects stream mismatches within a batch
  - skips already processed event ids at the same version
  - skips older versions after checkpoint recovery
  - updates checkpoint after each successful apply
- Keep project-specific event schemas outside this package while preserving generic reuse.

## Alternatives Considered

- **Project-specific checkpoint per consumer**: rejected because each package duplicated logic and created inconsistent resume semantics.
- **Event processor only**: rejected because stream-level checkpoint and idempotent replay behavior belongs below individual processor internals for projector consumers.

## Consequences

- Downstream consumers can resume projection work deterministically using a shared store abstraction.
- Replay behavior is explicit and testable without requiring `@plasius/ai-game` semantics.
- Consumers still retain freedom to define event-specific conflict handling above this layer.
