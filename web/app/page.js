import Link from "next/link";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";

const STATUSES = ["Open", "Triaged", "In Progress", "Fixed", "Closed", "Duplicate"];

export default async function Dashboard({ searchParams }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const staff = user.role !== "Reporter";
  const status = STATUSES.includes(searchParams?.status) ? searchParams.status : null;

  // Reporters only ever see their own reports.
  const where = [];
  const params = [];
  if (!staff) {
    where.push("r.submitted_by = ?");
    params.push(user.id);
  }
  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }

  const reports = await query(
    `SELECT r.report_id, r.title, r.status, r.created_at,
            p.name AS project, s.level_name AS severity, a.name AS assignee
     FROM reports r
     JOIN projects p ON p.project_id = r.project_id
     LEFT JOIN severity_levels s ON s.severity_id = r.severity_id
     LEFT JOIN users a ON a.user_id = r.assigned_to
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY s.score IS NULL, s.score DESC, r.created_at DESC`,
    params
  );

  const counts = await query(
    `SELECT status, COUNT(*) AS total FROM reports r ${staff ? "" : "WHERE r.submitted_by = ?"} GROUP BY status`,
    staff ? [] : [user.id]
  );
  const countOf = Object.fromEntries(counts.map((c) => [c.status, c.total]));
  const all = counts.reduce((sum, c) => sum + c.total, 0);

  return (
    <>
      <h1>{staff ? "Triage queue" : "My reports"}</h1>
      <p className="sub">
        {staff ? "Highest severity first. Unrated reports come last." : "Reports you have submitted."}
      </p>

      <div className="stats">
        <Link href="/" className={`stat ${!status ? "active" : ""}`}>
          <b>{all}</b>All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/?status=${encodeURIComponent(s)}`} className={`stat ${status === s ? "active" : ""}`}>
            <b>{countOf[s] || 0}</b>
            {s}
          </Link>
        ))}
      </div>

      <div className="card table-scroll">
        {reports.length === 0 ? (
          <p className="muted">
            No reports here yet. <Link href="/reports/new">Submit the first report</Link>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th>Project</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.report_id} className={`report-row sev-${r.severity || "None"}`}>
                  <td>
                    <span className="id">#{r.report_id}</span>{" "}
                    <Link href={`/reports/${r.report_id}`}>{r.title}</Link>
                  </td>
                  <td>{r.project}</td>
                  <td className="sev-label">{r.severity || "Not rated"}</td>
                  <td>
                    <span className={`badge st-${r.status.replace(" ", "")}`}>{r.status}</span>
                  </td>
                  <td>{r.assignee || <span className="muted">Unassigned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
