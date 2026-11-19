import mysql from "mysql2/promise";

// One pool shared across hot reloads in development.
const g = globalThis;
export const pool =
  g.__vtPool ??
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "vulntrace",
    waitForConnections: true,
    connectionLimit: 10,
  });
g.__vtPool = pool;

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
