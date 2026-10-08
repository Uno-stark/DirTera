import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCategoriesNav, keys } from "../api/queries";

const TaxonomyContext = createContext({ categories: [], isLoading: true });

export function TaxonomyProvider({ children }) {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: keys.categoriesNav(),
    queryFn:  fetchCategoriesNav,
    
    staleTime: 5 * 60_000,
  });

  return (
    <TaxonomyContext.Provider value={{ categories, isLoading }}>
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomy() {
  return useContext(TaxonomyContext);
}
