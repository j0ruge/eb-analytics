import jwt from 'jsonwebtoken';
import { Role } from '../generated/client/enums.js';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface JwtUser {
  sub: string;
  role: Role;
}

const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const VALID_ROLES = new Set<string>(Object.values(Role));

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ sub: user.id, role: user.role }, getSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_TTL_SECONDS,
  });
}

export function verifyToken(raw: string): JwtUser {
  const decoded = jwt.verify(raw, getSecret(), { algorithms: ['HS256'] });
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid JWT payload');
  }
  // Validate claim shape after signature verification — defense in depth
  // against secret compromise or jsonwebtoken version regressions.
  const payload = decoded as Record<string, unknown>;
  const sub = typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  const role = typeof payload.role === 'string' && VALID_ROLES.has(payload.role)
    ? (payload.role as Role)
    : null;
  if (!sub || !role) {
    throw new Error('Invalid JWT claims');
  }
  return { sub, role };
}
