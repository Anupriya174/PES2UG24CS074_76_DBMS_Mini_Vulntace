"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["Open", "Triaged", "In Progress", "Fixed", "Closed", "Duplicate"];

export default function StaffActions({ reportId, status, triagers, severities }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(path, body, okText) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/reports/${reportId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ type: "error", text: data.error || "Something went wrong" });
    setMsg({ type: "ok", text: okText });
    router.refresh();
  }

  function assign(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    send(
      "assign",
      { triager_id: Number(f.get("triager")), severity_id: Number(f.get("severity")) },
      "Report assigned and triaged"
    );
  }

  function changeStatus(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    send("status", { status: f.get("status") }, "Status updated");
  }

  return (
    <div className="card">
      <h2>Triage</h2>
      <form onSubmit={assign}>
        <label htmlFor="triager">Assign to</label>
        <select id="triager" name="triager" required>
          {triagers.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.name}
            </option>
          ))}
        </select>
        <label htmlFor="severity">Severity</label>
        <select id="severity" name="severity" defaultValue={severities[2]?.severity_id} required>
          {severities.map((s) => (
            <option key={s.severity_id} value={s.severity_id}>
              {s.level_name} ({s.score})
            </option>
          ))}
        </select>
        <div style={{ marginTop: 12 }}>
          <button disabled={busy}>Assign and triage</button>
        </div>
      </form>

      <form onSubmit={changeStatus} style={{ marginTop: 18 }}>
        <label htmlFor="status">Change status</label>
        <select id="status" name="status" defaultValue={status}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div style={{ marginTop: 12 }}>
          <button className="secondary" disabled={busy}>
            Update status
          </button>
        </div>
      </form>
      {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
