import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await authorize();
  if (error) return error;
  const projects = await query("SELECT project_id, name FROM projects ORDER BY name");
  const severities = await query("SELECT severity_id, level_name, score FROM severity_levels ORDER BY score");
  const triagers =
    user.role === "Reporter"
      ? []
      : await query(
          `SELECT u.user_id, u.name FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE r.role_name = 'Triager' ORDER BY u.name`
        );
  return NextResponse.json({ projects, severities, triagers });
}
