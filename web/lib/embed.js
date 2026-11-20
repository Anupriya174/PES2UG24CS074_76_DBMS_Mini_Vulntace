// Thin client for the Python embedding service (which talks to Qdrant).
const BASE = process.env.EMBED_URL || "http://localhost:8001";

async function call(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Embedding service returned ${res.status}`);
  return res.json();
}

export const indexReport = (report) => call("/index", report);
export const searchSimilar = (text, limit = 5, excludeId = null) =>
  call("/search", { text, limit, exclude_id: excludeId });
