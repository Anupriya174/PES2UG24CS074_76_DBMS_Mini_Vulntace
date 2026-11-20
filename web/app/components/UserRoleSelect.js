"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserRoleSelect({ userId, roleId, roles, disabled }) {
  const router = useRouter();
  const [error, setError] = useState(null);

  async function change(e) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role_id: Number(e.target.value) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Could not change role");
    router.refresh();
  }

  return (
    <>
      <select defaultValue={roleId} onChange={change} disabled={disabled} aria-label="Role" style={{ width: "auto" }}>
        {roles.map((r) => (
          <option key={r.role_id} value={r.role_id}>
            {r.role_name}
          </option>
        ))}
      </select>
      {error && <span className="msg error"> {error}</span>}
    </>
  );
}
