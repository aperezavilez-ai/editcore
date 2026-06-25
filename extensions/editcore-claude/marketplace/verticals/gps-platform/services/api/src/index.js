import Fastify from 'fastify';

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT || 4100);

app.get('/health', async () => ({ ok: true, service: 'gps-api' }));

app.get('/devices', async () => ({
  devices: [{ id: 'demo-1', imei: '350000000000001', lastSeen: new Date().toISOString() }],
}));

app.get('/positions/latest', async () => ({
  positions: [{ deviceId: 'demo-1', lat: -34.6, lng: -58.38, speed: 42, ts: Date.now() }],
}));

app.listen({ port, host: '0.0.0.0' });
