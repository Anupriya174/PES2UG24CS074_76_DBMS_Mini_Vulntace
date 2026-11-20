"use client";
import { useState } from "react";

export default function ReindexButton() {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/reindex", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      res.ok
        ? { type: "ok", text: `Indexed ${data.indexed} reports in Qdrant` }
        : { type: "error", text: data.error || "Reindex failed" }
    );
  }

  return (
    <div>
      <button onClick={run} disabled={busy}>
        {busy ? "Indexing..." : "Reindex all reports"}
      </button>
      {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
