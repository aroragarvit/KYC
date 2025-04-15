import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/layout/theme-provider.tsx';
import { Routes, Route } from 'react-router';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';

import Dashboard from './pages/dashboard.tsx';
import Organizations from './pages/organizations.tsx';
import Documents from './pages/documents.tsx';
import Analytics from './pages/analytics.tsx';
import OrganisationDetails from './pages/organisation-details';

import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme="dark"
        storageKey="vite-ui-theme"
      >
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={<Dashboard />}
            />
            <Route
              path="/organizations"
              element={<Organizations />}
            />

            <Route
              path="/organization/:id"
              element={<OrganisationDetails />}
            />
            <Route
              path="/documents"
              element={<Documents />}
            />
            <Route
              path="/analytics"
              element={<Analytics />}
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
