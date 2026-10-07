import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import "../styles/legal.css";

function Legal() {
  const { type } = useParams(); 
  const endpoint = type === "privacy" ? "/api/v1/legal/privacy" : "/api/v1/legal/terms";

  const [doc,       setDoc]       = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    setIsLoading(true);
    setDoc(null);
    api.get(endpoint)
      .then(({ data }) => setDoc(data))
      .catch(() => setError("We couldn't load this document."))
      .finally(() => setIsLoading(false));
  }, [endpoint]);

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back">← Back to DirTera</Link>

        {isLoading && <p className="legal-state">Loading…</p>}
        {!isLoading && error && <p className="legal-state legal-error">{error}</p>}

        {!isLoading && doc && (
          <article className="legal-doc">
            <header className="legal-header">
              <h1>{doc.title}</h1>
              <p className="legal-meta">
                Effective {doc.effective_date}
                {doc.version && <> &middot; Version {doc.version}</>}
              </p>
            </header>

            <div className="legal-toc">
              <p className="legal-toc-label">Contents</p>
              <ol className="legal-toc-list">
                {doc.sections.map((s) => (
                  <li key={s.heading}>
                    <a href={`#${slugify(s.heading)}`}>{s.heading}</a>
                  </li>
                ))}
              </ol>
            </div>

            <div className="legal-sections">
              {doc.sections.map((s) => (
                <section key={s.heading} id={slugify(s.heading)} className="legal-section">
                  <h2>{s.heading}</h2>
                  <p>{s.body}</p>
                </section>
              ))}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default Legal;
