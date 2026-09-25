import { useState } from "react";
import "../styles/search.css";

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    onSearch(query.trim());
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrapper">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search businesses, services..."
          aria-label="Search businesses and services"
        />

        <button type="submit">Search</button>
      </div>
    </form>
  );
}

export default SearchBar;