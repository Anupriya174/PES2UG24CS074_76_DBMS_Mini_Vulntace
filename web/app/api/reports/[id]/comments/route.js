
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail } from "@/lib/api";

export async function POST(req, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  const { user, error } = await authorize();
  if (error) return error;

  const { comment_text } = await req.json().catch(() => ({}));

  if (!comment_text?.trim()) {
    return NextResponse.json(
      { error: "Write a comment first" },
      { status: 400 }
    );
  }

  const [report] = await query(
    "SELECT submitted_by FROM reports WHERE report_id = ?",
    [id]
  );

  if (!report || (user.role === "Reporter" && report.submitted_by !== user.id)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    await query(
      "INSERT INTO comments (report_id, comment_text, author_id) VALUES (?, ?, ?)",
      [id, comment_text.trim(), user.id]
    );
  } catch (e) {
    return fail(e);
  }

  return NextResponse.json({ ok: true });
}

// import { NextResponse } from "next/server";
// import { query } from "@/lib/db";
// import { authorize, fail } from "@/lib/api";

// export async function POST(req, { params }) {
//   const { user, error } = await authorize();
//   if (error) return error;
//   const id = Number(params.id);
//   const { comment_text } = await req.json().catch(() => ({}));
//   if (!comment_text?.trim()) return NextResponse.json({ error: "Write a comment first" }, { status: 400 });

//   const [report] = await query("SELECT submitted_by FROM reports WHERE report_id = ?", [id]);
//   if (!report || (user.role === "Reporter" && report.submitted_by !== user.id)) {
//     return NextResponse.json({ error: "Report not found" }, { status: 404 });
//   }
//   try {
//     await query("INSERT INTO comments (report_id, comment_text, author_id) VALUES (?, ?, ?)", [
//       id,
//       comment_text.trim(),
//       user.id,
//     ]);
//   } catch (e) {
//     return fail(e);
//   }
//   return NextResponse.json({ ok: true });
// }
