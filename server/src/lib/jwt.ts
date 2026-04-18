import jwt from 'jsonwebtoken';
import type { Role } from '../generated/client/enums.js';

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
  if (typeof decoded === 'string') {
    throw new Error('Invalid JWT payload');
  }
  const payload = decoded as JwtPayload;
  return { sub: payload.sub, role: payload.role };
}
