import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Upload, X, Image as ImageIcon, Plus } from "lucide-react";
import api from "../../api/client";
import "../../styles/listing-form.css";

const MAX_GALLERY = 3;
const MAX_LOGO_MB = 2;
const MAX_IMG_MB  = 5;
const ACCEPTED    = "image/jpeg,image/png,image/webp,image/gif";

const emptyForm = {
  name: "",
  url: "",
  short_description: "",
  full_description: "",
  category_slug: "",
  domain_slug: "",
  tags: "",
  contact_email: "",
  phone_number: "",
  social_links: "",
};

// ── Single image upload slot ───────────────────────────────────────────────────
function ImageSlot({ label, previewUrl, onUpload, onDelete, uploading, hint, accept = ACCEPTED }) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    // Reset so same file can be re-selected after removal
    e.target.value = "";
  };

  return (
    <div className={`img-slot ${previewUrl ? "img-slot-filled" : ""}`}>
      {previewUrl ? (
        <>
          <img src={previewUrl} alt={label} className="img-slot-preview" />
          <div className="img-slot-overlay">
            <button
              type="button"
              className="img-slot-replace"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title="Replace image"
            >
              <Upload size={14} />
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              className="img-slot-delete"
              onClick={onDelete}
              disabled={uploading}
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="img-slot-empty"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="img-slot-uploading">Uploading…</span>
          ) : (
            <>
              <ImageIcon size={20} className="img-slot-icon" />
              <span>{label}</span>
              {hint && <small>{hint}</small>}
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="img-slot-input"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
function ListingForm() {
  const navigate    = useNavigate();
  const { websiteId } = useParams();
  const isEditMode  = Boolean(websiteId);

  // Text form state
  const [form,               setForm]               = useState(emptyForm);
  const [categories,         setCategories]         = useState([]);
  const [domains,            setDomains]            = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingDomains,   setIsLoadingDomains]   = useState(false);
  const [isLoadingListing,   setIsLoadingListing]   = useState(isEditMode);
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [error,              setError]              = useState("");

  // Saved listing ID (set after create, or from URL in edit mode)
  const [savedId, setSavedId] = useState(websiteId || null);

  // Image state
  const [logoUrl,       setLogoUrl]       = useState(null);
  const [galleryUrls,   setGalleryUrls]   = useState([]);   // up to MAX_GALLERY
  const [logoUploading, setLogoUploading] = useState(false);
  const [imgUploading,  setImgUploading]  = useState(false);
  const [imgErrors,     setImgErrors]     = useState([]);   // per-operation errors

  // ── Load categories ────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/v1/categories")
      .then(({ data }) => setCategories(data))
      .catch(() => setError("We couldn't load categories."))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  // ── Load domains when category changes ────────────────────────────────────
  useEffect(() => {
    if (!form.category_slug) { setDomains([]); return; }
    setIsLoadingDomains(true);
    api.get("/api/v1/domains", { params: { category_slug: form.category_slug } })
      .then(({ data }) => setDomains(data))
      .catch(() => setDomains([]))
      .finally(() => setIsLoadingDomains(false));
  }, [form.category_slug]);

  // ── Load existing listing in edit mode ────────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    const load = async () => {
      try {
        // Edit mode uses the owner endpoint so we get full data including URL
        const { data } = await api.get(`/api/v1/websites/my`);
        // Find the specific listing
        const listing = data.items?.find((l) => l.id === websiteId);
        if (!listing) throw new Error("Not found");

        setForm({
          name:              listing.name              || "",
          url:               listing.url               || "",
          short_description: listing.short_description || "",
          full_description:  listing.full_description  || "",
          category_slug:     listing.category_slug     || "",
          domain_slug:       listing.domain_slug       || "",
          tags:              listing.tags              || "",
          contact_email:     listing.contact_email     || "",
          phone_number:      listing.phone_number      || "",
          social_links:      listing.social_links      || "",
        });

        setLogoUrl(listing.logo_url || null);
        setGalleryUrls(listing.image_urls || []);
      } catch (err) {
        const detail = err.response?.data?.detail;
        setError(Array.isArray(detail) ? detail.map((i) => i.msg).join(" ") : detail || "We couldn't load this listing.");
      } finally {
        setIsLoadingListing(false);
      }
    };
    load();
  }, [isEditMode, websiteId]);

  // ── Form field change ──────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "category_slug" ? { domain_slug: "" } : {}),
    }));
  };

  // ── Text form submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() || null])
      );

      let id = savedId;
      if (isEditMode) {
        await api.patch(`/api/v1/websites/${websiteId}`, payload);
        id = websiteId;
      } else {
        const { data } = await api.post("/api/v1/websites", payload);
        id = data.id;
        setSavedId(id);
      }

      // If no images were pending, go to dashboard
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((i) => i.msg).join(" ") : detail || (isEditMode ? "We couldn't update your listing." : "We couldn't create your listing."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Image helpers ──────────────────────────────────────────────────────────
  const addImgError = (msg) => setImgErrors((prev) => [...prev, msg]);

  const validateFileSize = (file, maxMb) => {
    if (file.size > maxMb * 1024 * 1024) {
      addImgError(`File too large. Maximum size is ${maxMb} MB.`);
      return false;
    }
    return true;
  };

  const handleLogoUpload = async (file) => {
    if (!savedId) {
      addImgError("Save the listing text first, then upload images.");
      return;
    }
    if (!validateFileSize(file, MAX_LOGO_MB)) return;

    setLogoUploading(true);
    setImgErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(
        `/api/v1/websites/${savedId}/images/logo`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setLogoUrl(data.url);
    } catch (err) {
      addImgError(err.response?.data?.detail || "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!savedId) return;
    setLogoUploading(true);
    try {
      await api.delete(`/api/v1/websites/${savedId}/images/logo`);
      setLogoUrl(null);
    } catch {
      addImgError("Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleGalleryUpload = async (file) => {
    if (!savedId) {
      addImgError("Save the listing text first, then upload images.");
      return;
    }
    if (galleryUrls.length >= MAX_GALLERY) {
      addImgError(`Maximum ${MAX_GALLERY} gallery images allowed.`);
      return;
    }
    if (!validateFileSize(file, MAX_IMG_MB)) return;

    setImgUploading(true);
    setImgErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(
        `/api/v1/websites/${savedId}/images`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setGalleryUrls(data.image_urls || []);
    } catch (err) {
      addImgError(err.response?.data?.detail || "Image upload failed.");
    } finally {
      setImgUploading(false);
    }
  };

  const handleGalleryDelete = async (index) => {
    if (!savedId) return;
    setImgUploading(true);
    try {
      await api.delete(`/api/v1/websites/${savedId}/images/${index}`);
      setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
    } catch {
      addImgError("Failed to remove image.");
    } finally {
      setImgUploading(false);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isEditMode && isLoadingListing) {
    return (
      <main className="listing-form-page">
        <div className="listing-form-container">
          <p className="listing-form-loading">Loading your listing…</p>
        </div>
      </main>
    );
  }

  const canUploadImages = Boolean(savedId);

  return (
    <main className="listing-form-page">
      <div className="listing-form-container">

        <div className="listing-form-header">
          <div>
            <Link to="/dashboard" className="listing-form-back-link">← Back to dashboard</Link>
            <h1>{isEditMode ? "Edit listing" : "Add a listing"}</h1>
            <p>
              {isEditMode
                ? "Update your website listing information."
                : "Submit your website to DirTera. Your listing will be reviewed before it goes live."}
            </p>
          </div>
        </div>

        {error && <div className="listing-form-error" role="alert">{error}</div>}

        <form className="listing-form" onSubmit={handleSubmit}>

          {/* ── Basic info ─────────────────────────────────────────── */}
          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Basic information</h2>
              <p>Tell visitors what your website is about.</p>
            </div>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Website name *</span>
                <input type="text" name="name" value={form.name} onChange={handleChange} required />
              </label>

              <label className="listing-form-field">
                <span>Website URL *</span>
                <input type="url" name="url" value={form.url} onChange={handleChange} placeholder="https://example.com" required />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Short description *</span>
                <input type="text" name="short_description" value={form.short_description} onChange={handleChange} maxLength={500} required />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Full description</span>
                <textarea name="full_description" value={form.full_description} onChange={handleChange} rows={5} />
              </label>
            </div>
          </section>

          {/* ── Category ───────────────────────────────────────────── */}
          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Category</h2>
              <p>Choose the category and domain that best match your website.</p>
            </div>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Category</span>
                <select name="category_slug" value={form.category_slug} onChange={handleChange} disabled={isLoadingCategories}>
                  <option value="">{isLoadingCategories ? "Loading…" : "Select a category"}</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </label>

              <label className="listing-form-field">
                <span>Domain</span>
                <select name="domain_slug" value={form.domain_slug} onChange={handleChange} disabled={!form.category_slug || isLoadingDomains}>
                  <option value="">{!form.category_slug ? "Select a category first" : isLoadingDomains ? "Loading…" : "Select a domain"}</option>
                  {domains.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
                </select>
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Tags</span>
                <input type="text" name="tags" value={form.tags} onChange={handleChange} placeholder="coffee, restaurant, food" />
                <small>Separate keywords with commas.</small>
              </label>
            </div>
          </section>

          {/* ── Contact ────────────────────────────────────────────── */}
          <section className="listing-form-section">
            <div className="listing-form-section-heading">
              <h2>Contact information</h2>
              <p>Optional — visitors can use this to reach you.</p>
            </div>

            <div className="listing-form-grid">
              <label className="listing-form-field">
                <span>Email</span>
                <input type="email" name="contact_email" value={form.contact_email} onChange={handleChange} />
              </label>

              <label className="listing-form-field">
                <span>Phone number</span>
                <input type="tel" name="phone_number" value={form.phone_number} onChange={handleChange} />
              </label>

              <label className="listing-form-field listing-form-field-full">
                <span>Social links</span>
                <textarea name="social_links" value={form.social_links} onChange={handleChange} rows={2} placeholder='{"facebook":"https://facebook.com/yourpage"}' />
              </label>
            </div>
          </section>

          {/* ── Submit text form ───────────────────────────────────── */}
          <div className="listing-form-actions listing-form-actions-top">
            <Link to="/dashboard" className="listing-form-secondary-button">Cancel</Link>
            <button type="submit" className="listing-form-primary-button" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? "Saving…" : "Submitting…") : (isEditMode ? "Save changes" : "Submit listing")}
            </button>
          </div>
        </form>

        {/* ── Images — separate from the text form ───────────────── */}
        <section className="listing-form-section listing-form-images-section">
          <div className="listing-form-section-heading">
            <h2>Images</h2>
            <p>
              Upload a logo and up to {MAX_GALLERY} gallery images.
              Files are compressed to WebP automatically.
              {!canUploadImages && (
                <strong className="img-note"> Save the listing first to enable uploads.</strong>
              )}
            </p>
          </div>

          {imgErrors.length > 0 && (
            <div className="listing-form-error" role="alert">
              {imgErrors.map((e, i) => <p key={i} style={{ margin: "2px 0" }}>{e}</p>)}
            </div>
          )}

          <div className="img-upload-grid">
            {/* Logo slot */}
            <div className="img-upload-group">
              <p className="img-upload-label">Logo <span className="img-upload-hint">Max {MAX_LOGO_MB} MB</span></p>
              <ImageSlot
                label="Upload logo"
                previewUrl={logoUrl}
                onUpload={handleLogoUpload}
                onDelete={handleLogoDelete}
                uploading={logoUploading}
                hint={`JPEG, PNG, WEBP — max ${MAX_LOGO_MB} MB`}
              />
            </div>

            {/* Gallery slots */}
            <div className="img-upload-group img-upload-group-gallery">
              <p className="img-upload-label">
                Gallery images
                <span className="img-upload-hint"> {galleryUrls.length}/{MAX_GALLERY} — Max {MAX_IMG_MB} MB each</span>
              </p>
              <div className="img-gallery-slots">
                {/* Existing images */}
                {galleryUrls.map((url, i) => (
                  <ImageSlot
                    key={i}
                    label={`Image ${i + 1}`}
                    previewUrl={url}
                    onUpload={handleGalleryUpload}
                    onDelete={() => handleGalleryDelete(i)}
                    uploading={imgUploading}
                  />
                ))}

                {/* Add slot — shown if under the limit */}
                {galleryUrls.length < MAX_GALLERY && (
                  <ImageSlot
                    label="Add image"
                    previewUrl={null}
                    onUpload={canUploadImages ? handleGalleryUpload : () => addImgError("Save the listing first.")}
                    onDelete={() => {}}
                    uploading={imgUploading}
                    hint={`JPEG, PNG, WEBP — max ${MAX_IMG_MB} MB`}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

export default ListingForm;
