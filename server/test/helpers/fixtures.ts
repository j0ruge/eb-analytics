import type { FastifyInstance } from 'fastify';

let counter = 0;
function nextEmail(): string {
  counter += 1;
  return `user-${Date.now()}-${counter}@test.local`;
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
  const password = opts.password ?? 'secret-pw-1';
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
