import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/client";
import "../styles/listing-form.css";

function ListingForm() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [domains, setDomains] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    url: "",
    short_description: "",
    full_description: "",
    thumbnail_url: "",
    logo_url: "",
    category_slug: "",
    domain_slug: "",
    tags: "",
    contact_email: "",
    phone_number: "",
    social_links: "",
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.get("/api/v1/categories");
        setCategories(response.data);
      } catch {
        setError("We couldn't load categories.");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadDomains = async () => {
      if (!form.category_slug) {
        setDomains([]);
        return;
      }

      setIsLoadingDomains(true);
      setError("");

      try {
        const response = await api.get("/api/v1/domains", {
          params: {
            category_slug: form.category_slug,
          },
        });

        setDomains(response.data);
      } catch {
        setDomains([]);
        setError("We couldn't load domains.");
      } finally {
        setIsLoadingDomains(false);
      }
    };

    loadDomains();
  }, [form.category_slug]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "category_slug" ? { domain_slug: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          value.trim() || null,
        ])
      );

      await api.post("/api/v1/websites", payload);

      navigate("/dashboard");
    } catch (error) {
      const detail = error.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join(" ")
        );
      } else {
        setError(detail || "We couldn't create your listing.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="listing-form-page">
      <div className="listing-form-container">
        <div className="listing-form-header">
          <div>
            <Link to="/dashboard" className="listing-form-back-link">
              ? Back to dashboard
            </Link>

            <h1>Add a listing</h1>
            <p>
              Submit your website to DirTera. Your listing will be reviewed
              before it appears in the directory.
            </p>
          </div>
        </div>

        {error && (
          <div className="listing-form-error" role="alert">
            {error}
          </div>
        )}

        <form className="listing-form" onSubmit={handleSubmit}>
          <section className="listing-form-section">
            <h2>Basic information</h2>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Website name *</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Kaldi's Coffee"
                />
              </label>

              <label className="listing-form-field">
                <span>Website URL *</span>
                <input
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={handleChange}
                  required
                  placeholder="https://example.com"
                />
              </label>
            </div>

            <label className="listing-form-field">
              <span>Short description *</span>
              <textarea
                name="short_description"
                value={form.short_description}
                onChange={handleChange}
                required
                rows="3"
                placeholder="Briefly describe the website."
              />
            </label>

            <label className="listing-form-field">
              <span>Full description</span>
              <textarea
                name="full_description"
                value={form.full_description}
                onChange={handleChange}
                rows="6"
                placeholder="Give visitors more information about this website."
              />
            </label>
          </section>

          <section className="listing-form-section">
            <h2>Category</h2>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Category</span>
                <select
                  name="category_slug"
                  value={form.category_slug}
                  onChange={handleChange}
                  disabled={isLoadingCategories}
                >
                  <option value="">
                    {isLoadingCategories
                      ? "Loading categories..."
                      : "Select a category"}
                  </option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="listing-form-field">
                <span>Domain</span>
                <select
                  name="domain_slug"
                  value={form.domain_slug}
                  onChange={handleChange}
                  disabled={!form.category_slug || isLoadingDomains}
                >
                  <option value="">
                    {!form.category_slug
                      ? "Select a category first"
                      : isLoadingDomains
                        ? "Loading domains..."
                        : "Select a domain"}
                  </option>

                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.slug}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="listing-form-field">
              <span>Tags</span>
              <input
                type="text"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="coffee, restaurant, breakfast"
              />
              <small>Separate tags with commas.</small>
            </label>
          </section>

          <section className="listing-form-section">
            <h2>Contact and media</h2>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Contact email</span>
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={handleChange}
                  placeholder="hello@example.com"
                />
              </label>

              <label className="listing-form-field">
                <span>Phone number</span>
                <input
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="+251..."
                />
              </label>

              <label className="listing-form-field">
                <span>Logo URL</span>
                <input
                  type="url"
                  name="logo_url"
                  value={form.logo_url}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png"
                />
              </label>

              <label className="listing-form-field">
                <span>Thumbnail URL</span>
                <input
                  type="url"
                  name="thumbnail_url"
                  value={form.thumbnail_url}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />
              </label>
            </div>

            <label className="listing-form-field">
              <span>Social links</span>
              <textarea
                name="social_links"
                value={form.social_links}
                onChange={handleChange}
                rows="4"
                placeholder='{"facebook":"https://facebook.com/example","instagram":"https://instagram.com/example"}'
              />
              <small>Enter social links as JSON.</small>
            </label>
          </section>

          <div className="listing-form-actions">
            <Link to="/dashboard" className="listing-form-cancel">
              Cancel
            </Link>

            <button
              type="submit"
              className="listing-form-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit listing"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default ListingForm;


