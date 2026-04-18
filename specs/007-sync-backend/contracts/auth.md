# Contracts — Auth

All endpoints return `application/json`. Error bodies conform to FR-065: `{code, message}`, pt-BR `message`, English `snake_case` `code`. See `error-codes.md` for the full `code` registry.

## POST /auth/register

Maps to FR-010, FR-013, FR-014, FR-015.

**Auth**: none.

**Body**:

```json
{
  "email": "user@example.com",
  "password": "at_least_8_chars",
  "display_name": "Alex"
}
```

**201** — success:

```json
{
  "jwt": "<HS256 token, 7d>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Alex",
    "role": "COORDINATOR",
    "accepted": true
  }
}
```

The first successfully registered user has `role: "COORDINATOR"`; all others default to `"COLLECTOR"` (FR-013).

**Errors**:
- 400 `password_too_short` — password shorter than 8 chars (FR-015, US-4 scenario 5).
- 400 `invalid_email` — email fails the server-side format check (a pragmatic regex subset of RFC-5321, not the full grammar — rejects missing `@`, missing TLD, whitespace, multiple `@`, empty local/domain parts).
- 409 `email_already_registered` — email uniqueness violation.

## POST /auth/login

Maps to FR-011.

**Auth**: none.

**Body**: `{ "email": "...", "password": "..." }`.

**200** — success: same shape as register `201` (`{jwt, user}`).

**Errors**:
- 401 `invalid_credentials` — wrong email OR wrong password. The same code/message is emitted in both cases (no enumeration leak, FR-011, US-4 scenario 3).

## GET /me

Maps to FR-012.

**Auth**: required.

**200**: `{ id, email, display_name, role, accepted }`.

**Errors**:
- 401 `unauthenticated` — missing or invalid JWT.

## JWT contract

- **Algorithm**: HS256.
- **Secret**: `JWT_SECRET` env var (min 32 bytes, operator-generated).
- **Payload**: `{ sub: <user.id>, role: <Role>, iat, exp }`.
- **Lifetime**: 7 days (FR-064).
- **Transport**: `Authorization: Bearer <jwt>`.
- **Verification hook**: `plugins/auth.ts` runs `onRequest`; attaches `request.user` when the token validates. Anonymous requests leave `request.user = null` — downstream route handlers enforce FR-060 by refusing null.
