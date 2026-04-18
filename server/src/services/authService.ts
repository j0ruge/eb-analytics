import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';
import { signToken } from '../lib/jwt.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

export interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}

export interface UserDto {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  accepted: boolean;
}

export interface AuthResult {
  jwt: string;
  user: UserDto;
}

const MIN_PASSWORD_LENGTH = 8;
// Pragmatic RFC-5321 subset: local@domain.tld, no spaces, single @, a dot in domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toUserDto(row: {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  accepted: boolean;
}): UserDto {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
    accepted: row.accepted,
  };
}

export const authService = {
  async register(dto: RegisterDto): Promise<AuthResult> {
    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw httpError('password_too_short', 'A senha deve ter no mínimo 8 caracteres.', 400);
    }
    if (!EMAIL_RE.test(dto.email)) {
      throw httpError('invalid_email', 'E-mail inválido.', 400);
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw httpError('email_already_registered', 'Este e-mail já está cadastrado.', 409);
      }
      const count = await tx.user.count();
      const role: Role = count === 0 ? Role.COORDINATOR : Role.COLLECTOR;
      return tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          role,
        },
      });
    });

    return {
      jwt: signToken({ id: user.id, role: user.role }),
      user: toUserDto(user),
    };
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    const genericFailure = () =>
      httpError('invalid_credentials', 'E-mail ou senha inválidos.', 401);
    if (!user) {
      // Still hash the submitted password to keep response timing close to the
      // success path — minor defense against user-enumeration timing attacks.
      await hashPassword(password).catch(() => undefined);
      throw genericFailure();
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw genericFailure();
    }
    return {
      jwt: signToken({ id: user.id, role: user.role }),
      user: toUserDto(user),
    };
  },

  async getMe(userId: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw httpError('unauthenticated', 'Credencial ausente ou inválida.', 401);
    }
    return toUserDto(user);
  },
};
