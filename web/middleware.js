import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Every page and API route except login requires a valid session cookie.
export async function middleware(req) {
  const token = req.cookies.get("vt_session")?.value;
  let valid = false;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
      await jwtVerify(token, secret);
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (valid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next|favicon.ico).*)"],
};
