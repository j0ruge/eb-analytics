# Quickstart: Auth & Identity (006)

**Branch**: `006-auth-identity`

## Prerequisites

- Node.js, npm, Expo CLI installed (existing dev setup)
- Server from spec 007 running locally at `http://localhost:3000` (for login/register testing)
  - OR: mock responses for offline-only development

## Setup

```bash
# Switch to feature branch
git checkout 006-auth-identity

# Install new dependency
npx expo install expo-secure-store

# Start dev server
npm start
```

## Environment Variables

Create `.env` at repo root (git-ignored):

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

This is read by `app.config.js` and injected via `expo-constants`.

## Testing

### Unit Tests

```bash
npm test                    # All mobile unit tests
npm test -- authService     # Auth service only
npm test -- apiClient       # API client only
```

### E2E Tests

```bash
# Start web dev server (separate terminal)
npx expo start --web --port 8082

# Run Playwright tests
npm run test:e2e
```

### Manual Testing Without Server

For testing auth UI without a running backend:

1. The app works fully offline — all existing features remain available
2. Login/register will show "Erro no servidor, tente novamente" (expected without backend)
3. To test login flow, start the server from spec 007:
   ```bash
   cd server && npm run dev
   ```

## Key Files

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | Login, register, logout, session management |
| `src/services/apiClient.ts` | HTTP client with auth headers |
| `src/contexts/AuthProvider.tsx` | React context for auth state |
| `src/hooks/useAuth.ts` | Hook to consume auth context |
| `src/types/auth.ts` | TypeScript types for auth entities |
| `app/login.tsx` | Login screen |
| `app/register.tsx` | Registration screen |
| `app.config.js` | Dynamic Expo config (API URL) |

## Verification Checklist

- [ ] App starts without login prompt (anonymous baseline)
- [ ] Settings shows "Entrar" and "Criar conta" when not logged in
- [ ] Registration creates account and auto-logs in
- [ ] Login persists across app restart
- [ ] Logout clears credentials, keeps local lessons
- [ ] New lessons tagged with logged-in user's ID
- [ ] Home filters lessons by current user when logged in
- [ ] Export includes collector identity when logged in
- [ ] All 109 existing tests still pass
