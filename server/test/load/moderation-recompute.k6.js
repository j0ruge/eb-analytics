#!/usr/bin/env node
/**
 * SC-006 moderation recompute timing: seed a user with 100 contributing
 * instances, then PATCH `accepted=false` and assert total wall time < 1 s.
 *
 * Note: the integration test test/moderation.test.ts already asserts the
 * same property via Fastify's in-process inject. This script uses an
 * out-of-process HTTP client so the measurement includes TCP + JSON parsing
 * overhead, matching the production topology.
 */
import { randomUUID } from 'node:crypto';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const COORD_JWT = process.env.COORD_JWT;
const COLLECTOR_JWT = process.env.COLLECTOR_JWT;
const COLLECTOR_ID = process.env.COLLECTOR_ID;
if (!COORD_JWT || !COLLECTOR_JWT || !COLLECTOR_ID) {
  console.error('Set COORD_JWT, COLLECTOR_JWT, COLLECTOR_ID env vars first.');
  process.exit(1);
}

function buildCollection(i) {
  const day = (i % 28) + 1;
  const month = (Math.floor(i / 28) % 12) + 1;
  const year = 2024 + Math.floor(i / (28 * 12));
  return {
    id: randomUUID(),
    client_created_at: '2026-04-11T10:00:00.000Z',
    client_updated_at: '2026-04-11T10:07:00.000Z',
    status: 'COMPLETED',
    lesson_instance: {
      date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      series_id: null,
      series_code_fallback: 'MOD',
      topic_id: null,
      topic_title_fallback: 'Mod Topic',
      professor_id: null,
      professor_name_fallback: 'Prof Mod',
    },
    times: {
      expected_start: '10:00',
      expected_end: '11:00',
      real_start: null,
      real_end: null,
    },
    attendance: { start: 10 + i, mid: 12, end: 11, includes_professor: false },
    unique_participants: 13,
    weather: null,
    notes: null,
  };
}

const batch = {
  schema_version: '2.0',
  client: { app_version: 'mod', device_id: randomUUID() },
  collector: null,
  exported_at: new Date().toISOString(),
  collections: Array.from({ length: 100 }, (_, i) => buildCollection(i)),
};

console.log('Seeding 100 instances...');
const ingest = await fetch(`${URL}/sync/batch`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${COLLECTOR_JWT}`,
  },
  body: JSON.stringify(batch),
});
if (!ingest.ok) throw new Error(`seed failed: ${ingest.status}`);

console.log('Toggling accepted=false...');
const t0 = Date.now();
const res = await fetch(`${URL}/users/${COLLECTOR_ID}/accepted`, {
  method: 'PATCH',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${COORD_JWT}`,
  },
  body: JSON.stringify({ accepted: false }),
});
const elapsed = Date.now() - t0;
if (!res.ok) throw new Error(`patch failed: ${res.status}`);
console.log(`PATCH /users/:id/accepted round-trip: ${elapsed}ms`);
if (elapsed >= 1000) {
  console.error(`SC-006 FAIL: ${elapsed}ms >= 1000ms`);
  process.exit(1);
}
console.log('SC-006 PASS');
