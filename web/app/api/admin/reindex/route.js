import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize } from "@/lib/api";
import { indexReport } from "@/lib/embed";

export async function POST() {
  const { error } = await authorize(["Admin"]);
  if (error) return error;
  const reports = await query("SELECT report_id, title, description FROM reports ORDER BY report_id");
  try {
    for (const r of reports) await indexReport(r);
  } catch {
    return NextResponse.json(
      { error: "The embedding service is not reachable. Start it on port 8001 and try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ indexed: reports.length });
}
