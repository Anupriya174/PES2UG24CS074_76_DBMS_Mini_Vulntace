import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }
  const [user] = await query(
    `SELECT u.user_id, u.name, u.password_hash, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  // Same message for unknown email and wrong password.
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });

  await createSession(user);
  return NextResponse.json({ ok: true, role: user.role_name });
}
