import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, fail } from "@/lib/api";

export async function PATCH(req) {
  const { user, error } = await authorize(["Admin"]);
  if (error) return error;
  const { user_id, role_id } = await req.json().catch(() => ({}));
  if (!user_id || !role_id) return NextResponse.json({ error: "Choose a user and a role" }, { status: 400 });
  if (user_id === user.id) return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  try {
    await query("UPDATE users SET role_id = ? WHERE user_id = ?", [role_id, user_id]);
  } catch (e) {
    return fail(e);
  }
  return NextResponse.json({ ok: true });
}
