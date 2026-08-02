import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { recallChecks, studyChunks, studyMemorySessions } from "@/lib/db/schema";
import { embed, generateQuestions } from "@/lib/study-memory/ai";
import { cosine } from "@/lib/study-memory/retrieval";

export async function POST(request: Request) {
  const user = sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { focusSessionId?: unknown } | null;
  const focusSessionId = typeof body?.focusSessionId === "string" ? body.focusSessionId : "";
  const memory = db.select().from(studyMemorySessions).where(and(
    eq(studyMemorySessions.focusSessionId, focusSessionId), eq(studyMemorySessions.userId, user.id),
  )).get();
  if (!memory) return NextResponse.json({ error: "No useful study memory was captured." }, { status: 404 });
  const existing = db.select().from(recallChecks).where(eq(recallChecks.memorySessionId, memory.id)).get();
  if (existing) return NextResponse.json({ checkId: existing.id, questions: JSON.parse(existing.questionsJson) });

  const chunks = db.select().from(studyChunks).where(eq(studyChunks.memorySessionId, memory.id)).all();
  if (chunks.length < 2) return NextResponse.json({ error: "Not enough distinct study content was captured." }, { status: 422 });
  try {
    const [query] = await embed([`${memory.course}: ${memory.title}`]);
    const evidence = chunks.map((chunk) => ({
      id: chunk.id, content: chunk.content,
      score: cosine(query, JSON.parse(chunk.embeddingJson) as number[]),
    })).sort((a, b) => b.score - a.score).slice(0, 8).map(({ id, content }) => ({ id, content }));
    const questions = await generateQuestions(memory.course, evidence);
    const checkId = crypto.randomUUID();
    db.transaction((tx) => {
      tx.insert(recallChecks).values({
        id: checkId, memorySessionId: memory.id, userId: user.id,
        questionsJson: JSON.stringify(questions), evidenceJson: JSON.stringify(evidence),
        status: "ready", createdAt: Date.now(),
      }).run();
      tx.update(studyMemorySessions).set({ status: "ready", completedAt: Date.now() })
        .where(eq(studyMemorySessions.id, memory.id)).run();
    });
    return NextResponse.json({ checkId, questions });
  } catch (error) {
    console.error("[study-memory] recall generation failed", error);
    return NextResponse.json({ error: "Recall generation is temporarily unavailable." }, { status: 503 });
  }
}

