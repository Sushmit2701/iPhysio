import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppProvider } from './ui/app-context';
import { App } from './App';
import { registerSW } from './pwa';
import { startSyncIfEnabled } from './sync/status';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

registerSW();
startSyncIfEnabled();
// Ask the browser not to evict our IndexedDB under storage pressure
void navigator.storage?.persist?.();
