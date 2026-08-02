const { exec } = require("node:child_process");

/**
 * Apps the pet will run over and close if they become the focused window.
 * `name` is the macOS app name (and the Windows executable name, minus
 * `.exe`) — good enough for the handful of well-known apps this targets.
 */
const TARGET_APPS = ["Discord", "Steam", "Snapchat"];

/**
 * Matches the focused window's owner name against the target app list.
 *
 * Not an exact match: on Windows in particular, the reported owner name can
 * vary by launcher/installer (a plain "Discord.exe", but also things like
 * "Discord Inc. - Discord" from some window managers, or a versioned path
 * component). Checking containment both ways catches these without needing
 * to special-case every variant.
 */
function matchTargetApp(ownerName) {
  if (!ownerName) return null;
  const normalized = ownerName.toLowerCase().trim().replace(/\.exe$/, "");
  return (
    TARGET_APPS.find((name) => {
      const target = name.toLowerCase();
      return normalized === target || normalized.includes(target);
    }) ?? null
  );
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

const FORCE_KILL_DELAY_MS = 1500;

/**
 * Actually closes the named app. This is the "real quit" behind the pet's
 * faked click — no simulated mouse input, no Accessibility-gated input
 * injection.
 *
 * Some apps (Steam, notably) don't actually exit on a polite quit request —
 * they just hide their window and keep running in the background (updater,
 * friends list, overlay). A plain `quit`/`taskkill` is a request the app is
 * free to ignore, and Steam does. So this sends the polite request first,
 * then force-terminates the process shortly after if it's still running.
 *
 * On macOS the PID is resolved through System Events by the app's visible
 * name (the same name matchTargetApp already works with), not a guessed
 * Mach-O executable name — Steam's actual binary isn't literally "Steam",
 * so a name-based `pkill -x Steam` would silently fail to match it.
 */
function closeTargetApp(name) {
  if (process.platform === "darwin") {
    exec(`osascript -e 'quit app "${name}"'`);
    setTimeout(() => {
      exec(
        `pid=$(osascript -e 'tell application "System Events" to get unix id of first process whose name is "${name}"' 2>/dev/null); ` +
          `if [ -n "$pid" ]; then kill -9 "$pid"; fi`,
      );
    }, FORCE_KILL_DELAY_MS);
  } else if (process.platform === "win32") {
    exec(`taskkill /IM ${name}.exe`);
    setTimeout(() => {
      exec(`taskkill /IM ${name}.exe /F`);
    }, FORCE_KILL_DELAY_MS);
  }
}

module.exports = { TARGET_APPS, matchTargetApp, closeButtonPosition, closeTargetApp };
