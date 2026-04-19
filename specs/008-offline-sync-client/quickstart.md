# Quickstart — Offline-First Sync Client (008)

**Audience**: engineer validating the feature end-to-end after implementation.
**Time**: ~10 minutes once the backend is running.
**Prereqs**: spec 007 backend reachable at a known URL; you have a coordinator or collector account; simulator (iOS / Android) or web build; optional: a second device / browser for EC-002.

---

## 0. Environment

```bash
# Terminal A — backend (from repo root)
cd server
docker compose up -d             # Postgres + Fastify; spec 007 quickstart
npm run dev                      # http://localhost:3000

# Terminal B — mobile (from repo root)
export EXPO_PUBLIC_API_URL="http://localhost:3000"
npm start                        # Expo dev server
```

Open the app on iOS simulator, Android emulator, or `w` for web.

---

## 1. Happy path — send single submission online (US-1)

1. Log in with a collector account (spec 006 login screen at `/login`).
2. Create a new lesson: Home → "Nova Aula" → fill required fields → mark as `COMPLETED`.
3. Open the lesson detail (tap the card). Confirm the **"Enviar pra Nuvem"** button is visible (logged in + COMPLETED + `sync_status = LOCAL`).
4. Tap "Enviar pra Nuvem".
5. **Expect**: status pill animates `LOCAL → SENDING → SYNCED` within ~2 seconds. All inputs on the detail screen become disabled. Success toast appears.
6. **Expect**: force-close the app, reopen. The lesson is still SYNCED and still read-only. (SC-005)

**SQL sanity check** (Metro console or a `await getDatabase()` probe):

```sql
SELECT id, sync_status, sync_attempt_count, synced_at
  FROM lessons_data
 WHERE sync_status = 'SYNCED';
```

`synced_at` is non-null; `sync_attempt_count` is `0`.

---

## 2. Offline queue & eventual send (US-2)

1. Enable **Airplane Mode** on the device (or toggle network off in the simulator / browser devtools).
2. Create 3 lessons, mark each COMPLETED.
3. Tap "Enviar pra Nuvem" on all three.
4. **Expect**: each pill goes `LOCAL → SENDING → QUEUED` (SENDING is momentary; the fetch fails immediately → classified as network error → revert). Badge on Home header now shows `3`.
5. Tap the badge. **Expect**: route to `/sync`, list shows three rows in QUEUED state with "Retry agora" buttons.
6. Disable Airplane Mode. Keep the app foregrounded.
7. **Expect**: within 30 seconds, all 3 transition to SYNCED, badge disappears, `/sync` shows the green "Tudo em dia" banner + 3 items in the 7-day history list.

**Batching check**: server logs should show **one** `POST /sync/batch` with `collections.length = 3`, not three separate requests.

---

## 3. Backoff schedule — 5xx / flaky server (US-3)

### Preparation

- Start backend with an injected failure. Simplest: use a local proxy (e.g., `toxiproxy`, `mitmproxy`) that returns `503` for the first 3 requests, then passes through. Or temporarily hard-code a failure counter in `server/src/routes/sync.ts` for the test.

### Steps

1. Queue a single lesson offline (Airplane Mode ON → tap "Enviar pra Nuvem" → Airplane Mode OFF).
2. Observe DevTools / Metro logs for timestamps of each HTTP retry.
3. **Expect** delays of `~30s, ~1min, ~2min`, then success on the 4th attempt.
4. **Expect** `sync_attempt_count` in the DB reflects 3 before success, then resets to 0.

---

## 4. REJECTED item — 4xx from server (US-3 acceptance 2)

### Preparation

- With the backend running, temporarily make the next `POST /sync/batch` return a per-item rejection. Two ways:
  1. Send a lesson with a mangled `professor_id` that isn't in the server's catalog — server returns rejected with `missing_catalog_reference`.
  2. Or hard-code a `rejected` entry in the server route.

### Steps

1. Queue one such lesson. The send happens; result contains `rejected: [{ id, code: 'missing_catalog_reference', message: '…' }]`.
2. **Expect**: the row's pill becomes red `REJECTADO` (or equivalent). The detail screen shows a red banner with the server's message. "Enviar pra Nuvem" is **replaced** by a read-only indicator — no re-send option (per FR-013).
3. **Expect**: `/sync` screen still lists this row with the red indicator.

---

## 5. 401 mid-batch (EC-003)

### Preparation

- On the server, revoke / expire the JWT (e.g., restart server with a new `JWT_SECRET` so existing tokens are invalid).

### Steps

1. Queue 3 lessons offline, go back online.
2. Sync attempt returns 401.
3. **Expect**:
   - JWT is cleared (`apiClient.clearJwt()` already runs on 401).
   - Toast shows `"Sessão expirada — entre novamente para sincronizar"`.
   - The 3 items revert to QUEUED; badge still shows `3`.
4. Log in again on the same account.
5. **Expect**: within 30 seconds after login, the 3 queued items sync successfully.

---

## 6. Rate-limited (429 + `Retry-After`) — the clarify session answer

### Preparation

- Configure `@fastify/rate-limit` on the server to allow only 1 request per minute on `/sync/batch` (temporary).
- Cause the server to include `Retry-After: 60` in the 429 response (default behavior of `@fastify/rate-limit`).

### Steps

1. Fire two `POST /sync/batch` calls back-to-back (queue two separate items and tap "Retry agora" quickly, or use curl).
2. Second call returns 429 with `Retry-After: 60`.
3. **Expect**: the batch's items revert to QUEUED with `sync_next_attempt_at ≈ now + 60s` (not the FR-030 first-retry 30s).
4. Wait ~60s.
5. **Expect**: sync succeeds, badge clears.

---

## 7. Catalog pull (US-4)

### Auto pull (post-login)

1. Log out.
2. Log in.
3. **Expect**: within a few seconds, an HTTP request to `GET /catalog` (no `since` on first login ever, or `?since=…` otherwise) appears in server logs. Local `lesson_series`, `lesson_topics`, `professors` tables are populated.

### Auto pull (foreground after 1h)

1. Change the foreground-timer constant to `60 * 1000` (1 minute) temporarily OR simulate by reading `last_catalog_sync` out of AsyncStorage and writing a 2-hour-old value.
2. Background the app, wait, foreground.
3. **Expect**: another `GET /catalog?since=…` fires.

### Manual pull — pull to refresh

1. In the series list, pull down.
2. **Expect**: spinner, request fires, list refreshes.

### Manual pull while offline (FR-045)

1. Airplane Mode ON.
2. Pull down on series list.
3. **Expect**: the pull-to-refresh spinner dismisses and a toast appears: `"Sem conexão — usando dados locais"`.
4. **Compare** with auto trigger: if you fire an auto pull while offline (restart app offline), **no toast** — silent failure is the correct behavior for auto.

---

## 8. Visible sync status (US-5)

1. Queue 3 items offline (as in step 2).
2. **Expect**: Home header shows a badge `3` with an upload icon.
3. Tap badge → `/sync` lists all 3.
4. Go online; wait.
5. **Expect**: badge count ticks down 3 → 2 → 1 → 0 (<1 second lag per SC-007) and then the icon hides (FR-014 scenario 3).
6. **Expect**: `/sync` shows "Tudo em dia" banner + 3 history rows.

---

## 9. EC-001 force-close during SENDING

1. Queue an item offline, go online.
2. **Immediately** force-close the app (swipe away from app switcher) within the <1 s window while the pill is in `SENDING`.
3. Reopen the app.
4. **Expect**: the item is QUEUED again (boot reconciliation `SENDING → QUEUED` in `src/db/client.ts`). It sends successfully on the next loop tick.
5. **Expect on server**: exactly one row created, not two (idempotency via `collections[].id`).

---

## 10. Zero Data Loss SC-001 rough soak

A full soak is a 4-hour test with 30 % packet loss — run that in CI against `toxiproxy`. A manual quick check:

1. Write a 50-lesson batch (use a small seed script).
2. Use `toxiproxy` to drop 30 % of requests.
3. Let the loop run until the queue empties (may take 15 min with backoff).
4. `SELECT count(*) FROM lessons_data WHERE sync_status = 'SYNCED'` on the client should equal `SELECT count(*) FROM "Collection"` for that user on the server. No duplicates, no losses.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Badge stuck > 0 after a successful sync | `SyncProvider` isn't recomputing `pending` after `applyResult` | Check that `countPending` runs in the same effect that processed the result |
| Item perpetually in SENDING after a crash | Boot reconciliation didn't run | Confirm `src/db/client.ts` calls the reconciliation UPDATE after migrations, before `SyncProvider` mounts |
| 429 retry fires at 30s instead of 60s | `parseRetryAfter` not invoked or returned null | Unit-test it directly with `'60'` and an IMF-fixdate |
| "Enviar pra Nuvem" button missing | User not logged in, or `sync_status ≠ LOCAL`, or lesson `status ≠ COMPLETED` | Check all three preconditions per FR-010 |
| Manual pull-to-refresh silent when offline | `trigger = 'auto'` accidentally passed | Screen must pass `'manual'` explicitly |
| Web E2E test fails in CI with secure-store error | Platform check missing in code path E2E exercises | `apiClient` already guards; verify `syncService` never reaches for secure-store |
