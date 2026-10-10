import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TaxonomyProvider } from "./context/TaxonomyContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30 s — no refetch during that window
      staleTime: 30_000,
      // Keep unused cache for 5 min so navigating back is instant
      gcTime: 5 * 60_000,
      // Retry failed requests once before surfacing the error
      retry: 1,
      // Refetch when the tab regains focus
      refetchOnWindowFocus: true,
      // staleTime already gates it
      refetchOnReconnect: "always",
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TaxonomyProvider>
            <App />
          </TaxonomyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
