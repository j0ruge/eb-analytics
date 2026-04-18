// Global vitest setup — loads .env and sets test defaults before any test runs.
import { randomBytes } from 'node:crypto';
import 'dotenv/config';

// JWT secret is generated per-run when not injected by CI so no credential-shaped
// literal lives in source. CI sets JWT_SECRET explicitly; local `npm test` gets a
// fresh 32-byte value each invocation.
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.CORS_ORIGIN ??= 'http://localhost:8081';
process.env.LOG_LEVEL ??= 'silent';
