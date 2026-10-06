import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TaxonomyProvider } from "./context/TaxonomyContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <TaxonomyProvider>
        <App />
      </TaxonomyProvider>
    </AuthProvider>
  </StrictMode>,
);
