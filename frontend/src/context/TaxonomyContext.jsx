import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const TaxonomyContext = createContext({ categories: [], isLoading: true });

export function TaxonomyProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    api
      .get("/api/v1/categories/with-domains")
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]))   // fail silently — nav still renders
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <TaxonomyContext.Provider value={{ categories, isLoading }}>
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomy() {
  return useContext(TaxonomyContext);
}
