import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isValidQuestion, offlineQuestion, type RecallQuestion } from "@/lib/recall";

/**
 * Generates one short recall question for the session's linked course.
 *
 * This runs server-side because the Anthropic API needs a real key, and a
 * browser-side call would ship that key to every visitor. The client never
 * sees the key — it just POSTs a course name here.
 *
 * Every failure path (no key, API error, malformed response) falls back to a
 * built-in question rather than erroring, so a focus session is never
 * interrupted by a broken recall check.
 */

const SCHEMA = {
  type: "object",
  properties: {
    question: {
      type: "string",
      description: "One short recall question about a core concept from the course.",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "Exactly four answer options. One correct, three plausible but wrong.",
    },
    correctIndex: {
      type: "integer",
      enum: [0, 1, 2, 3],
      description: "Index of the correct option.",
    },
    explanation: {
      type: "string",
      description: "One sentence explaining why the correct answer is right.",
    },
  },
  required: ["question", "options", "correctIndex", "explanation"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write single quick-recall questions for a student mid-study-session.

Rules:
- Exactly four options; one clearly correct, three plausible but wrong.
- Aim at a core, commonly-taught concept from the named course — an early-undergraduate level idea a student would meet in the first few weeks.
- Keep the question under 20 words and each option under 12 words.
- The question must be answerable from understanding, not from having read one specific lecture.
- If the course name is vague or unrecognisable, ask about general study skills instead.
- Never reference this app, the session, or the student's schedule.`;

export async function POST(request: Request) {
  let course = "";
  try {
    const body = await request.json();
    course = typeof body?.course === "string" ? body.course.slice(0, 120) : "";
  } catch {
    // Malformed body — fall through to the offline question.
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !course.trim()) {
    return NextResponse.json<RecallQuestion>(offlineQuestion());
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Low effort keeps this fast — it's a single short question, and the
      // user is mid-session waiting on it.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Course: ${course}\n\nWrite one recall question.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json<RecallQuestion>(offlineQuestion());
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json<RecallQuestion>(offlineQuestion());
    }

    const parsed = JSON.parse(text.text);
    if (!isValidQuestion(parsed)) {
      return NextResponse.json<RecallQuestion>(offlineQuestion());
    }

    return NextResponse.json<RecallQuestion>({ ...parsed, source: "ai" });
  } catch (error) {
    // Rate limits, network failures, malformed JSON — the recall check is a
    // bonus, so degrade to the built-in question instead of surfacing an error.
    console.error("[recall] falling back to offline question:", error);
    return NextResponse.json<RecallQuestion>(offlineQuestion());
  }
}
