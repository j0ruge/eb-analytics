import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { HttpError } from '../lib/errors.js';

interface FastifyLikeError {
  code?: string;
  statusCode?: number;
  validation?: unknown;
  message?: string;
}

function asFastifyError(err: unknown): FastifyLikeError {
  if (err && typeof err === 'object') {
    return err as FastifyLikeError;
  }
  return {};
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }

    const fe = asFastifyError(error);

    if (fe.validation) {
      return reply.status(400).send({ code: 'invalid_payload', message: 'Payload inválido.' });
    }

    if (fe.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send({
        code: 'batch_too_large',
        message: 'Lote excede o limite (máx. 500 coletas ou 5 MB).',
      });
    }

    if (fe.statusCode === 429) {
      return reply
        .status(429)
        .send({ code: 'rate_limited', message: 'Muitas requisições. Aguarde um instante.' });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ code: 'internal_error', message: 'Erro interno do servidor.' });
  });
};

export default fp(errorHandlerPlugin, { name: 'errorHandler' });
