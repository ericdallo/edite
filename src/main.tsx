import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  applyAccent,
  applyReduceMotion,
  applyTheme,
  loadAccent,
  loadReduceMotion,
  loadTheme,
} from './lib/theme';
import './index.css';

// Apply saved appearance prefs before first paint to avoid a flash.
applyTheme(loadTheme());
applyAccent(loadAccent());
applyReduceMotion(loadReduceMotion());

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
