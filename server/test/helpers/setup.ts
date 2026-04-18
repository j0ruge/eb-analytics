// Global vitest setup — loads .env and sets test defaults before any test runs.
import 'dotenv/config';

process.env.JWT_SECRET ??= 'test-secret-change-me-in-ci';
process.env.CORS_ORIGIN ??= 'http://localhost:8081';
process.env.LOG_LEVEL ??= 'silent';
