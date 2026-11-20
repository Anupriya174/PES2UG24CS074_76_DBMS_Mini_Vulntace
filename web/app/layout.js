import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import LogoutButton from "./components/LogoutButton";

export const metadata = {
  title: "VulnTrace",
  description: "Vulnerability tracker that finds duplicate reports by meaning",
};

export default async function RootLayout({ children }) {
  const user = await getSession();
  const staff = user && user.role !== "Reporter";
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">
            Vuln<i>Trace</i>
          </Link>
          {user && (
            <>
              <Link href="/">Reports</Link>
              <Link href="/reports/new">New report</Link>
              {staff && <Link href="/search">Search</Link>}
              {user.role === "Admin" && <Link href="/admin">Admin</Link>}
              <span className="spacer" />
              <span className="who">
                {user.name}
                <span className="role-tag">{user.role}</span>
              </span>
              <LogoutButton />
            </>
          )}
        </nav>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
