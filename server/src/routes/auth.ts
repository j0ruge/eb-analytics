import type { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/authService.js';

interface RegisterBody {
  email: string;
  password: string;
  display_name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

const registerBodySchema = {
  type: 'object',
  required: ['email', 'password', 'display_name'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
    display_name: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const;

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const userSchema = {
  type: 'object',
  required: ['id', 'email', 'display_name', 'role', 'accepted'],
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    display_name: { type: 'string' },
    role: { type: 'string', enum: ['COORDINATOR', 'COLLECTOR'] },
    accepted: { type: 'boolean' },
  },
} as const;

const authResponseSchema = {
  type: 'object',
  required: ['jwt', 'user'],
  properties: {
    jwt: { type: 'string' },
    user: userSchema,
  },
} as const;

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RegisterBody }>(
    '/auth/register',
    {
      schema: {
        body: registerBodySchema,
        response: { 201: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.register({
        email: request.body.email,
        password: request.body.password,
        displayName: request.body.display_name,
      });
      return reply.status(201).send(result);
    },
  );

  fastify.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        body: loginBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => {
      return authService.login(request.body.email, request.body.password);
    },
  );

  fastify.get(
    '/me',
    {
      preHandler: [fastify.requireAuth],
      schema: { response: { 200: userSchema } },
    },
    async (request) => authService.getMe(request.user!.id),
  );
};

export default authRoutes;
