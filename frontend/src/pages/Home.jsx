import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";
import CategoryList from "../components/CategoryList";
import BusinessList from "../components/BusinessList";
import TopListings from "../components/TopListings";
import MultiCategoryFeed from "../components/MultiCategoryFeed";
import PremieredListings from "../components/PremieredListings";
import "../styles/home.css";

function Home() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || ""
  );

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );

  // Slugs used to drive MultiCategoryFeed — loaded once on mount
  const [categorySlugs, setCategorySlugs] = useState([]);

  useEffect(() => {
    api.get("/api/v1/categories")
      .then(({ data }) =>
        setCategorySlugs(
          (Array.isArray(data) ? data : data.items ?? [])
            .filter((c) => c.is_active !== false)
            .slice(0, 10)
            .map((c) => c.slug)
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";

    setSelectedCategory(category);
    setSearchQuery(search);
  }, [searchParams]);

  const handleCategorySelect = (category) => {
    const nextParams = new URLSearchParams(searchParams);

    if (category) {
      nextParams.set("category", category);
    } else {
      nextParams.delete("category");
    }

    setSearchParams(nextParams);
  };

  const handleSearch = (query) => {
    const nextParams = new URLSearchParams(searchParams);

    if (query) {
      nextParams.set("search", query);
    } else {
      nextParams.delete("search");
    }

    setSearchParams(nextParams);
  };

  return (
    <>
      <Navbar />

      <main>
        <section className="home-hero">
          <div className="home-container">
            <p className="hero-label">DirTera Business Directory</p>

            <h1>Find businesses and services near you.</h1>

            <p className="hero-description">
              Search local businesses, services, and places in one directory.
            </p>

            <SearchBar
              onSearch={handleSearch}
            />
          </div>
        </section>

        <CategoryList
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />

        {!selectedCategory && !searchQuery && (
          <PremieredListings pageSize={6} sortBy="score" />
        )}

        {!selectedCategory && !searchQuery && (
          <TopListings limit={6} sortBy="score" />
        )}

        {!selectedCategory && !searchQuery && categorySlugs.length > 0 && (
          <MultiCategoryFeed
            categories={categorySlugs}
            perCategory={4}
            sortBy="score"
          />
        )}

        <BusinessList
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
        />
      </main>
    </>
  );
}

export default Home;