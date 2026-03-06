# ADR-0003: Event Ordering Guard and Telemetry Baseline

## Status

- Accepted
- Date: 2026-03-06
- Version: 1.0

## Context

Event-driven hydration can corrupt cache state when out-of-order events overwrite newer versions. We also need visibility into event lag and processing failures for operational SLOs.

## Decision

- Add version ordering guard before hydration writes; older event versions are skipped.
- Add schema compatibility guard with configurable supported schema versions.
- Emit telemetry for:
  - event lag (`graph.events.lag_ms`),
  - processed outcomes (`graph.events.processed`),
  - failures (`graph.events.failure` + error payload).

## Consequences

- Out-of-order events no longer overwrite newer cached values.
- Schema evolution can be rolled out with explicit allow lists.
- Operational dashboards can track lag/failure while TTL fallback remains the missed-event safety net.
