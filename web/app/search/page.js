"use client";
import { useState } from "react";
import Link from "next/link";

function Results({ title, note, items, score }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
        {note}
      </p>
      {items.length === 0 && <p className="muted">Nothing found.</p>}
      {items.map((it) => (
        <div className="similar-item" key={it.report_id}>
          <span className="score">{score(it)}</span>
          <div className="grow">
            <Link href={`/reports/${it.report_id}`}>
              <span className="id">#{it.report_id}</span> {it.title}
            </Link>
            <div>
              <span className={`badge st-${(it.status || "").replace(" ", "")}`}>{it.status}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const q = new FormData(e.target).get("q");
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || "Search failed");
    setData(body);
  }

  return (
    <>
      <h1>Search reports</h1>
      <p className="sub">The same query, answered two ways. Try describing a bug in words no report uses.</p>
      <form className="card" onSubmit={search}>
        <div className="row">
          <div>
            <label htmlFor="q">Describe the problem</label>
            <input id="q" name="q" minLength={3} placeholder="attacker can skip sign-in by typing special characters" required />
          </div>
          <button disabled={busy}>Search</button>
        </div>
        {error && <p className="msg error">{error}</p>}
      </form>
      {data && (
        <div className="cols">
          <Results
            title="Keyword search (MySQL full-text)"
            note="Matches the words you typed."
            items={data.keyword}
            score={(it) => Number(it.relevance).toFixed(2)}
          />
          <div>
            <Results
              title="Semantic search (Qdrant vectors)"
              note="Matches the meaning of what you typed."
              items={data.semantic}
              score={(it) => `${Math.round(it.score * 100)}%`}
            />
            {data.semanticError && <p className="msg error">{data.semanticError}</p>}
          </div>
        </div>
      )}
    </>
  );
}
