import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>SaaS Starter</h1>
      <p>API health: conectá con <code>/health</code> en puerto 4000.</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
