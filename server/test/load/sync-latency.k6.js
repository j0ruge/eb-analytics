#!/usr/bin/env node
/**
 * SC-003 latency load test — implemented with autocannon (not k6) so it
 * runs from the same toolchain as the rest of the test suite.
 *
 * Assumes the server is already running at SERVER_URL (default
 * http://localhost:3000) and that a valid JWT is provided via the JWT env var.
 *
 * Usage (reference rig — 2 vCPU / 2 GB RAM):
 *   cd server/
 *   docker compose up -d         # DB + server
 *   EB_PW='<choose-8+-chars>'
 *   curl -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
 *     -d "{\"email\":\"load@test\",\"password\":\"$EB_PW\",\"display_name\":\"Load\"}"
 *   # save the jwt from the response
 *   JWT=<paste> node test/load/sync-latency.k6.js
 *
 * Pass criterion: p95 < 500 ms over ≥ 30 s of sustained traffic.
 */
import autocannon from 'autocannon';
import { randomUUID } from 'node:crypto';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const JWT = process.env.JWT;
if (!JWT) {
  console.error('JWT env var required — register a user then run again.');
  process.exit(1);
}

function buildBatch() {
  const collections = Array.from({ length: 50 }, (_, i) => ({
    id: randomUUID(),
    client_created_at: '2026-04-11T10:00:00.000Z',
    client_updated_at: '2026-04-11T10:07:00.000Z',
    status: 'COMPLETED',
    lesson_instance: {
      date: '2026-04-11',
      series_id: null,
      series_code_fallback: 'LOAD',
      topic_id: null,
      topic_title_fallback: `Lição ${i}`,
      professor_id: null,
      professor_name_fallback: 'Prof Load',
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
  }));
  return JSON.stringify({
    schema_version: '2.0',
    client: { app_version: 'load', device_id: randomUUID() },
    collector: null,
    exported_at: new Date().toISOString(),
    collections,
  });
}

const result = await autocannon({
  url: `${URL}/sync/batch`,
  method: 'POST',
  connections: 10,
  duration: 30,
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${JWT}`,
  },
  setupClient: (client) => {
    client.setBody(buildBatch());
  },
});

// autocannon reports p50/p90/p97_5/p99 directly; p97_5 is a conservative
// proxy for p95 (any batch below the p97.5 is also below the p95).
console.log(
  'Latency p50/p90/p97_5/p99 (ms):',
  result.latency.p50,
  result.latency.p90,
  result.latency.p97_5,
  result.latency.p99,
);
console.log('Throughput req/s:', result.requests.average);

const p97_5 = result.latency.p97_5;
if (p97_5 >= 500) {
  console.error(`SC-003 FAIL: p97.5=${p97_5}ms (conservative proxy for p95; must be < 500ms)`);
  process.exit(1);
}
console.log(`SC-003 PASS: p97.5=${p97_5}ms (p95 ≤ p97.5 by definition)`);
