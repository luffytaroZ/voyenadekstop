import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { storeService } from './services/storeService';
import { router } from './router';
import './styles/global.css';

// Initialize store and migrate from localStorage if needed
async function initializeApp() {
  try {
    await storeService.init();
    const migrated = await storeService.migrateFromLocalStorage();
    if (migrated) {
      console.log('[App] Migrated data from localStorage to Tauri store');
    }
  } catch (error) {
    console.error('[App] Failed to initialize store:', error);
  }
}

// Initialize and render
initializeApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      </QueryClientProvider>
    </React.StrictMode>
  );
});
