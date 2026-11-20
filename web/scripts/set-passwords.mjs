// Replaces the fake demo hashes in the seed data with a real bcrypt hash,
// so the demo users can log in. Run:  npm run set-passwords
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const password = process.env.DEMO_PASSWORD || "Password@123";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "vulntrace",
});

const hash = await bcrypt.hash(password, 10);
const [result] = await conn.query("UPDATE users SET password_hash = ?", [hash]);
console.log(`Updated ${result.affectedRows} users. Password for all of them: ${password}`);
await conn.end();
