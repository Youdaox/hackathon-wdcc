const { exec } = require("node:child_process");

/** Matches the focused window's owner name against Discord across platforms. */
function isDiscord(ownerName) {
  if (!ownerName) return false;
  const name = ownerName.toLowerCase();
  return name === "discord" || name === "discord.exe";
}

/**
 * The close button's approximate screen position, given the focused window's
 * bounds. Heuristic per-platform offset, not pixel-perfect for every window
 * theme, but close enough for the pet to visibly walk toward the right corner.
 */
function closeButtonPosition(bounds) {
  if (process.platform === "darwin") {
    return { x: bounds.x + 13, y: bounds.y + 13 };
  }
  return { x: bounds.x + bounds.width - 22, y: bounds.y + 18 };
}

/**
 * Actually closes Discord. This is the "real quit" behind the pet's faked
 * click — no simulated mouse input, no Accessibility-gated input injection.
 */
function closeDiscord() {
  if (process.platform === "darwin") {
    exec(`osascript -e 'quit app "Discord"'`);
  } else if (process.platform === "win32") {
    exec(`taskkill /IM Discord.exe`);
  }
}

module.exports = { isDiscord, closeButtonPosition, closeDiscord };
