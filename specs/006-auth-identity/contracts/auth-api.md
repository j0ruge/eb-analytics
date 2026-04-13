# Auth API Contract — Spec 006

**Owner**: spec 007 (sync-backend) implements these endpoints.
**Consumer**: spec 006 (auth-identity) client relies on this contract.
**Created**: 2026-04-11

---

## Endpoints

### `POST /auth/register`

Creates a new user account.

- **Request**:
  ```json
  { "email": "string", "password": "string", "display_name": "string" }
  ```
- **Response 201** (success):
  ```json
  {
    "jwt": "string",
    "user": { "id": "uuid", "email": "string", "display_name": "string", "role": "COLLECTOR | COORDINATOR", "accepted": true }
  }
  ```
- **Response 409**: Email already registered.
- **Business Rule**: The FIRST user to register in an empty database MUST be assigned `role: COORDINATOR` automatically. Subsequent users are `COLLECTOR`.

---

### `POST /auth/login`

Authenticates an existing user.

- **Request**:
  ```json
  { "email": "string", "password": "string" }
  ```
- **Response 200** (success):
  ```json
  {
    "jwt": "string",
    "user": { "id": "uuid", "email": "string", "display_name": "string", "role": "COLLECTOR | COORDINATOR", "accepted": true | false }
  }
  ```
- **Response 401**: Bad credentials.

---

### `GET /users/me`

Returns the authenticated user's profile.

- **Request**: Bearer JWT in `Authorization` header.
- **Response 200**:
  ```json
  { "id": "uuid", "email": "string", "display_name": "string", "role": "COLLECTOR | COORDINATOR", "accepted": true | false }
  ```
- **Response 401**: Missing or expired JWT.

---

### `GET /users` (Coordinator only)

Lists all registered users. Restricted to Coordinator role.

- **Request**: Bearer JWT with `role = COORDINATOR`.
- **Response 200**:
  ```json
  [
    { "id": "uuid", "email": "string", "display_name": "string", "role": "COLLECTOR | COORDINATOR", "accepted": true | false, "created_at": "ISO 8601" }
  ]
  ```
- **Response 403**: Role is not COORDINATOR.

---

### `PATCH /users/:id/accepted` (Coordinator only)

Toggles whether a collector's submissions are included in aggregation.

- **Request**: Bearer JWT with `role = COORDINATOR`, body:
  ```json
  { "accepted": true | false }
  ```
- **Response 200**:
  ```json
  { "id": "uuid", "accepted": true | false }
  ```
  Server recomputes aggregates for any affected lesson instances in the background.
- **Response 403**: Role is not COORDINATOR.

---

## Token Policy

- **Algorithm**: Server-defined (opaque to client).
- **Expiry**: 7 days (server-configurable). No refresh token in MVP — user must re-login after expiry.
- **Transport**: `Authorization: Bearer <jwt>` header on all authenticated requests.
- **Revocation**: Not supported in MVP. Old tokens remain valid until expiry even after a new login on another device.
