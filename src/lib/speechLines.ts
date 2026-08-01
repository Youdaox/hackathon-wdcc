/** Idle speech bubble lines the desktop pet picks from at random. */
export const IDLE_SPEECH_LINES = [
  "hydration breaks suck",
  "Lock in, your GPA needs you.",
  "Decline is bad, try incline instead.",
  "Don't try open insta, no one dming you anyways.",
  "Ever tried attending lectures? Heard it's good for your GPA.",
  "Please give me an internship...",
  "Stay goated.",
];

export function randomIdleLine() {
  return IDLE_SPEECH_LINES[Math.floor(Math.random() * IDLE_SPEECH_LINES.length)];
}
