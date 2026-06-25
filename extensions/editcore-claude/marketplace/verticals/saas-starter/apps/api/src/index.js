import Fastify from 'fastify';
import jwt from '@fastify/jwt';

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT || 4000);

await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

app.get('/health', async () => ({ ok: true, service: 'saas-api' }));

app.post('/auth/login', async (req, reply) => {
  const { email } = req.body as { email?: string };
  if (!email) return reply.code(400).send({ error: 'email required' });
  const token = app.jwt.sign({ sub: email, role: 'member' });
  return { token };
});

app.get('/me', { onRequest: [async (req, reply) => {
  try { await req.jwtVerify(); } catch { return reply.code(401).send({ error: 'unauthorized' }); }
}]}, async (req) => ({ user: req.user }));

app.listen({ port, host: '0.0.0.0' });
