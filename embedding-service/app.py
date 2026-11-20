"""
VulnTrace embedding service.

Turns report text into vectors (all-MiniLM-L6-v2, 384 dimensions) and stores /
searches them in Qdrant. The MySQL report_id is used directly as the Qdrant
point id, so no mapping table is needed.
"""
import os
from typing import Optional

from fastapi import FastAPI  # type: ignore[import-not-found]
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    Filter,
    HasIdCondition,
    PointIdsList,
    PointStruct,
    VectorParams,
)
from sentence_transformers import SentenceTransformer

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.getenv("QDRANT_COLLECTION", "vulntrace_reports")
MODEL_NAME = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DIMENSIONS = 384

app = FastAPI(title="VulnTrace embedding service")
model = SentenceTransformer(MODEL_NAME)  # first run downloads about 90 MB
client = QdrantClient(url=QDRANT_URL)

if not client.collection_exists(COLLECTION):
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=DIMENSIONS, distance=Distance.COSINE),
    )


def embed(text: str) -> list[float]:
    # Normalised vectors, so cosine similarity is a simple dot product.
    return model.encode(text, normalize_embeddings=True).tolist()


class IndexIn(BaseModel):
    report_id: int
    title: str
    description: str


class SearchIn(BaseModel):
    text: str
    limit: int = 5
    exclude_id: Optional[int] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "collection": COLLECTION,
        "points": client.count(COLLECTION).count,
    }


@app.post("/index")
def index_report(body: IndexIn):
    vector = embed(f"{body.title}. {body.description}")
    client.upsert(
        collection_name=COLLECTION,
        points=[
            PointStruct(
                id=body.report_id,
                vector=vector,
                payload={"report_id": body.report_id, "title": body.title},
            )
        ],
    )
    return {"indexed": body.report_id}


@app.post("/search")
def search(body: SearchIn):
    flt = None
    if body.exclude_id is not None:
        flt = Filter(must_not=[HasIdCondition(has_id=[body.exclude_id])])
    result = client.query_points(
        collection_name=COLLECTION,
        query=embed(body.text),
        limit=body.limit,
        query_filter=flt,
        with_payload=True,
    )
    return [
        {
            "report_id": int(p.id),
            "title": (p.payload or {}).get("title"),
            "score": round(p.score, 4),
        }
        for p in result.points
    ]


@app.delete("/index/{report_id}")
def delete_report(report_id: int):
    client.delete(
        collection_name=COLLECTION,
        points_selector=PointIdsList(points=[report_id]),
    )
    return {"deleted": report_id}
