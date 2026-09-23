import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";
import CategoryList from "../components/CategoryList";
import BusinessList from "../components/BusinessList";
import "../styles/home.css";

function Home() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || ""
  );

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );

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

        <BusinessList
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
        />
      </main>
    </>
  );
}

export default Home;