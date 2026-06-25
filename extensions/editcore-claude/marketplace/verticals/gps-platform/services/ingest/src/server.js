import net from 'node:net';

const port = Number(process.env.INGEST_PORT || 5027);

// Stub TCP listener — reemplazar con parser Codec8 Teltonika
const server = net.createServer((socket) => {
  socket.on('data', (buf) => {
    console.log(`[ingest] ${buf.length} bytes from ${socket.remoteAddress}`);
    // TODO: parse AVL packet, persist position
  });
  socket.on('error', (err) => console.error('[ingest] socket error', err.message));
});

server.listen(port, () => console.log(`GPS ingest listening on :${port}`));
