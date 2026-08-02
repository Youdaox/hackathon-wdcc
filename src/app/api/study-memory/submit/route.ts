import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { recallChecks, studyMemorySessions } from "@/lib/db/schema";
import { gradeAnswer, type RecallQuestion } from "@/lib/study-memory/ai";

export async function POST(request: Request) {
  const user = sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { checkId?: unknown; answers?: unknown } | null;
  const checkId = typeof body?.checkId === "string" ? body.checkId : "";
  const answers = body?.answers && typeof body.answers === "object" ? body.answers as Record<string, string> : {};
  const check = db.select().from(recallChecks).where(and(eq(recallChecks.id, checkId), eq(recallChecks.userId, user.id))).get();
  if (!check) return NextResponse.json({ error: "recall check not found" }, { status: 404 });
  const evidence = JSON.parse(check.evidenceJson) as Array<{
    id: string; content: string; sourceName?: string; capturedAt?: number; summary?: string;
  }>;
  const details = evidence.map((item) => ({
    chunkId: item.id,
    sourceName: item.sourceName ?? "Study material",
    capturedAt: item.capturedAt ?? null,
    summary: item.summary ?? "",
    excerpt: item.content.slice(0, 420),
  }));
  if (check.status === "submitted") {
    return NextResponse.json({ score: check.score, xpAwarded: check.xpAwarded, results: JSON.parse(check.feedbackJson ?? "[]"), details });
  }
  const questions = JSON.parse(check.questionsJson) as RecallQuestion[];
  if (questions.some((q) => typeof answers[q.id] !== "string" || answers[q.id].trim().length < 3)) {
    return NextResponse.json({ error: "Answer every question in your own words." }, { status: 400 });
  }
  try {
    const results = await Promise.all(questions.map((question) => gradeAnswer({
      question, answer: answers[question.id].slice(0, 4000),
      evidence: evidence.filter((item) => question.sourceChunkIds.includes(item.id)),
    })));
    const score = Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
    const xpAwarded = score >= 85 ? 20 : score >= 70 ? 12 : score >= 50 ? 5 : 0;
    db.transaction((tx) => {
      tx.update(recallChecks).set({
        status: "submitted", score, xpAwarded, feedbackJson: JSON.stringify(results), submittedAt: Date.now(),
      }).where(and(eq(recallChecks.id, check.id), eq(recallChecks.status, "ready"))).run();
      tx.update(studyMemorySessions).set({ status: "submitted" }).where(eq(studyMemorySessions.id, check.memorySessionId)).run();
    });
    return NextResponse.json({ score, xpAwarded, results, details });
  } catch (error) {
    console.error("[study-memory] grading failed", error);
    return NextResponse.json({ error: "Grading is temporarily unavailable." }, { status: 503 });
  }
}
