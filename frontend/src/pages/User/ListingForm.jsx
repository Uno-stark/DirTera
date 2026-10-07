import { useEffect, useRef, useState, useCallback } from "react";
import { ImagePlus, Upload, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import api from "../../api/client";
import "../../styles/listing-form.css";

const MAX_GALLERY  = 3;
const MAX_LOGO_MB  = 2;
const MAX_IMG_MB   = 5;
const ACCEPTED     = "image/jpeg,image/png,image/webp,image/gif";
const TOTAL_STEPS  = 4;

// ── Social platforms config ───────────────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  {
    key:         "linkedin",
    label:       "LinkedIn",
    placeholder: "company/your-business",
    prefix:      "https://linkedin.com/",
    icon:        "in",
  },
  {
    key:         "tiktok",
    label:       "TikTok",
    placeholder: "@yourbusiness",
    prefix:      "https://tiktok.com/",
    icon:        "tt",
  },
  {
    key:         "instagram",
    label:       "Instagram",
    placeholder: "yourbusiness",
    prefix:      "https://instagram.com/",
    icon:        "ig",
  },
  {
    key:         "facebook",
    label:       "Facebook",
    placeholder: "your.page.name",
    prefix:      "https://facebook.com/",
    icon:        "fb",
  },
];

// Serialize { linkedin, tiktok, instagram, facebook } → JSON string for backend
// Strips empty values so the JSON is clean. Returns null when all empty.
function serializeSocials(socials) {
  const out = {};
  for (const { key, prefix } of SOCIAL_PLATFORMS) {
    const raw = socials[key]?.trim();
    if (!raw) continue;
    // If user pasted a full URL already, keep it; otherwise prepend prefix
    out[key] = /^https?:\/\//i.test(raw) ? raw : `${prefix}${raw.replace(/^@/, "")}`;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

// Parse JSON string from backend → { linkedin, tiktok, instagram, facebook }
// Each value is stripped back to the handle/path for display in the input.
function parseSocials(jsonStr) {
  const empty = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ""]));
  if (!jsonStr) return empty;
  try {
    const obj = JSON.parse(jsonStr);
    const result = { ...empty };
    for (const { key, prefix } of SOCIAL_PLATFORMS) {
      if (obj[key]) {
        // Strip the known prefix so the user sees just the handle
        result[key] = obj[key].startsWith(prefix)
          ? obj[key].slice(prefix.length)
          : obj[key];
      }
    }
    return result;
  } catch {
    return empty;
  }
}

const EMPTY_SOCIALS = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ""]));

const EMPTY_FORM = {
  name: "", url: "", short_description: "", full_description: "",
  category_slug: "", domain_slug: "", tags: "",
  contact_email: "", phone_number: "",
};

const STEP_META = [
  { label: "Identity",  hint: "Name & description" },
  { label: "Category",  hint: "Type & tags"         },
  { label: "Media",     hint: "Logo & photos"       },
  { label: "Contact",   hint: "Email & socials"     },
];

// ── Tiny image upload slot ────────────────────────────────────────────────────
function ImageSlot({ label, previewUrl, onUpload, onDelete, uploading, variant = "square" }) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div className={`lf2-slot lf2-slot--${variant}${previewUrl ? " lf2-slot--filled" : ""}`}>
      {previewUrl ? (
        <>
          <img src={previewUrl} alt={label} className="lf2-slot-img" loading="lazy" />
          <div className="lf2-slot-overlay">
            <button type="button" className="lf2-slot-replace"
              onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload size={11} />
              {uploading ? "…" : "Replace"}
            </button>
            <button type="button" className="lf2-slot-del"
              onClick={onDelete} disabled={uploading}>
              <X size={11} />
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="lf2-slot-empty"
          onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading
            ? <span className="lf2-uploading">…</span>
            : <ImagePlus size={14} />}
          <span>{uploading ? "Uploading" : label}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED}
        onChange={handleFile} style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="lf2-field">
      <label className="lf2-label">
        {label}{required && <span className="lf2-req"> *</span>}
      </label>
      {children}
      {hint && <small className="lf2-hint">{hint}</small>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function ListingForm({ isOpen, onClose, websiteId }) {
  const isEdit = Boolean(websiteId);

  const [step,            setStep]           = useState(0);
  const [slideDir,        setSlideDir]       = useState("forward"); // "forward"|"back"
  const [animating,       setAnimating]      = useState(false);

  const [form,            setForm]           = useState(EMPTY_FORM);
  const [socials,         setSocials]        = useState(EMPTY_SOCIALS);
  const [categories,      setCategories]     = useState([]);
  const [domains,         setDomains]        = useState([]);
  const [loadingCats,     setLoadingCats]    = useState(true);
  const [loadingDomains,  setLoadingDomains] = useState(false);
  const [loadingListing,  setLoadingListing] = useState(false);
  const [submitting,      setSubmitting]     = useState(false);
  const [error,           setError]          = useState("");

  const [savedId,         setSavedId]        = useState(isEdit ? websiteId : null);
  const [logoUrl,         setLogoUrl]        = useState(null);
  const [thumbnailUrl,    setThumbnailUrl]   = useState(null);
  const [galleryUrls,     setGalleryUrls]    = useState([]);
  const [logoUploading,   setLogoUploading]  = useState(false);
  const [thumbUploading,  setThumbUploading] = useState(false);
  const [imgUploading,    setImgUploading]   = useState(false);
  const [imgErrors,       setImgErrors]      = useState([]);
  const [done,            setDone]           = useState(false);

  // ── Reset when modal opens ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setSlideDir("forward");
    setError("");
    setImgErrors([]);
    setDone(false);
    if (!isEdit) {
      setForm(EMPTY_FORM);
      setSocials(EMPTY_SOCIALS);
      setSavedId(null);
      setLogoUrl(null);
      setThumbnailUrl(null);
      setGalleryUrls([]);
    }
  }, [isOpen, isEdit]);

  // ── Load categories once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    api.get("/api/v1/categories")
      .then(({ data }) => setCategories(data))
      .catch(() => setError("Couldn't load categories."))
      .finally(() => setLoadingCats(false));
  }, [isOpen]);

  // ── Load domains on category change ───────────────────────────────────────
  useEffect(() => {
    if (!form.category_slug) { setDomains([]); return; }
    setLoadingDomains(true);
    api.get("/api/v1/domains", { params: { category_slug: form.category_slug } })
      .then(({ data }) => setDomains(data))
      .catch(() => setDomains([]))
      .finally(() => setLoadingDomains(false));
  }, [form.category_slug]);

  // ── Load existing listing in edit mode ────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !isOpen) return;
    setLoadingListing(true);
    api.get("/api/v1/websites/my")
      .then(({ data }) => {
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
        });
        setSocials(parseSocials(listing.social_links || ""));
        setLogoUrl(listing.logo_url || null);
        setThumbnailUrl(listing.thumbnail_url || null);
        setGalleryUrls(listing.image_urls || []);
      })
      .catch((err) => {
        const d = err.response?.data?.detail;
        setError(Array.isArray(d) ? d.map((i) => i.msg).join(" ") : d || "Couldn't load listing.");
      })
      .finally(() => setLoadingListing(false));
  }, [isEdit, websiteId, isOpen]);

  // ── Form change ────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "category_slug" ? { domain_slug: "" } : {}),
    }));
  };

  // ── Step navigation ────────────────────────────────────────────────────────
  const goTo = useCallback((target) => {
    if (animating) return;
    setSlideDir(target > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 220);
  }, [animating, step]);

  const next = () => goTo(step + 1);
  const back = () => goTo(step - 1);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() || null])
      );
      payload.social_links = serializeSocials(socials);

      if (step === 1) {
        // Step 1 — create or patch, then advance to Media
        if (isEdit) {
          await api.patch(`/api/v1/websites/${websiteId}`, payload);
        } else {
          const { data } = await api.post("/api/v1/websites", payload);
          setSavedId(data.id);
        }
        goTo(2);
      } else if (step === 3) {
        // Step 3 — final save
        const id = savedId ?? websiteId;
        await api.patch(`/api/v1/websites/${id}`, payload);
        setDone(true);
      }
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(Array.isArray(d) ? d.map((i) => i.msg).join(" ") : d || "Couldn't save listing.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Image helpers ──────────────────────────────────────────────────────────
  const addImgError = (msg) => setImgErrors((p) => [...p, msg]);

  const validateSize = (file, maxMb) => {
    if (file.size > maxMb * 1024 * 1024) {
      addImgError(`File too large — max ${maxMb} MB.`);
      return false;
    }
    return true;
  };

  const uploadLogo = async (file) => {
    if (!savedId) { addImgError("Save the listing first."); return; }
    if (!validateSize(file, MAX_LOGO_MB)) return;
    setLogoUploading(true); setImgErrors([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post(`/api/v1/websites/${savedId}/images/logo`, fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setLogoUrl(data.url);
    } catch (err) { addImgError(err.response?.data?.detail || "Logo upload failed."); }
    finally { setLogoUploading(false); }
  };

  const deleteLogo = async () => {
    if (!savedId) return;
    setLogoUploading(true);
    try { await api.delete(`/api/v1/websites/${savedId}/images/logo`); setLogoUrl(null); }
    catch { addImgError("Failed to remove logo."); }
    finally { setLogoUploading(false); }
  };

  const uploadThumbnail = async (file) => {
    if (!savedId) { addImgError("Save the listing first."); return; }
    if (!validateSize(file, MAX_IMG_MB)) return;
    setThumbUploading(true); setImgErrors([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post(`/api/v1/websites/${savedId}/images/thumbnail`, fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setThumbnailUrl(data.url);
    } catch (err) { addImgError(err.response?.data?.detail || "Thumbnail upload failed."); }
    finally { setThumbUploading(false); }
  };

  const deleteThumbnail = async () => {
    if (!savedId) return;
    setThumbUploading(true);
    try { await api.delete(`/api/v1/websites/${savedId}/images/thumbnail`); setThumbnailUrl(null); }
    catch { addImgError("Failed to remove thumbnail."); }
    finally { setThumbUploading(false); }
  };

  const uploadGallery = async (file) => {
    if (!savedId) { addImgError("Save the listing first."); return; }
    if (galleryUrls.length >= MAX_GALLERY) { addImgError(`Max ${MAX_GALLERY} images.`); return; }
    if (!validateSize(file, MAX_IMG_MB)) return;
    setImgUploading(true); setImgErrors([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post(`/api/v1/websites/${savedId}/images`, fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setGalleryUrls(data.image_urls || []);
    } catch (err) { addImgError(err.response?.data?.detail || "Image upload failed."); }
    finally { setImgUploading(false); }
  };

  const deleteGallery = async (index) => {
    if (!savedId) return;
    setImgUploading(true);
    try {
      await api.delete(`/api/v1/websites/${savedId}/images/${index}`);
      setGalleryUrls((p) => p.filter((_, i) => i !== index));
    } catch { addImgError("Failed to remove image."); }
    finally { setImgUploading(false); }
  };

  const imagesUnlocked = Boolean(savedId);

  // ── Backdrop click close ───────────────────────────────────────────────────
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="lf2-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
        <div className="lf2-modal">
          <div className="lf2-done">
            <div className="lf2-done-icon"><Check size={28} /></div>
            <h3>{isEdit ? "Listing updated" : "Listing submitted"}</h3>
            <p>{isEdit
              ? "Your changes have been saved."
              : "Your listing is under review and will go live once approved."
            }</p>
            <button className="lf2-btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingListing) {
    return (
      <div className="lf2-backdrop" role="dialog" aria-modal="true">
        <div className="lf2-modal lf2-modal--loading">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  // ── Step content ───────────────────────────────────────────────────────────
  const steps = [
    /* 0 — Identity */
    <div className="lf2-step-content" key="identity">
      <div className="lf2-row">
        <Field label="Business name" required>
          <input name="name" value={form.name} onChange={handleChange}
            placeholder="e.g. Habesha Coffee" required autoFocus />
        </Field>
        <Field label="Website URL" required>
          <input name="url" type="url" value={form.url} onChange={handleChange}
            placeholder="https://example.com" required />
        </Field>
      </div>
      <Field label="Short description" required hint="Up to 160 chars — shown in directory cards.">
        <input name="short_description" value={form.short_description}
          onChange={handleChange} maxLength={160} required
          placeholder="What does your business do, in one sentence?" />
      </Field>
      <Field label="Full description" hint="Up to 2,000 chars — detail page overview.">
        <textarea name="full_description" value={form.full_description}
          onChange={handleChange} rows={3}
          placeholder="Tell people what you offer, who it's for, and what makes it useful." />
      </Field>
    </div>,

    /* 1 — Category */
    <div className="lf2-step-content" key="category">
      <div className="lf2-row">
        <Field label="Category" required hint="Start with the broadest fit, e.g. Technology.">
          <select name="category_slug" value={form.category_slug}
            onChange={handleChange} disabled={loadingCats}>
            <option value="">{loadingCats ? "Loading…" : "Select a category"}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Domain" required hint="Then choose a subcategory, e.g. Open Source.">
          <select name="domain_slug" value={form.domain_slug}
            onChange={handleChange}
            disabled={!form.category_slug || loadingDomains}>
            <option value="">
              {!form.category_slug ? "Choose a category first"
                : loadingDomains ? "Loading…" : "Select a domain"}
            </option>
            {domains.map((d) => (
              <option key={d.slug} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Tags" hint="Add up to 5 relevant tags, separated by commas.">
        <input name="tags" value={form.tags} onChange={handleChange}
          placeholder="e.g. Community, Developer Tools, Free Resources" />
      </Field>
    </div>,

    /* 2 — Media */
    <div className="lf2-step-content" key="media">
      {!imagesUnlocked && (
        <p className="lf2-media-notice">
          Complete step 1 &amp; 2 and save to unlock image uploads.
        </p>
      )}
      {imgErrors.length > 0 && (
        <div className="lf2-error" role="alert">
          {imgErrors.map((e, i) => <span key={i}>{e}</span>)}
        </div>
      )}
      <div className="lf2-media-row">
        {/* Logo */}
        <div className="lf2-media-item">
          <span className="lf2-media-label">Logo <small>400×400 · PNG/JPG · 2 MB</small></span>
          <ImageSlot
            label="Logo"
            previewUrl={logoUrl}
            onUpload={imagesUnlocked ? uploadLogo : () => addImgError("Save listing first.")}
            onDelete={deleteLogo}
            uploading={logoUploading}
            variant="logo"
          />
        </div>
        {/* Thumbnail */}
        <div className="lf2-media-item lf2-media-item--wide">
          <span className="lf2-media-label">Cover photo <small>1600X600 · PNG/JPG · 5 MB</small></span>
          <ImageSlot
            label="Cover"
            previewUrl={thumbnailUrl}
            onUpload={imagesUnlocked ? uploadThumbnail : () => addImgError("Save listing first.")}
            onDelete={deleteThumbnail}
            uploading={thumbUploading}
            variant="wide"
          />
        </div>
      </div>
      {/* Gallery */}
      <div className="lf2-gallery-label">
        <span className="lf2-media-label">Gallery photos <small>Up to {MAX_GALLERY}</small></span>
        <div className="lf2-gallery-grid">
          {galleryUrls.map((url, i) => (
            <ImageSlot key={i} label={`Photo ${i + 1}`} previewUrl={url}
              onUpload={uploadGallery} onDelete={() => deleteGallery(i)}
              uploading={imgUploading} variant="square" />
          ))}
          {galleryUrls.length < MAX_GALLERY && (
            <ImageSlot label="Add" previewUrl={null}
              onUpload={imagesUnlocked ? uploadGallery : () => addImgError("Save listing first.")}
              onDelete={() => {}} uploading={imgUploading} variant="square" />
          )}
        </div>
      </div>
    </div>,

    /* 3 — Contact */
    <div className="lf2-step-content" key="contact">
      <div className="lf2-row">
        <Field label="Email" hint="Optional.">
          <input name="contact_email" type="email"
            value={form.contact_email} onChange={handleChange}
            placeholder="hello@yourwebsite.com" />
        </Field>
        <Field label="Phone" hint="Optional.">
          <input name="phone_number" type="tel"
            value={form.phone_number} onChange={handleChange}
            placeholder="+1 (555) 000-0000" />
        </Field>
      </div>
      <Field label="Social links" hint="Optional. Enter just the handle or page name — no need for the full URL.">
        <div className="lf2-socials">
          {SOCIAL_PLATFORMS.map(({ key, label, placeholder, icon }) => (
            <div key={key} className="lf2-social-row">
              <span className="lf2-social-icon" data-platform={key}>{icon}</span>
              <span className="lf2-social-label">{label}</span>
              <input
                type="text"
                value={socials[key]}
                onChange={(e) =>
                  setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </Field>
    </div>,
  ];

  return (
    <div className="lf2-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true"
      aria-label={isEdit ? "Edit listing" : "Add listing"}>
      <div className="lf2-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="lf2-header">
          <div className="lf2-header-titles">
            <h2>{isEdit ? "Edit listing" : "Add a listing"}</h2>
            <p>{STEP_META[step].hint}</p>
          </div>
          <button className="lf2-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Step indicator ──────────────────────────────────────── */}
        <div className="lf2-steps">
          {STEP_META.map((s, i) => (
            <button key={i} type="button"
              className={`lf2-step-dot${i === step ? " lf2-step-dot--active" : ""}${i < step ? " lf2-step-dot--done" : ""}`}
              onClick={() => i < step && goTo(i)}
              aria-label={s.label}
              title={s.label}
              disabled={i > step}>
              {i < step ? <Check size={10} /> : <span>{i + 1}</span>}
            </button>
          ))}
          <div className="lf2-step-track">
            <div className="lf2-step-fill" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }} />
          </div>
        </div>

        {/* ── Step label ──────────────────────────────────────────── */}
        <div className="lf2-step-label">
          <span className="lf2-step-num">{step + 1} / {TOTAL_STEPS}</span>
          <span className="lf2-step-name">{STEP_META[step].label}</span>
        </div>

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && <div className="lf2-error" role="alert">{error}</div>}

        {/* ── Sliding content ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className={`lf2-slide-wrap${animating ? ` lf2-slide-wrap--${slideDir}` : ""}`}>
            {steps[step]}
          </div>

          {/* ── Footer nav ────────────────────────────────────────── */}
          <div className="lf2-footer">
            {step > 0 ? (
              <button type="button" className="lf2-btn-back" onClick={back}>
                <ChevronLeft size={15} /> Back
              </button>
            ) : (
              <button type="button" className="lf2-btn-back" onClick={onClose}>
                Cancel
              </button>
            )}

            <div className="lf2-footer-right">
              {/* On step 2 (Media), Next is non-saving */}
              {step === 2 && (
                <button type="button" className="lf2-btn-primary" onClick={next}>
                  Next <ChevronRight size={15} />
                </button>
              )}

              {/* Step 0: Next (no save yet) */}
              {step === 0 && (
                <button type="button" className="lf2-btn-primary" onClick={next}
                  disabled={!form.name.trim() || !form.url.trim() || !form.short_description.trim()}>
                  Next <ChevronRight size={15} />
                </button>
              )}

              {/* Step 1: Save & continue (creates listing) */}
              {step === 1 && (
                <button type="submit" className="lf2-btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : isEdit ? "Save & continue" : "Save & continue"}
                  {!submitting && <ChevronRight size={15} />}
                </button>
              )}

              {/* Step 3: Final submit */}
              {step === 3 && (
                <button type="submit" className="lf2-btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : isEdit ? "Save changes" : "Submit listing"}
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

export default ListingForm;
