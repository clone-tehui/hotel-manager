# Chatbot backend readiness — no payment

Built on the VPS source snapshot dated 2026-10-02, not the older GitHub source.
Public listings, availability page, room catalog, monthly-rate accounting, legacy booking bridge, and existing routes remain in place.

## New capabilities

- ADMIN CRUD: `/api/room-types/:roomTypeId/stay-discount-rules`, with DAY/MONTH/YEAR normalized to 1/30/365 nights and serialized overlap validation.
- `POST /api/pricing/price-check`: dedicated service key, `chatbot:pricing:read`.
- `POST /api/chatbot/customer-context`: `chatbot:customer:read`, exact normalized identifiers only, no name matching.
- `POST /api/chatbot/holds`: `chatbot:hold:write`, mandatory `Idempotency-Key`.
- `GET /api/chatbot/holds/:id`: `chatbot:hold:read`.
- `POST /api/chatbot/holds/:id/release`: `chatbot:hold:write`, mandatory `Idempotency-Key`.
- `POST /api/chatbot/bookings/from-hold`: `chatbot:booking:write`, mandatory `Idempotency-Key`, no caller-supplied money fields.
- `GET /api/chatbot/bookings/:id`: `chatbot:booking:read`, restricted to bookings converted from holds owned by the same API key.
- Existing quick-room-search accepts dedicated keys with `chatbot:availability:read` and excludes maintenance and active overlapping nonexpired holds.

## Inventory and pricing

Hold, booking, and legacy reservation writes use PostgreSQL transaction-scoped room advisory locks. Reservation mutations also lock their reservation identity before acquiring sorted room locks. Hold expiration is effective immediately by timestamp, with a default TTL of 15 minutes; `CHATBOT_HOLD_TTL_MINUTES` permits 1–1440 minutes when provided in the API environment. Cleanup is not required for inventory correctness.

Pricing reuses existing PMS check-in/out normalization, defaults discount to no, uses `Room.price` before `RoomType.basePrice`, and does not reuse legacy discountablePrice. Decimal calculations and immutable hold snapshots preserve the legacy base-price minus total-discount mapping.

Dedicated `chatbot:` keys cannot access unannotated legacy JWT routes. Historical integration keys without any `chatbot:` scopes retain their existing behavior for compatibility; this is not a migration of every legacy key to JWT-only access. Provision separate keys with only necessary explicit scopes; do not repurpose an existing bridge key.

Errors on new endpoints contain stable top-level `code`, `statusCode`, `message` and a compatible `error.code` projection. Retries retain idempotency responses even past the recorded retention timestamp; no destructive expiry cleanup is implemented.

## Validation

`pnpm --dir apps/api test:pricing` runs unit cases. `test:chatbot-integration` requires an isolated PostgreSQL database named chatbot_test on loopback port 55432 and refuses another target. Its HTTP application covers auth, reservations, pricing, and chatbot modules; legacy outbound webhook functions are mocked and must never send real messages during tests.

New SQL migration is additive. Existing VPS DBs were created with schema push and have a historical migration table; dry-run the SQL on an isolated restored database and apply only the new migration after backup. Do not use reset, accept-data-loss, or replace PostgreSQL/uploads volumes. Do not restore old full database snapshots over live writes to roll back code.

Payment, LLM, webhook ingress, search pagination, customer memory, and n8n changes are outside this milestone.
