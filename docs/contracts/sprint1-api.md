
# EventOre — Sprint 1 API Contracts

## 1. Purpose

Define the shared API and domain contracts for the first functional increment of EventOre.

Bounded Context: Extraction and Traceability.

User Stories: US12, US14, US15, US16, US17.

These contracts allow domain, persistence, frontend and testing development to proceed independently.

## 2. Architecture Rules

- Domain entities must not depend on Express, Vue or PostgreSQL.
- Application services coordinate use cases.
- Infrastructure implements persistence and HTTP adapters.
- Frontend components must not contain business rules.
- Cross-context integrations use explicit contracts.
- All business operations must respect tenant isolation.
- Event IDs must remain stable across synchronization retries.
- A registered lot is not automatically a verified lot.

## 3. Shared Domain Model

### MineralLot

| Field | Type | Description |
|---|---|---|
| id | UUID | Stable lot identifier |
| tenantId | UUID | Organization owner |
| mineralType | string | Mineral classification |
| weight | decimal | Positive mineral weight |
| weightUnit | string | Unit: g, kg or t |
| status | string | Registered or Cancelled |
| version | integer | Concurrency version |
| createdAt | ISO 8601 | Registration timestamp |

### OriginEvidence

| Field | Type | Description |
|---|---|---|
| id | UUID | Evidence identifier |
| lotId | UUID | Associated mineral lot |
| reference | string | Document or evidence reference |
| source | string | Declared evidence source |
| reviewStatus | string | PendingReview, Verified or Rejected |

Evidence review is a separate business action. Sprint 1 does not automatically mark evidence as verified.

### TraceEvent

| Field | Type | Description |
|---|---|---|
| id | UUID | Server event identifier |
| clientEventId | UUID | Stable client-generated identifier |
| lotId | UUID | Related mineral lot |
| tenantId | UUID | Organization scope |
| sourceId | string | Capture source |
| eventType | string | Business event type |
| occurredAt | ISO 8601 | Event occurrence |
| payload | object | Event-specific data |

## 4. REST API Contracts

Base path: /api/v1

### POST /lots

User Story: US12

Request:

```json
{
  "clientEventId": "9f98916f-50aa-4fca-8f42-e27c64c6d850",
  "mineralType": "Gold",
  "weight": "125.50",
  "weightUnit": "kg",
  "originEvidence": {
    "reference": "DOCUMENT-001",
    "source": "Mining operator declaration"
  }
}
```

Expected response: 201 Created

```json
{
  "lotId": "a0d2cdd0-d8c3-4c5c-a1b7-6626839d697c",
  "status": "Registered",
  "version": 1,
  "originEvidenceStatus": "PendingReview"
}
```

Rules:

- Mineral type is required.
- Weight must be greater than zero.
- Weight unit must be supported.
- Origin evidence reference and source are required.
- Successful registration creates the initial trace event.
- Tenant identity comes from authenticated server context, not the request body.
- Registration does not prove physical authenticity.

### GET /lots/{lotId}

User Story: US12

Expected response: 200 OK

```json
{
  "lotId": "a0d2cdd0-d8c3-4c5c-a1b7-6626839d697c",
  "mineralType": "Gold",
  "weight": "125.50",
  "weightUnit": "kg",
  "status": "Registered",
  "version": 1,
  "originEvidenceStatus": "PendingReview"
}
```

Only authorized users of the owning organization can retrieve the full business record.

### POST /events/synchronize

User Stories: US14, US15, US16

Request:

```json
{
  "sourceId": "field-device-01",
  "events": [
    {
      "clientEventId": "9f98916f-50aa-4fca-8f42-e27c64c6d850",
      "eventType": "LotRegistered",
      "occurredAt": "2026-10-07T15:30:00Z",
      "dependencies": [],
      "payload": {
        "mineralType": "Gold",
        "weight": "125.50",
        "weightUnit": "kg",
        "originEvidence": {
          "reference": "DOCUMENT-001",
          "source": "Mining operator declaration"
        }
      }
    }
  ]
}
```

Expected response: 200 OK

```json
{
  "results": [
    {
      "clientEventId": "9f98916f-50aa-4fca-8f42-e27c64c6d850",
      "status": "Accepted",
      "lotId": "a0d2cdd0-d8c3-4c5c-a1b7-6626839d697c",
      "reason": null
    }
  ]
}
```

Per-event statuses:

- Accepted: Event processed successfully.
- AlreadyProcessed: Previously accepted event; no new business effect.
- Conflict: Event identifier reused inconsistently or version conflict.
- Rejected: Validation failed.

Rules:

- Each event has a stable clientEventId.
- A retry uses the original event identifier.
- Identical retries must not create duplicate business effects.
- The same identifier with different content produces Conflict.
- Events with distinct identifiers are not discarded solely because their data match.
- Unconfirmed captures remain pending on the client.
- Authorization and tenant ownership are validated server-side.
- The backend returns an individual result for each submitted event.

## 5. Offline Capture Contract

User Stories: US14, US15

Client-side capture states:

| State | Meaning |
|---|---|
| Pending | Stored locally; not confirmed |
| Accepted | Confirmed by server |
| Conflict | Requires conflict resolution |
| Rejected | Server validation failed |

The frontend must:

- Persist pending captures in local storage.
- Preserve them after application restart.
- Never treat a sent event as accepted without confirmation.
- Retry unconfirmed events using their original identifiers.
- Display server errors without silently deleting captured data.

Recommended storage adapter: IndexedDB.

## 6. QR Identification

User Story: US17

### GET /lots/{lotId}/qr

Returns a QR image for an accepted mineral lot.

Expected response: 200 OK

Content-Type: image/png

The QR contains a stable URL pointing to the lot's application route.

Rules:

- A QR must identify the correct lot.
- A cancelled lot must display Cancelled when its identifier is consulted.
- A cancelled lot must not be accepted as transportable.
- A QR does not prove verified origin or ethical sourcing.
- Full business information requires appropriate authorization.
- Public traceability and certification are outside Sprint 1 scope.

## 7. Error Contract

Business API errors use this JSON shape:

```json
{
  "error": {
    "code": "INVALID_LOT_WEIGHT",
    "message": "Mineral lot weight must be greater than zero"
  }
}
```

Relevant HTTP codes:

- 200: Successful query or synchronization request.
- 201: New resource created.
- 400: Invalid request.
- 401: Authentication required.
- 403: Operation not authorized.
- 404: Resource not found.
- 409: Conflicting operation.
- 500: Unexpected server error.

## 8. Authentication Boundary

Business endpoints require an authenticated identity associated with an organization and permissions.

JWT is the selected token mechanism, but token issuance and the complete Identity and Access module are not implemented by this document.

Tests may use an injected identity adapter or test double. Production endpoints must not trust arbitrary tenant IDs sent by clients.

## 9. Ownership and Dependencies

| Team Member | Technical Responsibility |
|---|---|
| Ethan | Domain model, synchronization contracts, conflict policies, QR lookup |
| César | Persistence adapters, IndexedDB, deduplication, cancellation rules |
| Brandon | REST entry points, offline capture, synchronization client, QR generation |
| Breithner | Automated tests, Inbox/Outbox persistence, acceptance verification |

Contracts are agreed before dependent implementations are merged.

Developers can use interfaces, mocks and fakes while another implementation is unavailable.

## 10. Contract Change Policy

Changes to endpoint names, JSON fields, identifiers, event types or response statuses require:

1. A Pull Request modifying this document.
2. Review of affected engineering tasks.
3. Corresponding updates to tests.
4. Agreement before integration into develop.

No implementation can silently redefine a shared contract.

## 11. Sprint 1 Definition of Done

A feature is completed when:

- The implementation respects domain boundaries.
- Business rules are not placed in controllers or Vue components.
- Automated tests pass.
- Shared API contracts are respected.
- The code is reviewed through a Pull Request.
- The feature is merged into develop.
- Evidence of implementation is available for the Sprint Review.
