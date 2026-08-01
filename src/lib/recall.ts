/**
 * AI recall checks — one short multiple-choice question during a focus session.
 *
 * Multiple choice rather than free text on purpose: it grades instantly with no
 * second model call, and answering costs the user two seconds. The whole point
 * is that this stays a nudge, never another thing to get past.
 */

export interface RecallQuestion {
  question: string;
  /** Exactly 4 options. */
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  /** One sentence shown after answering. */
  explanation: string;
  /** "ai" = generated for this course; "offline" = built-in, no API key configured. */
  source: "ai" | "offline";
}

/** XP awarded for a correct answer. Skipping or missing costs nothing. */
export const RECALL_BONUS_XP = 10;

/** Shape validation for whatever comes back from the model. */
export function isValidQuestion(value: unknown): value is Omit<RecallQuestion, "source"> {
  if (typeof value !== "object" || value === null) return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.question === "string" &&
    q.question.length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === "string" && o.length > 0) &&
    typeof q.correctIndex === "number" &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex <= 3 &&
    typeof q.explanation === "string"
  );
}

/**
 * Used when no API key is configured, or the API call fails. These are about
 * study technique rather than course content — without a model we genuinely
 * can't ask about the user's subject, and the UI labels these as offline
 * rather than passing them off as generated.
 */
const OFFLINE_QUESTIONS: Omit<RecallQuestion, "source">[] = [
  {
    question: "You just read a dense page and understood it. What helps you remember it in a week?",
    options: [
      "Closing the book and writing down what you remember",
      "Re-reading the page twice more",
      "Highlighting the key sentences",
      "Copying the page into your notes",
    ],
    correctIndex: 0,
    explanation:
      "Retrieval practice beats re-reading. Pulling it out of your head is what builds the memory.",
  },
  {
    question: "When is the best time to review something you learned today?",
    options: [
      "Just before you'd forget it — a day, then a few days, then a week",
      "Immediately, several times in a row",
      "The night before the exam",
      "Once a day, every day, forever",
    ],
    correctIndex: 0,
    explanation: "Spaced repetition: expanding gaps between reviews is what makes recall stick.",
  },
  {
    question: "You're stuck on a problem for 20 minutes. What usually works best?",
    options: [
      "Attempt it properly, then check the solution and redo it unaided",
      "Look up the answer straight away",
      "Keep pushing for another hour",
      "Skip it and move to the next topic",
    ],
    correctIndex: 0,
    explanation:
      "The failed attempt is what makes the solution stick — but only if you close the loop afterwards.",
  },
  {
    question: "Which study session is likely to be worth the most?",
    options: [
      "40 minutes on one topic, phone in another room",
      "3 hours with the group chat open",
      "90 minutes switching between four subjects",
      "20 minutes re-reading last week's notes",
    ],
    correctIndex: 0,
    explanation: "Undivided attention on one thing beats longer, fragmented time almost every time.",
  },
];

export function offlineQuestion(): RecallQuestion {
  const pick = OFFLINE_QUESTIONS[Math.floor(Math.random() * OFFLINE_QUESTIONS.length)];
  return { ...pick, source: "offline" };
}
