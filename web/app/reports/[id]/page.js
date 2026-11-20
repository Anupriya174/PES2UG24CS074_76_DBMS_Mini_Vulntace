import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import CommentForm from "@/app/components/CommentForm";
import StaffActions from "@/app/components/StaffActions";
import SimilarPanel from "@/app/components/SimilarPanel";

const fmt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function ReportPage({ params }) {
  const { id: rawId } = await params;

  const user = await getSession();
  if (!user) redirect("/login");
  
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const staff = user.role !== "Reporter";

  const [report] = await query(
    `SELECT r.*, p.name AS project, s.level_name AS severity, s.score,
            sub.name AS submitter, asg.name AS assignee
     FROM reports r
     JOIN projects p ON p.project_id = r.project_id
     LEFT JOIN severity_levels s ON s.severity_id = r.severity_id
     JOIN users sub ON sub.user_id = r.submitted_by
     LEFT JOIN users asg ON asg.user_id = r.assigned_to
     WHERE r.report_id = ?`,
    [id]
  );
  // Reporters can only open their own reports.
  if (!report || (!staff && report.submitted_by !== user.id)) notFound();

  const comments = await query(
    `SELECT c.comment_id, c.comment_text, c.created_at, u.name
     FROM comments c JOIN users u ON u.user_id = c.author_id
     WHERE c.report_id = ? ORDER BY c.created_at, c.comment_id`,
    [id]
  );
  const history = await query(
    `SELECT h.history_id, h.old_status, h.new_status, h.changed_at, u.name
     FROM status_history h JOIN users u ON u.user_id = h.changed_by
     WHERE h.report_id = ? ORDER BY h.changed_at, h.history_id`,
    [id]
  );
  const triagers = staff
    ? await query(
        `SELECT u.user_id, u.name
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'Triager'
         ORDER BY u.name`
      )
    : [];
  const severities = staff ? await query("SELECT severity_id, level_name, score FROM severity_levels ORDER BY score") : [];

  return (
    <>
      <p className="sub">
        <Link href="/">Back to reports</Link>
      </p>
      <div className="grid">
        <div>
          <div className={`card report-head sev-${report.severity || "None"}`}>
            <span className="id">#{report.report_id}</span>
            <h1>{report.title}</h1>
            <div style={{ margin: "6px 0 10px" }}>
              <span className={`badge st-${report.status.replace(" ", "")}`}>{report.status}</span>{" "}
              <span className="sev-label">{report.severity ? `${report.severity} severity` : "Not rated"}</span>
            </div>
            <p className="desc">{report.description}</p>
            <div className="meta">
              <span>
                Project <b>{report.project}</b>
              </span>
              <span>
                Reported by <b>{report.submitter}</b>
              </span>
              <span>
                Assigned to <b>{report.assignee || "nobody yet"}</b>
              </span>
              <span>
                Opened <b>{fmt(report.created_at)}</b>
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Comments</h2>
            {comments.length === 0 && <p className="muted">No comments yet.</p>}
            {comments.map((c) => (
              <div className="comment" key={c.comment_id}>
                <div className="by">
                  {c.name} on {fmt(c.created_at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.comment_text}</div>
              </div>
            ))}
            <CommentForm reportId={id} />
          </div>
        </div>

        <div>
          {staff && (
            <>
              <StaffActions reportId={id} status={report.status} triagers={triagers} severities={severities} />
              <SimilarPanel reportId={id} isDuplicate={report.status === "Duplicate"} />
            </>
          )}
          <div className="card">
            <h2>Status history</h2>
            {history.length === 0 && <p className="muted">No status changes yet.</p>}
            <ul className="timeline">
              {history.map((h) => (
                <li key={h.history_id}>
                  {h.old_status} to <b>{h.new_status}</b>
                  <div className="muted">
                    {h.name} on {fmt(h.changed_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
