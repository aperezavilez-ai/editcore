import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function Dashboard() {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    fetch('http://localhost:4100/positions/latest')
      .then((r) => r.json())
      .then((d) => setPositions(d.positions || []))
      .catch(() => setPositions([]));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>GPS Dashboard</h1>
      <p>Posiciones en vivo (stub):</p>
      <pre>{JSON.stringify(positions, null, 2)}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Dashboard />);
