// Global vitest setup — loads .env and sets test defaults before any test runs.
import { randomBytes } from 'node:crypto';
import 'dotenv/config';

// Guard: tests call `resetDb()` which runs `TRUNCATE CASCADE` on every table.
// If dotenv loaded a prod DATABASE_URL (common when `.env` gets reused between
// envs), we must never wipe it. Require either (a) a TEST_DATABASE_URL set
// explicitly, which we prefer over DATABASE_URL, or (b) a DATABASE_URL that
// clearly looks like a test DB (`eb_insights_test`, `localhost`, `127.0.0.1`).
const explicitTestUrl = process.env.TEST_DATABASE_URL;
if (explicitTestUrl) {
  process.env.DATABASE_URL = explicitTestUrl;
} else {
  const url = process.env.DATABASE_URL ?? '';
  const looksLikeTestDb =
    /localhost|127\.0\.0\.1|@db:/.test(url) && /_test(\b|$)|eb_insights(\b|$)/.test(url);
  if (!url || !looksLikeTestDb) {
    throw new Error(
      'Refusing to run tests: set TEST_DATABASE_URL (preferred) or a DATABASE_URL ' +
        'pointing at a local test database (contains localhost/127.0.0.1 and a ' +
        "test-suffixed DB name like 'eb_insights_test'). Aborting to avoid " +
        'TRUNCATE CASCADE on a non-test database.',
    );
  }
}

// JWT secret is generated per-run when not injected by CI so no credential-shaped
// literal lives in source. CI sets JWT_SECRET explicitly; local `npm test` gets a
// fresh 32-byte value each invocation.
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.CORS_ORIGIN ??= 'http://localhost:8081';
process.env.LOG_LEVEL ??= 'silent';
