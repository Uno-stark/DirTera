
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api/client";
import "../styles/listing-form.css";

const emptyForm = {
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
};

function ListingForm() {
  const navigate = useNavigate();
  const { websiteId } = useParams();
  const isEditMode = Boolean(websiteId);

  const [categories, setCategories] = useState([]);
  const [domains, setDomains] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isLoadingListing, setIsLoadingListing] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);

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
    if (!isEditMode) {
      return;
    }

    const loadListing = async () => {
      try {
        const response = await api.get(`/api/v1/websites/${websiteId}`);
        const listing = response.data;

        setForm({
          name: listing.name || "",
          url: listing.url || "",
          short_description: listing.short_description || "",
          full_description: listing.full_description || "",
          thumbnail_url: listing.thumbnail_url || "",
          logo_url: listing.logo_url || "",
          category_slug: listing.category_slug || "",
          domain_slug: listing.domain_slug || "",
          tags: listing.tags || "",
          contact_email: listing.contact_email || "",
          phone_number: listing.phone_number || "",
          social_links: listing.social_links || "",
        });
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
          setError(detail || "We couldn't load this listing.");
        }
      } finally {
        setIsLoadingListing(false);
      }
    };

    loadListing();
  }, [isEditMode, websiteId]);

  useEffect(() => {
    const loadDomains = async () => {
      if (!form.category_slug) {
        setDomains([]);
        return;
      }

      setIsLoadingDomains(true);

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

      if (isEditMode) {
        await api.patch(`/api/v1/websites/${websiteId}`, payload);
      } else {
        await api.post("/api/v1/websites", payload);
      }

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
        setError(
          detail ||
            (isEditMode
              ? "We couldn't update your listing."
              : "We couldn't create your listing.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditMode && isLoadingListing) {
    return (
      <main className="listing-form-page">
        <div className="listing-form-container">
          <p>Loading your listing...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="listing-form-page">
      <div className="listing-form-container">
        <div className="listing-form-header">
          <div>
            <Link to="/dashboard" className="listing-form-back-link">
              ← Back to dashboard
            </Link>

            <h1>{isEditMode ? "Edit listing" : "Add a listing"}</h1>

            <p>
              {isEditMode
                ? "Update your website listing information."
                : "Submit your website to DirTera. Your listing will be reviewed before it appears in the directory."}
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
            <div className="listing-form-section-heading">
              <h2>Basic information</h2>
              <p>Tell visitors what your website is about.</p>
            </div>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Website name *</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="listing-form-field">
                <span>Website URL *</span>
                <input
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  required
                />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Short description *</span>
                <input
                  type="text"
                  name="short_description"
                  value={form.short_description}
                  onChange={handleChange}
                  maxLength={500}
                  required
                />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Full description</span>
                <textarea
                  name="full_description"
                  value={form.full_description}
                  onChange={handleChange}
                  rows={6}
                />
              </label>
            </div>
          </section>

          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Category</h2>
              <p>Choose the category and domain that best match your website.</p>
            </div>

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
                    <option key={category.slug} value={category.slug}>
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
                    <option key={domain.slug} value={domain.slug}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Tags</span>
                <input
                  type="text"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  placeholder="coffee, restaurant, food"
                />
                <small>Separate keywords with commas.</small>
              </label>
            </div>
          </section>

          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Contact information</h2>
              <p>Optional information visitors can use to contact you.</p>
            </div>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Email</span>
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={handleChange}
                />
              </label>

              <label className="listing-form-field">
                <span>Phone number</span>
                <input
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Social links</span>
                <textarea
                  name="social_links"
                  value={form.social_links}
                  onChange={handleChange}
                  rows={3}
                  placeholder='{"facebook":"https://facebook.com/example"}'
                />
              </label>
            </div>
          </section>

          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Images</h2>
              <p>Add URLs for your logo and listing thumbnail.</p>
            </div>

            <div className="listing-form-grid">
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
          </section>

          <div className="listing-form-actions">
            <Link to="/dashboard" className="listing-form-secondary-button">
              Cancel
            </Link>

            <button
              type="submit"
              className="listing-form-primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isEditMode
                  ? "Saving..."
                  : "Submitting..."
                : isEditMode
                  ? "Save changes"
                  : "Submit listing"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default ListingForm;
