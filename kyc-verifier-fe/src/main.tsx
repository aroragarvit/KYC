import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/layout/theme-provider.tsx';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

// Original pages
import Dashboard from './pages/dashboard.tsx';
import Documents from './pages/documents.tsx';
import Analytics from './pages/analytics.tsx';

// New pages for clients section
import Clients from './pages/clients';
import ClientCompanies from './pages/client-companies';
import CompanyDetails from './pages/company-details';

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
            {/* Original routes */}
            <Route
              path="/documents"
              element={<Documents />}
            />
            <Route
              path="/analytics"
              element={<Analytics />}
            />
            
            {/* New routes for clients section */}
            <Route
              path="/clients"
              element={<Clients />}
            />
            <Route
              path="/client-companies/:id"
              element={<ClientCompanies />}
            />
            <Route
              path="/company-details/:id"
              element={<CompanyDetails />}
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
