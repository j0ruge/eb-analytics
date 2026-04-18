# EB Insights — Server Rules & Coding Standards

## Project Overview

- **Stack**: Node 22 LTS + Fastify 5 + TypeScript 5.9 (strict) + Prisma 7 + PostgreSQL 16
- **Architecture**: REST API for multi-collector cloud sync
- **Language**: API error messages in Brazilian Portuguese (pt-BR), code and logs in English
- **This file**: Server-specific rules. For mobile app rules, see the root [`CLAUDE.md`](../CLAUDE.md)

## Commands

```bash
npm run dev          # Start dev server (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled server from dist/
npm test             # Run tests (Vitest)
npm run db:migrate   # Run Prisma migrations (npx prisma migrate dev)
npm run db:seed      # Seed the database (npx prisma db seed)
npm run db:studio    # Open Prisma Studio
docker compose up -d # Start PostgreSQL + server for local dev
```

---

## 1. TypeScript & Type Safety

- **Strict mode is mandatory** — same as mobile, never use `any`
- Use `interface` for request/response shapes, `type` for unions
- Use `enum` for finite sets (e.g., `Role`, `CollectionStatus`) with UPPERCASE_SNAKE_CASE values
- Mark nullable fields explicitly with `| null`
- Prefer Prisma-generated types for database entities; create DTOs for API boundaries

---

## 2. Fastify Patterns

### Route Registration

Routes are Fastify plugins registered in `src/routes/`:

```typescript
import { FastifyPluginAsync } from 'fastify';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', {
    schema: { body: LoginBodySchema, response: { 200: LoginResponseSchema } },
    handler: async (request, reply) => {
      // ...
    },
  });
};

export default authRoutes;
```

### Plugin Order

```typescript
// src/server.ts
await app.register(import('./plugins/auth'));   // JWT verification
await app.register(import('./plugins/rbac'));   // Role checks
await app.register(import('./routes/auth'));    // Public auth routes
await app.register(import('./routes/sync'));    // Protected routes
await app.register(import('./routes/catalog'));
await app.register(import('./routes/users'));
await app.register(import('./routes/instances'));
```

### Error Handling

Use Fastify's error handler. Throw errors with status codes:

```typescript
import { createError } from '@fastify/error';

const InvalidCredentials = createError('INVALID_CREDENTIALS', 'Email ou senha inválidos', 401);
const Forbidden = createError('FORBIDDEN', 'Acesso restrito', 403);

// In route handler:
throw new InvalidCredentials();
```

---

## 3. Service Layer

Services are exported as **object literals** (consistent with mobile pattern):

```typescript
export const authService = {
  async register(data: RegisterDTO): Promise<{ jwt: string; user: UserDTO }> { },
  async login(email: string, password: string): Promise<{ jwt: string; user: UserDTO }> { },
  async getUser(id: string): Promise<UserDTO | null> { },
};
```

### Service Rules

- Every database operation goes through a service — routes never access `prisma` directly
- Use `prisma.$transaction()` for operations that must be atomic
- Validate business rules in the service (existence checks, role checks, referential integrity)
- Throw descriptive errors in Portuguese for user-facing validations
- Return `null` (not `undefined`) when an entity is not found

---

## 4. Database & Prisma 7

### Schema Location

```
server/
├── prisma.config.ts       # Prisma 7 config (DATABASE_URL, seed, migrations)
├── prisma/
│   ├── schema.prisma      # Models only (no URL in datasource)
��   ├── migrations/        # Versioned in git
│   └── seed.ts            # Bootstrap data + first-user-coordinator logic
└── src/
    ├── generated/client/  # Prisma-generated client (git-ignored)
    └── lib/prisma.ts      # Singleton PrismaClient with driver adapter
```

### Prisma 7 Configuration

```typescript
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### Schema Generator

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
}
```

### Client Singleton

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

### Migration Rules

- Every schema change ships as a Prisma migration file in `prisma/migrations/`
- Never edit migration files after they've been applied
- Use `npx prisma migrate dev --name descriptive-name` to create migrations
- Seed data goes in `prisma/seed.ts`

---

## 5. Authentication & Authorization

- Passwords stored as bcrypt hashes (cost factor 12)
- JWT signing with HS256, secret from `JWT_SECRET` env var
- JWT payload: `{ sub: user_id, role, iat, exp }`, expiration: 7 days
- All endpoints except `/auth/register`, `/auth/login`, and `/health` require a valid JWT
- Role-based access: `COORDINATOR` required for catalog mutations, user list, moderation, instance reads

### Auth Plugin Pattern

```typescript
// src/plugins/auth.ts — decorates request with user
fastify.decorateRequest('user', null);
fastify.addHook('onRequest', async (request) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return; // anonymous — some routes allow this
  request.user = verifyJwt(token);
});
```

### RBAC Plugin Pattern

```typescript
// src/plugins/rbac.ts — route-level role check
fastify.decorate('requireRole', (role: Role) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new Unauthorized();
    if (request.user.role !== role) throw new Forbidden();
  };
});
```

---

## 6. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Route files | camelCase.ts | `auth.ts`, `sync.ts` |
| Service files | camelCase + "Service" | `authService.ts` |
| Lib files | camelCase.ts | `prisma.ts`, `jwt.ts` |
| Plugin files | camelCase.ts | `auth.ts`, `rbac.ts` |
| Test files | camelCase.test.ts | `auth.test.ts` |
| Prisma models | PascalCase | `User`, `LessonCollection` |
| Prisma fields | camelCase | `collectorUserId`, `createdAt` |
| Enums | PascalCase (name), UPPER_SNAKE (values) | `Role.COORDINATOR` |
| Constants | UPPER_SNAKE_CASE | `JWT_EXPIRY`, `BCRYPT_ROUNDS` |
| Env vars | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |
| Error codes | lower_snake_case (stable, English, client-keyed) | `invalid_credentials`, `password_too_short`, `series_referenced` — see `specs/007-sync-backend/contracts/error-codes.md` |

---

## 7. Testing

- Test framework: Vitest (fast, ESM-native, TypeScript-first)
- Tests in `test/` directory with `.test.ts` extension
- Use a separate test database (configured via `DATABASE_URL` in test env)
- Each test file sets up and tears down its own data (no shared state between tests)
- Use `prisma.$transaction()` with rollback for test isolation when possible
- Follow Arrange-Act-Assert pattern

```typescript
// test/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server';

describe('POST /auth/register', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('creates first user as COORDINATOR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      // Real tests must import TEST_PASSWORD from test/helpers/fixtures.ts — never inline a literal here.
      payload: { email: 'first@test.com', password: TEST_PASSWORD, display_name: 'First' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('COORDINATOR');
  });
});
```

---

## 8. Import Order

```typescript
// 1. Node built-ins
import { createHash } from 'node:crypto';

// 2. External libraries
import Fastify from 'fastify';
import { PrismaClient } from '../generated/client';
import bcrypt from 'bcrypt';

// 3. Local imports
import { prisma } from '../lib/prisma';
import { authService } from '../services/authService';
import { Role } from '../generated/client';
```

---

## 9. File Organization

```text
server/
├── src/
│   ├── routes/             # Fastify route plugins (one per domain)
│   │   ├── auth.ts
│   │   ├── sync.ts
│   │   ├── catalog.ts
│   │   ├── instances.ts
│   │   └── users.ts
│   ├── services/           # Business logic (no HTTP awareness)
│   │   ├── aggregateService.ts
│   │   ├── authService.ts
│   │   └── catalogService.ts
│   ├── lib/                # Shared infrastructure
│   │   ├── prisma.ts       # PrismaClient singleton
│   │   ├── jwt.ts          # JWT sign/verify
│   │   └── roles.ts        # Role constants
│   ├── plugins/            # Fastify plugins
│   │   ├── auth.ts         # JWT verification hook
│   │   └── rbac.ts         # Role-based access control
│   ├── generated/client/   # Prisma-generated (git-ignored)
│   └── server.ts           # App factory + plugin registration
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/                   # All server tests
├── prisma.config.ts        # Prisma 7 configuration
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── CLAUDE.md               # This file
```

### Organization Rules

- One route file per domain (auth, sync, catalog, instances, users)
- One service per domain
- Routes depend on services, never on Prisma directly
- Services depend on `prisma` from `lib/prisma.ts`
- Never import from the mobile app (`../src/`, `../app/`) — completely independent packages

---

## 10. Git & Commits

Same conventions as mobile (see root CLAUDE.md section 16):
- Conventional commits: `feat(server):`, `fix(server):`, `test(server):`, etc.
- Scope with `(server)` to distinguish from mobile commits
- Never commit `.env`, only `.env.example`
- Never commit `src/generated/` (Prisma output)

---

## 11. Docker & Deployment

- `docker-compose.yml` brings up Node + PostgreSQL for local dev
- `Dockerfile` is a multi-stage build: build stage compiles TS, runtime stage copies `dist/`
- Environment variables via `.env` file (local) or host env (production)
- Health check endpoint: `GET /health` returns `{ status: "ok", postgres: "up" }`
