import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail } from "@/lib/api";
import { indexReport, searchSimilar } from "@/lib/embed";

// Create a report, then index it in Qdrant and cache its closest matches.
export async function POST(req) {
  const { user, error } = await authorize();
  if (error) return error;

  const { title, description, project_id } = await req.json().catch(() => ({}));
  if (!title?.trim() || !description?.trim() || !project_id) {
    return NextResponse.json({ error: "Project, title and description are required" }, { status: 400 });
  }

  let id;
  try {
    const result = await query(
      "INSERT INTO reports (title, description, project_id, submitted_by) VALUES (?, ?, ?, ?)",
      [title.trim(), description.trim(), project_id, user.id]
    );
    id = result.insertId;
  } catch (e) {
    return fail(e);
  }

  let similar = [];
  let warning = null;
  try {
    // Search first so the new report cannot match itself, then index it.
    similar = await searchSimilar(`${title}. ${description}`, 5, id);
    await indexReport({ report_id: id, title: title.trim(), description: description.trim() });
    // Cache strong matches in MySQL (smaller id first, as report_similarity requires).
    for (const m of similar.filter((s) => s.score >= 0.5)) {
      const score = Math.min(1, Math.max(0, m.score));
      await query(
        `INSERT INTO report_similarity (report_id_1, report_id_2, similarity_score)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE similarity_score = VALUES(similarity_score), computed_at = CURRENT_TIMESTAMP`,
        [Math.min(id, m.report_id), Math.max(id, m.report_id), score]
      );
    }
  } catch {
    warning = "Report saved, but the similarity service is not reachable.";
    similar = [];
  }
  return NextResponse.json({ id, warning, similar: user.role === "Reporter" ? [] : similar });
}
