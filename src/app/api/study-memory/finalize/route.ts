import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { recallChecks, studyChunks, studyMemorySessions, studyObservations } from "@/lib/db/schema";
import { embed, generateQuestions } from "@/lib/study-memory/ai";
import { cosine } from "@/lib/study-memory/retrieval";

export async function POST(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { focusSessionId?: unknown } | null;
  const focusSessionId = typeof body?.focusSessionId === "string" ? body.focusSessionId : "";
  const [memory] = await db.select().from(studyMemorySessions).where(and(
    eq(studyMemorySessions.focusSessionId, focusSessionId), eq(studyMemorySessions.userId, user.id),
  ));
  if (!memory) return NextResponse.json({ error: "No useful study memory was captured." }, { status: 404 });
  const [existing] = await db.select().from(recallChecks).where(eq(recallChecks.memorySessionId, memory.id));
  if (existing) return NextResponse.json({ checkId: existing.id, questions: JSON.parse(existing.questionsJson) });

  const chunks = await db.select().from(studyChunks).where(eq(studyChunks.memorySessionId, memory.id));
  const observations = await db.select().from(studyObservations).where(eq(studyObservations.memorySessionId, memory.id));
  const observationById = new Map(observations.map((item) => [item.id, item]));
  if (chunks.length < 2) return NextResponse.json({ error: "Not enough distinct study content was captured." }, { status: 422 });
  try {
    const [query] = await embed([`${memory.course}: ${memory.title}`]);
    const evidence = chunks.map((chunk) => ({
      id: chunk.id, content: chunk.content,
      score: cosine(query, JSON.parse(chunk.embeddingJson) as number[]),
    })).sort((a, b) => b.score - a.score).slice(0, 8).map(({ id, content }) => {
      const chunk = chunks.find((item) => item.id === id);
      const observation = chunk ? observationById.get(chunk.observationId) : undefined;
      return {
        id,
        content,
        sourceName: observation?.sourceName ?? "Study material",
        capturedAt: observation?.capturedAt ?? memory.createdAt,
        summary: observation?.summary ?? "",
      };
    });
    const questions = await generateQuestions(memory.course, evidence);
    const checkId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(recallChecks).values({
        id: checkId, memorySessionId: memory.id, userId: user.id,
        questionsJson: JSON.stringify(questions), evidenceJson: JSON.stringify(evidence),
        status: "ready", createdAt: Date.now(),
      });
      await tx.update(studyMemorySessions).set({ status: "ready", completedAt: Date.now() })
        .where(eq(studyMemorySessions.id, memory.id));
    });
    return NextResponse.json({ checkId, questions });
  } catch (error) {
    console.error("[study-memory] recall generation failed", error);
    return NextResponse.json({ error: "Recall generation is temporarily unavailable." }, { status: 503 });
  }
}
