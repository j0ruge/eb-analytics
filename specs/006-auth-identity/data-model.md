# Data Model: Auth & Identity (006)

**Date**: 2026-04-12

## Entities

### User (local cache — mirror of server)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PK, UUID | Server-generated, client-cached |
| email | TEXT | UNIQUE, NOT NULL | Used for login |
| display_name | TEXT | NOT NULL | Shown in header, export payload |
| role | TEXT | CHECK IN ('COLLECTOR', 'COORDINATOR') | Determines UI permissions |
| accepted | INTEGER | DEFAULT 1 (true) | Server-managed, cached locally |
| created_at | TEXT | ISO 8601 | Server-generated timestamp |

**Storage**: SQLite table `auth_users` (local cache for offline reads).
**Authoritative source**: Server (spec 007). Client refreshes on login and periodically.

### AuthSession (client-side only)

| Field | Storage | Notes |
|-------|---------|-------|
| jwt | expo-secure-store (`eb:auth:jwt`) | Sensitive credential, platform keychain |
| user | AsyncStorage (`@eb-insights/auth-user`) | JSON-serialized User for fast offline reads |

**Not a database table** — split across secure store and AsyncStorage.

### Lesson (modified — existing table)

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| collector_user_id | TEXT NULL | **NEW column** | FK to auth_users.id (logical, not enforced) |

**Migration**: `ALTER TABLE lessons_data ADD COLUMN collector_user_id TEXT`
**Index**: `CREATE INDEX idx_lessons_collector_user_id ON lessons_data(collector_user_id)`
**Backfill**: None — existing rows stay NULL (anonymous).

## Relationships

```
User (auth_users)
  │
  ├─── 1:N ──→ Lesson (lessons_data.collector_user_id)
  │              "A user creates many lessons"
  │              NULL = anonymous (no user logged in)
  │
  └─── 1:1 ──→ AuthSession (in-memory + storage)
                 "A logged-in user has one active session"
```

## State Transitions

### Auth State Machine

```
                    ┌─────────────┐
       app start ──→│  LOADING    │ (reading stored session)
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────┐          ┌──────────────┐
     │  ANONYMOUS   │◄────────│ AUTHENTICATED │
     │  (no session)│  logout  │ (JWT + user)  │
     └──────┬──────┘          └──────┬────────┘
            │                        │
            │  login/register        │  token expired (401)
            └────────────────────────┘
```

**LOADING**: On app start, AuthProvider reads stored JWT + user. Shows nothing (no splash delay — auth is async, not blocking).
**ANONYMOUS**: Default state. All features work except cloud sync.
**AUTHENTICATED**: User logged in. Lessons tagged with user ID. Cloud sync enabled.

### Transition Rules

| From | Event | To | Side Effects |
|------|-------|----|-------------|
| LOADING | Session found | AUTHENTICATED | Set user in context |
| LOADING | No session | ANONYMOUS | No action |
| ANONYMOUS | Login success | AUTHENTICATED | Save JWT + user to storage |
| ANONYMOUS | Register success | AUTHENTICATED | Save JWT + user to storage |
| AUTHENTICATED | Logout | ANONYMOUS | Clear JWT + user from storage |
| AUTHENTICATED | 401 response | ANONYMOUS | Clear JWT + user, show toast |
| AUTHENTICATED | Secure store wiped | ANONYMOUS | Graceful fallback on next read |

## Validation Rules

### Registration

| Field | Rule | Error Message |
|-------|------|---------------|
| email | Non-empty, valid email format | "Email inválido" |
| password | Non-empty (server enforces min requirements) | "Senha é obrigatória" / server message |
| display_name | Non-empty, max 100 chars | "Nome é obrigatório" |

### Login

| Field | Rule | Error Message |
|-------|------|---------------|
| email | Non-empty | "Email é obrigatório" |
| password | Non-empty | "Senha é obrigatória" |

Client-side validation is minimal (non-empty + email format). Server is authoritative for all business rules.

## Query Patterns

### Home Screen (filtered)

```sql
-- Logged in as user U1:
SELECT ld.*, p.name AS professor_name, ...
FROM lessons_data ld
LEFT JOIN professors p ON ld.professor_id = p.id
WHERE ld.collector_user_id = ? OR ld.collector_user_id IS NULL
ORDER BY ld.date DESC, ld.created_at DESC

-- Anonymous (no filter):
SELECT ld.*, p.name AS professor_name, ...
FROM lessons_data ld
LEFT JOIN professors p ON ld.professor_id = p.id
ORDER BY ld.date DESC, ld.created_at DESC
```

### Export Payload (collector field)

```json
// Logged in:
{ "collector": { "user_id": "uuid", "display_name": "Name" } }

// Anonymous:
{ "collector": null }
```
