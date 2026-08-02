import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { studyChunks, studyMemorySessions, studyObservations } from "@/lib/db/schema";
import { EMBEDDING_MODEL, embed, extractScreenshot } from "@/lib/study-memory/ai";
import { chunkText } from "@/lib/study-memory/retrieval";

const MAX_IMAGE_CHARS = 5_000_000;

export async function POST(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const focusSessionId = typeof body?.focusSessionId === "string" ? body.focusSessionId.slice(0, 100) : "";
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const title = typeof body?.title === "string" ? body.title.slice(0, 160) : "Study session";
  const course = typeof body?.course === "string" ? body.course.slice(0, 120) : "General study";
  const sourceName = typeof body?.sourceName === "string" ? body.sourceName.slice(0, 200) : "Selected screen";
  if (!focusSessionId || !imageDataUrl.startsWith("data:image/") || imageDataUrl.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "invalid capture" }, { status: 400 });
  }

  const now = Date.now();
  let [memory] = await db.select().from(studyMemorySessions).where(and(
    eq(studyMemorySessions.focusSessionId, focusSessionId),
    eq(studyMemorySessions.userId, user.id),
  ));
  if (!memory) {
    const id = crypto.randomUUID();
    await db.insert(studyMemorySessions).values({
      id, focusSessionId, userId: user.id, title, course,
      status: "capturing", consentVersion: "2026-08-02", createdAt: now,
    });
    [memory] = await db.select().from(studyMemorySessions).where(eq(studyMemorySessions.id, id));
  }
  if (!memory) return NextResponse.json({ error: "could not create memory" }, { status: 500 });

  const imageHash = createHash("sha256").update(imageDataUrl).digest("hex");
  const [duplicate] = await db.select({ id: studyObservations.id }).from(studyObservations).where(and(
    eq(studyObservations.memorySessionId, memory.id), eq(studyObservations.imageHash, imageHash),
  ));
  if (duplicate) return NextResponse.json({ accepted: false, reason: "duplicate" });

  try {
    const extracted = await extractScreenshot(imageDataUrl);
    if (!extracted.isStudyContent || extracted.sensitiveContentDetected || extracted.confidence < 0.45) {
      return NextResponse.json({ accepted: false, reason: extracted.sensitiveContentDetected ? "sensitive" : "not-study-content" });
    }
    const texts = chunkText(`${extracted.title}\n\n${extracted.summary}\n\n${extracted.extractedText}`);
    if (texts.length === 0) return NextResponse.json({ accepted: false, reason: "empty" });
    const vectors = await embed(texts);
    const observationId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(studyObservations).values({
        id: observationId, memorySessionId: memory.id, sourceName, capturedAt: now,
        imageHash, extractedText: extracted.extractedText, summary: extracted.summary,
        topicsJson: JSON.stringify(extracted.topics), confidence: extracted.confidence, createdAt: now,
      });
      for (const [index, content] of texts.entries()) {
        await tx.insert(studyChunks).values({
          id: crypto.randomUUID(), memorySessionId: memory.id, observationId, content,
          embeddingJson: JSON.stringify(vectors[index]), embeddingModel: EMBEDDING_MODEL, createdAt: now,
        });
      }
    });
    return NextResponse.json({ accepted: true, topics: extracted.topics });
  } catch (error) {
    console.error("[study-memory] capture processing failed", error);
    return NextResponse.json({ error: "capture processing failed" }, { status: 503 });
  }
}

