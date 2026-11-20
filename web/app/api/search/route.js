import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorize, attachStatus, STAFF } from "@/lib/api";
import { searchSimilar } from "@/lib/embed";

export const dynamic = "force-dynamic";

// Same query, two engines: MySQL full-text (words) and Qdrant (meaning).
export async function GET(req) {
  const { error } = await authorize(STAFF);
  if (error) return error;
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ error: "Type at least 3 characters" }, { status: 400 });

  const keyword = await query(
    `SELECT report_id, title, status,
            MATCH(title, description) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
     FROM reports
     WHERE MATCH(title, description) AGAINST (? IN NATURAL LANGUAGE MODE)
     ORDER BY relevance DESC LIMIT 10`,
    [q, q]
  );

  let semantic = [];
  let semanticError = null;
  try {
    semantic = await attachStatus(await searchSimilar(q, 10));
  } catch {
    semanticError = "Semantic search is unavailable. Start the embedding service and reindex from the Admin page.";
  }
  return NextResponse.json({ keyword, semantic, semanticError });
}
