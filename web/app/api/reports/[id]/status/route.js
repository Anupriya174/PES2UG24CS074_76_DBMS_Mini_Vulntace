
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail, STAFF, STATUSES } from "@/lib/api";

// Runs the update_report_status stored procedure.
export async function POST(req, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  const { user, error } = await authorize(STAFF);
  if (error) return error;

  const { status } = await req.json().catch(() => ({}));

  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  try {
    await query("CALL update_report_status(?, ?, ?)", [
      id,
      status,
      user.id,
    ]);
  } catch (e) {
    return fail(e);
  }

  return NextResponse.json({ ok: true });
}

// import { NextResponse } from "next/server";
// import { query } from "@/lib/db";
// import { authorize, fail, STAFF, STATUSES } from "@/lib/api";

// // Runs the update_report_status stored procedure; the trigger logs the change.
// export async function POST(req, { params }) {
//   const { user, error } = await authorize(STAFF);
//   if (error) return error;
//   const { status } = await req.json().catch(() => ({}));
//   if (!STATUSES.includes(status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
//   try {
//     await query("CALL update_report_status(?, ?, ?)", [Number(params.id), status, user.id]);
//   } catch (e) {
//     return fail(e);
//   }
//   return NextResponse.json({ ok: true });
// }
