#!/usr/bin/env node
/**
 * SC-005 concurrent-writes test: fires 10 parallel batches at the same
 * LessonInstance and verifies every collection persisted plus the final
 * aggregate equals the expected median.
 *
 * Requires a running server + a valid JWT (see sync-latency.k6.js header).
 */
import { randomUUID } from 'node:crypto';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const JWT = process.env.JWT;
if (!JWT) {
  console.error('JWT env var required.');
  process.exit(1);
}

const DATE = '2026-04-11';
const PARALLEL = 10;
const VALUES = Array.from({ length: PARALLEL }, (_, i) => 10 + i);

function buildBatch(i, value) {
  return {
    schema_version: '2.0',
    client: { app_version: 'conc', device_id: randomUUID() },
    collector: null,
    exported_at: new Date().toISOString(),
    collections: [
      {
        id: randomUUID(),
        client_created_at: '2026-04-11T10:00:00.000Z',
        client_updated_at: `2026-04-11T10:${i.toString().padStart(2, '0')}:00.000Z`,
        status: 'COMPLETED',
        lesson_instance: {
          date: DATE,
          series_id: null,
          series_code_fallback: 'CONC',
          topic_id: null,
          topic_title_fallback: 'Concurrency',
          professor_id: null,
          professor_name_fallback: 'Prof Conc',
        },
        times: {
          expected_start: '10:00',
          expected_end: '11:00',
          real_start: null,
          real_end: null,
        },
        attendance: { start: value, mid: value, end: value, includes_professor: false },
        unique_participants: value,
        weather: null,
        notes: null,
      },
    ],
  };
}

async function post(i) {
  const res = await fetch(`${URL}/sync/batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify(buildBatch(i, VALUES[i])),
  });
  if (!res.ok) {
    throw new Error(`batch ${i} failed: ${res.status}`);
  }
  return res.json();
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

const results = await Promise.all(VALUES.map((_, i) => post(i)));
const accepted = results.flatMap((r) => r.accepted);
console.log(`Accepted ${accepted.length}/${PARALLEL} collections.`);

// Fetch the instance — requires coordinator role (the provided JWT).
const list = await fetch(
  `${URL}/instances?from=${DATE}&to=${DATE}`,
  { headers: { authorization: `Bearer ${JWT}` } },
);
if (!list.ok) {
  console.error('Note: /instances returned', list.status, '- rerun with a COORDINATOR JWT.');
  process.exit(1);
}
const { instances } = await list.json();
const target = instances.find((i) => i.series_code === 'CONC');
if (!target) throw new Error('target instance missing');

const expectedMedian = median(VALUES);
console.log(
  `Instance agg: count=${target.agg_collector_count} start=${target.agg_start} expected=${expectedMedian}`,
);
if (target.agg_collector_count !== PARALLEL) {
  console.error(`SC-005 FAIL: collector count ${target.agg_collector_count} != ${PARALLEL}`);
  process.exit(1);
}
if (target.agg_start !== expectedMedian) {
  console.error(`SC-005 FAIL: aggStart ${target.agg_start} != expected median ${expectedMedian}`);
  process.exit(1);
}
console.log('SC-005 PASS');
