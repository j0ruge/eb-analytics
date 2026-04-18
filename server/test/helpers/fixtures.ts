import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

// Per-run test credentials. CI can pin via TEST_PASSWORD / TEST_PASSWORD_2 env
// vars; otherwise each test process gets a fresh random value so no
// credential-shaped literal lives in source. We enforce the FR-015 8-char
// minimum here — if an env-pinned value is too short, fall back to the random
// default so tests don't fail with password_too_short at registerUser().
function pinnedOrRandom(envVar: string | undefined, bytes = 12): string {
  if (envVar && envVar.length >= 8) return envVar;
  return randomBytes(bytes).toString('hex');
}
export const TEST_PASSWORD = pinnedOrRandom(process.env.TEST_PASSWORD);
export const TEST_PASSWORD_2 = pinnedOrRandom(process.env.TEST_PASSWORD_2);
export const WRONG_TEST_PASSWORD = `${TEST_PASSWORD}-wrong`;

// Random suffix per email avoids cross-worker collisions when vitest runs tests
// in parallel against the same DB (ms-precision `Date.now()` + process-local
// counter can still collide across forked workers).
function nextEmail(): string {
  return `user-${Date.now()}-${randomUUID()}@test.local`;
}

export interface UserFixture {
  id: string;
  email: string;
  role: 'COLLECTOR' | 'COORDINATOR';
  jwt: string;
  authHeader: { authorization: string };
}

export async function registerUser(
  app: FastifyInstance,
  opts: { email?: string; password?: string; displayName?: string } = {},
): Promise<UserFixture> {
  const email = opts.email ?? nextEmail();
  const password = opts.password ?? TEST_PASSWORD;
  const displayName = opts.displayName ?? 'Test User';
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password, display_name: displayName },
  });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser failed: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return {
    id: body.user.id,
    email,
    role: body.user.role,
    jwt: body.jwt,
    authHeader: { authorization: `Bearer ${body.jwt}` },
  };
}

interface BuildCollectionOpts {
  id: string;
  date?: string;
  seriesCode?: string;
  topicTitle?: string;
  professorName?: string;
  attendance?: [number, number, number];
  includesProfessor?: boolean;
  uniqueParticipants?: number;
  clientUpdatedAt?: string;
  weather?: string | null;
  notes?: string | null;
}

export function buildCollection(opts: BuildCollectionOpts): Record<string, unknown> {
  return {
    id: opts.id,
    client_created_at: '2026-04-11T10:00:00.000Z',
    client_updated_at: opts.clientUpdatedAt ?? '2026-04-11T10:07:00.000Z',
    status: 'COMPLETED',
    lesson_instance: {
      date: opts.date ?? '2026-04-11',
      series_id: null,
      series_code_fallback: opts.seriesCode ?? 'EB354',
      topic_id: null,
      topic_title_fallback: opts.topicTitle ?? 'Lição 1',
      professor_id: null,
      professor_name_fallback: opts.professorName ?? 'Prof Teste',
    },
    times: {
      expected_start: '10:00',
      expected_end: '11:00',
      real_start: null,
      real_end: null,
    },
    attendance: {
      start: opts.attendance?.[0] ?? 10,
      mid: opts.attendance?.[1] ?? 12,
      end: opts.attendance?.[2] ?? 11,
      includes_professor: opts.includesProfessor ?? false,
    },
    unique_participants: opts.uniqueParticipants ?? 13,
    weather: opts.weather ?? null,
    notes: opts.notes ?? null,
  };
}

export function envelope(collections: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    schema_version: '2.0',
    client: { app_version: 'test', device_id: '11111111-1111-1111-1111-111111111111' },
    collector: null,
    exported_at: new Date().toISOString(),
    collections,
  };
}
