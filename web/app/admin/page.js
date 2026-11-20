import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ReindexButton from "@/app/components/ReindexButton";
import UserRoleSelect from "@/app/components/UserRoleSelect";

const fmt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "Admin") redirect("/");

  const byStatus = await query("SELECT status, COUNT(*) AS total FROM reports GROUP BY status ORDER BY total DESC");
  const byProject = await query("SELECT project_name, total_reports FROM project_report_counts ORDER BY total_reports DESC");
  const users = await query(
    `SELECT u.user_id, u.name, u.email, u.role_id FROM users u ORDER BY u.role_id DESC, u.name`
  );
  const roles = await query("SELECT role_id, role_name FROM roles ORDER BY role_id");
  const recent = await query(
    `SELECT h.report_id, h.old_status, h.new_status, h.changed_at, u.name
     FROM status_history h JOIN users u ON u.user_id = h.changed_by
     ORDER BY h.changed_at DESC, h.history_id DESC LIMIT 8`
  );

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">Users, activity and the vector index.</p>

      <div className="cols">
        <div className="card">
          <h2>Reports by status</h2>
          <table>
            <tbody>
              {byStatus.map((s) => (
                <tr key={s.status}>
                  <td>
                    <span className={`badge st-${s.status.replace(" ", "")}`}>{s.status}</span>
                  </td>
                  <td>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Reports by project</h2>
          <table>
            <tbody>
              {byProject.map((p) => (
                <tr key={p.project_name}>
                  <td>{p.project_name}</td>
                  <td>{p.total_reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Vector index</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Sends every report to the embedding service and stores its vector in Qdrant. Run this once after loading the
          seed data.
        </p>
        <ReindexButton />
      </div>

      <div className="card table-scroll">
        <h2>Users</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <UserRoleSelect userId={u.user_id} roleId={u.role_id} roles={roles} disabled={u.user_id === user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Recent status changes</h2>
        <ul className="timeline">
          {recent.map((h, i) => (
            <li key={i}>
              Report #{h.report_id}: {h.old_status} to <b>{h.new_status}</b>
              <div className="muted">
                {h.name} on {fmt(h.changed_at)}
              </div>
            </li>
          ))}
          {recent.length === 0 && <li className="muted">No status changes yet.</li>}
        </ul>
      </div>
    </>
  );
}
