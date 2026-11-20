"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewReportPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.target);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.get("title"),
        description: f.get("description"),
        project_id: Number(f.get("project")),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not submit the report");
    router.push(`/reports/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <h1>Submit a report</h1>
      <p className="sub">Describe the problem in your own words. Triagers see which earlier reports mean the same thing.</p>
      <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
        <label htmlFor="project">Project</label>
        <select id="project" name="project" required>
          {projects.map((p) => (
            <option key={p.project_id} value={p.project_id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" maxLength={200} required />
        <label htmlFor="description">What happened, and how can it be reproduced?</label>
        <textarea id="description" name="description" required />
        <div style={{ marginTop: 14 }}>
          <button disabled={busy}>Submit report</button>
        </div>
        {error && <p className="msg error">{error}</p>}
      </form>
    </>
  );
}
