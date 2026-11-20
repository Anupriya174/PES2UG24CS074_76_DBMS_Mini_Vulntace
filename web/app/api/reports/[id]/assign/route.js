
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail, STAFF } from "@/lib/api";

// Runs the assign_report stored procedure.
export async function POST(req, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  const { user, error } = await authorize(STAFF);
  if (error) return error;

  const { triager_id, severity_id } = await req.json().catch(() => ({}));

  if (!triager_id || !severity_id) {
    return NextResponse.json(
      { error: "Choose a triager and a severity" },
      { status: 400 }
    );
  }

  try {
    await query("CALL assign_report(?, ?, ?, ?)", [
      id,
      triager_id,
      severity_id,
      user.id,
    ]);
  } catch (e) {
    return fail(e);
  }

  return NextResponse.json({ ok: true });
}

// import { NextResponse } from "next/server";
// import { query } from "@/lib/db";
// import { authorize, fail, STAFF } from "@/lib/api";

// // Runs the assign_report stored procedure (one transaction in MySQL).
// export async function POST(req, { params }) {
//   const { user, error } = await authorize(STAFF);
//   if (error) return error;
//   const { triager_id, severity_id } = await req.json().catch(() => ({}));
//   if (!triager_id || !severity_id) {
//     return NextResponse.json({ error: "Choose a triager and a severity" }, { status: 400 });
//   }
//   try {
//     await query("CALL assign_report(?, ?, ?, ?)", [Number(params.id), triager_id, severity_id, user.id]);
//   } catch (e) {
//     return fail(e);
//   }
//   return NextResponse.json({ ok: true });
// }
