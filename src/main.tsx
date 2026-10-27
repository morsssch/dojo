import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/app.css';
import { App } from './App';
import { startAutoSync } from './state/sync';

// isomorphic-git ожидает Buffer в глобальной области
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;

startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
