
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "vt_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-secret-change-me"
  );

export async function createSession(user) {
  const token = await new SignJWT({
    id: user.user_id,
    name: user.name,
    role: user.role_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(secret());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

// Returns { id, name, role } or null.
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());

    return {
      id: payload.id,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// import { SignJWT, jwtVerify } from "jose";
// import { cookies } from "next/headers";

// const COOKIE = "vt_session";
// const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

// export async function createSession(user) {
//   const token = await new SignJWT({ id: user.user_id, name: user.name, role: user.role_name })
//     .setProtectedHeader({ alg: "HS256" })
//     .setExpirationTime("8h")
//     .sign(secret());
//   cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
// }

// export function clearSession() {
//   cookies().delete(COOKIE);
// }

// // Returns { id, name, role } or null.
// export async function getSession() {
//   const token = cookies().get(COOKIE)?.value;
//   if (!token) return null;
//   try {
//     const { payload } = await jwtVerify(token, secret());
//     return { id: payload.id, name: payload.name, role: payload.role };
//   } catch {
//     return null;
//   }
// }
