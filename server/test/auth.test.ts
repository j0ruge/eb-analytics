import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { prisma } from '../src/lib/prisma.js';

describe('auth endpoints (US-4)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('POST /auth/register', () => {
    it('scenario 1: first registered user gets role COORDINATOR (FR-013)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'first@example.com',
          password: 'secret-pw-1',
          display_name: 'First',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(typeof body.jwt).toBe('string');
      expect(body.jwt.length).toBeGreaterThan(20);
      expect(body.user).toMatchObject({
        email: 'first@example.com',
        display_name: 'First',
        role: 'COORDINATOR',
        accepted: true,
      });
      expect(typeof body.user.id).toBe('string');
    });

    it('scenario 2: second registered user defaults to COLLECTOR', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'coord@example.com',
          password: 'secret-pw-1',
          display_name: 'Coord',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'second@example.com',
          password: 'secret-pw-2',
          display_name: 'Second',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().user.role).toBe('COLLECTOR');
    });

    it('scenario 5: rejects password shorter than 8 chars with password_too_short (FR-015)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'short@example.com',
          password: '7chars!',
          display_name: 'Short',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('password_too_short');
    });

    it('rejects malformed email with invalid_email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'secret-pw-1',
          display_name: 'Bad',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('invalid_email');
    });

    it('rejects duplicate email with 409 email_already_registered', async () => {
      const payload = {
        email: 'dup@example.com',
        password: 'secret-pw-1',
        display_name: 'Dup',
      };
      await app.inject({ method: 'POST', url: '/auth/register', payload });
      const res = await app.inject({ method: 'POST', url: '/auth/register', payload });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('email_already_registered');
    });
  });

  describe('POST /auth/login', () => {
    it('scenario 3: wrong password returns 401 invalid_credentials (no enumeration leak)', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user@example.com',
          password: 'secret-pw-1',
          display_name: 'User',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'user@example.com', password: 'wrong-password' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('invalid_credentials');
    });

    it('scenario 3: unknown email returns 401 invalid_credentials with identical code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nobody@example.com', password: 'secret-pw-1' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('invalid_credentials');
    });

    it('valid credentials return 200 with jwt and user', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user@example.com',
          password: 'secret-pw-1',
          display_name: 'User',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'user@example.com', password: 'secret-pw-1' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.jwt).toBe('string');
      expect(body.user.email).toBe('user@example.com');
    });
  });

  describe('GET /me', () => {
    it('scenario 4: valid JWT returns current user info', async () => {
      const reg = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'me@example.com',
          password: 'secret-pw-1',
          display_name: 'Me',
        },
      });
      const { jwt } = reg.json();
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${jwt}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        email: 'me@example.com',
        display_name: 'Me',
        role: 'COORDINATOR',
        accepted: true,
      });
    });

    it('missing JWT returns 401 unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/me' });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('unauthenticated');
    });

    it('malformed JWT returns 401 unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: 'Bearer garbage.token.value' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('unauthenticated');
    });
  });
});
