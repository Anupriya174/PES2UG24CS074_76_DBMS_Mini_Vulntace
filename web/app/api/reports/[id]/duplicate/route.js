
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail, STAFF } from "@/lib/api";

// Runs the resolve_duplicate stored procedure.
export async function POST(req, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  const { user, error } = await authorize(STAFF);
  if (error) return error;

  const { original_id, score } = await req.json().catch(() => ({}));

  if (!original_id) {
    return NextResponse.json(
      { error: "Choose the original report" },
      { status: 400 }
    );
  }

  const clamped = Math.min(1, Math.max(0, Number(score) || 0));

  try {
    await query("CALL resolve_duplicate(?, ?, ?, ?)", [
      id,
      Number(original_id),
      clamped,
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

// // Runs the resolve_duplicate stored procedure (one transaction in MySQL).
// export async function POST(req, { params }) {
//   const { user, error } = await authorize(STAFF);
//   if (error) return error;
//   const { original_id, score } = await req.json().catch(() => ({}));
//   if (!original_id) return NextResponse.json({ error: "Choose the original report" }, { status: 400 });
//   const clamped = Math.min(1, Math.max(0, Number(score) || 0));
//   try {
//     await query("CALL resolve_duplicate(?, ?, ?, ?)", [Number(params.id), Number(original_id), clamped, user.id]);
//   } catch (e) {
//     return fail(e);
//   }
//   return NextResponse.json({ ok: true });
// }
