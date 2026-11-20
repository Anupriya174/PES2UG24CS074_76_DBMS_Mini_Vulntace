"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommentForm({ reportId }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not add the comment");
    setText("");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="comment">Add a comment</label>
      <textarea id="comment" value={text} onChange={(e) => setText(e.target.value)} required />
      <div style={{ marginTop: 10 }}>
        <button disabled={busy || !text.trim()}>Post comment</button>
      </div>
      {error && <p className="msg error">{error}</p>}
    </form>
  );
}
