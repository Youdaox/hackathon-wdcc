import * as Notifications from "expo-notifications";

/**
 * Ambient session status — a notification that sits there while you're away.
 *
 * The point is that leaving Incline shouldn't mean the session disappears.
 * A quiet, ongoing reminder is the cheapest honest nudge available without
 * native widget work, and it gives the checkpoint context before you even
 * reopen the app.
 *
 * Local notifications only. Nothing is scheduled remotely, so there is no push
 * token, no server, and nothing to configure.
 *
 * Every function swallows its own failures: a denied permission or an
 * unsupported environment must never take a focus session down with it.
 */

let notificationId: string | null = null;
let permissionChecked = false;
let permitted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permitted;
  permissionChecked = true;
  try {
    const existing = await Notifications.getPermissionsAsync();
    permitted =
      existing.granted || (await Notifications.requestPermissionsAsync()).granted === true;
  } catch {
    permitted = false;
  }
  return permitted;
}

/** Posts the ongoing "session running" notice. Safe to call more than once. */
export async function showSessionNotification(startedAt: number): Promise<void> {
  try {
    if (!(await ensurePermission())) return;
    await clearSessionNotification();

    const started = new Date(startedAt);
    const clock = `${String(started.getHours()).padStart(2, "0")}:${String(
      started.getMinutes(),
    ).padStart(2, "0")}`;

    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Focus session running",
        body: `Started at ${clock}. Time away from Incline isn't earning XP.`,
        sticky: true,
        autoDismiss: false,
        // Ambient status, not an alert — it should never make a sound.
        sound: false,
      },
      // null fires immediately rather than scheduling for later.
      trigger: null,
    });
  } catch {
    // Ambient extra — never worth interrupting a session over.
  }
}

export async function clearSessionNotification(): Promise<void> {
  try {
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
      notificationId = null;
    }
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Nothing to undo.
  }
}
