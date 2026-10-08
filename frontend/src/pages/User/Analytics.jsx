import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import api from "../../api/client";
import { fetchMyListings, keys } from "../../api/queries";
import "../../styles/analytics.css";

function Analytics() {
  const { websiteId } = useParams();

  const { data: listingsData, isLoading } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 2 * 60_000,
  });

  const listings = (listingsData?.items ?? []).filter((l) => l.status === "approved");

  // Pre-select listing from URL param, or default to first
  const [selectedId, setSelectedId] = useState(
    websiteId && listings.some((l) => l.id === websiteId) ? websiteId : ""
  );

  // Resolve selectedId once listings load
  const resolvedId = selectedId || listings[0]?.id || "";

  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    if (!resolvedId) return;
    setExporting(true);
    setExportError("");
    try {
      const res = await api.get(`/api/v1/analytics/${resolvedId}/export`, {
        responseType: "blob",
      });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `clicks_${resolvedId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="an-page">
      <div className="an-container">

        <div className="an-header">
          <Link to="/dashboard" className="an-back">
            <ArrowLeft size={14} strokeWidth={2.5} /> Back to dashboard
          </Link>
          <h1>Export clicks</h1>
          <p>Download your click data as a CSV file.</p>
        </div>

        {isLoading && <div className="an-state">Loading listings…</div>}

        {!isLoading && listings.length === 0 && (
          <div className="an-empty">
            <p>No approved listings. Exports are available once a listing is approved.</p>
          </div>
        )}

        {!isLoading && listings.length > 0 && (
          <div className="an-export-card">
            <div className="an-export-field">
              <label htmlFor="an-listing">Listing</label>
              <select
                id="an-listing"
                className="an-select"
                value={resolvedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {exportError && (
              <p className="an-state an-state--error" role="alert">{exportError}</p>
            )}

            <button
              type="button"
              className="an-export-btn"
              onClick={handleExport}
              disabled={exporting || !resolvedId}
            >
              <Download size={14} strokeWidth={2.5} />
              {exporting ? "Exporting…" : "Download CSV"}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

export default Analytics;
