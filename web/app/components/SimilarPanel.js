"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SimilarPanel({ reportId, isDuplicate }) {
  const router = useRouter();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`/api/reports/${reportId}/similar`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.results || []);
        if (d.error) setError(d.error);
      })
      .catch(() => {
        setItems([]);
        setError("Could not load similar reports");
      });
  }, [reportId]);

  async function markDuplicate(item) {
    if (!confirm(`Mark this report as a duplicate of #${item.report_id}?`)) return;
    setMsg(null);
    const res = await fetch(`/api/reports/${reportId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_id: item.report_id, score: item.score }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ type: "error", text: data.error || "Could not mark as duplicate" });
    setMsg({ type: "ok", text: "Marked as duplicate" });
    router.refresh();
  }

  return (
    <div className="card">
      <h2>Similar reports</h2>
      <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
        Found by meaning with vector search, not by matching words.
      </p>
      {items === null && <p className="muted">Searching...</p>}
      {error && <p className="msg error">{error}. Start the embedding service, then reindex from the Admin page.</p>}
      {items && !error && items.length === 0 && <p className="muted">No similar reports yet.</p>}
      {items &&
        items.map((it) => (
          <div className="similar-item" key={it.report_id}>
            <span className={`score ${it.score >= 0.6 ? "strong" : ""}`}>{Math.round(it.score * 100)}%</span>
            <div className="grow">
              <Link href={`/reports/${it.report_id}`}>
                <span className="id">#{it.report_id}</span> {it.title}
              </Link>
              <div>
                <span className={`badge st-${(it.status || "").replace(" ", "")}`}>{it.status}</span>
              </div>
            </div>
            {!isDuplicate && (
              <button className="secondary small" onClick={() => markDuplicate(it)}>
                Mark duplicate
              </button>
            )}
          </div>
        ))}
      {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
