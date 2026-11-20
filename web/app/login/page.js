"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.target);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not log in");
    router.push("/");
    router.refresh();
  }

  return (
    <form className="card form-narrow" onSubmit={submit}>
      <h1>Log in to VulnTrace</h1>
      <p className="sub">Track vulnerabilities and catch duplicates by meaning.</p>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" defaultValue="meera@vulntrace.com" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required />
      <div style={{ marginTop: 16 }}>
        <button disabled={busy}>Log in</button>
      </div>
      {error && <p className="msg error">{error}</p>}
    </form>
  );
}
