import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const STAFF = ["Triager", "Admin"];
export const STATUSES = ["Open", "Triaged", "In Progress", "Fixed", "Closed", "Duplicate"];

// Role check used by every API route. Returns { user } or { error }.
export async function authorize(roles) {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "You do not have permission to do this" }, { status: 403 }) };
  }
  return { user };
}

export function fail(err, status = 400) {
  return NextResponse.json({ error: err.sqlMessage || err.message || "Request failed" }, { status });
}

// Adds the current status from MySQL to vector-search results.
export async function attachStatus(found) {
  const ids = found.map((f) => f.report_id);
  if (!ids.length) return [];
  const rows = await query("SELECT report_id, status FROM reports WHERE report_id IN (?)", [ids]);
  const byId = Object.fromEntries(rows.map((r) => [r.report_id, r.status]));
  return found.map((f) => ({ ...f, status: byId[f.report_id] ?? "Unknown" }));
}
