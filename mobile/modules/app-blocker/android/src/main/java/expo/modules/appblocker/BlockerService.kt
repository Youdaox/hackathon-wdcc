package expo.modules.appblocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * Watches which app is in the foreground while a study session runs.
 *
 * A foreground service, not a background one, because Android will kill a
 * plain background loop within minutes — and a blocker that quietly stops
 * blocking is worse than no blocker at all. The persistent notification is the
 * price of staying alive, and it doubles as an honest signal that Incline is
 * watching.
 *
 * Detection uses UsageStatsManager rather than an AccessibilityService. Both
 * work; accessibility is far more invasive, harder to justify to a user, and
 * gets apps pulled from Play. Usage access is the narrower permission that
 * still answers the only question we ask: what is on screen right now.
 */
class BlockerService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var blocked: Set<String> = emptySet()

  /**
   * The package currently being shown an overlay. Tracked so the overlay is
   * raised once per visit rather than every poll, and so leaving the app
   * clears it.
   */
  private var overlaidPackage: String? = null

  private val poll = object : Runnable {
    override fun run() {
      try {
        tick()
      } catch (error: Throwable) {
        // A blocker that crashes the app it's protecting is a worse outcome
        // than one that misses a poll, so failures here are non-fatal.
        android.util.Log.e(TAG, "poll failed", error)
      }
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    blocked = intent?.getStringArrayListExtra(EXTRA_PACKAGES)?.toSet() ?: emptySet()

    startForeground(NOTIFICATION_ID, buildNotification())
    handler.removeCallbacks(poll)
    handler.post(poll)

    // START_STICKY: if Android reclaims us under memory pressure we want to
    // come back, since the session is probably still running.
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(poll)
    OverlayManager.hide(this)
    overlaidPackage = null
    super.onDestroy()
  }

  private fun tick() {
    val current = foregroundPackage() ?: return

    if (current in blocked) {
      // Already covering this app — don't stack overlays on every poll.
      if (overlaidPackage == current) return
      overlaidPackage = current

      OverlayManager.show(
        context = this,
        packageName = current,
        label = labelFor(current),
        onBypass = { pkg, shownAtMs ->
          // Bypass is allowed by design. It is recorded, not prevented — the
          // cost is meant to be emotional, and a block you cannot dismiss
          // just gets the whole app uninstalled.
          AppBlockerModule.emitDistraction(
            packageName = pkg,
            durationMs = System.currentTimeMillis() - shownAtMs,
            bypassed = true,
          )
          // Stay out of the way until they come back to this app later.
          blocked = blocked - pkg
          overlaidPackage = null
        },
        onDismiss = { pkg, shownAtMs ->
          AppBlockerModule.emitDistraction(
            packageName = pkg,
            durationMs = System.currentTimeMillis() - shownAtMs,
            bypassed = false,
          )
          overlaidPackage = null
        },
      )
    } else if (overlaidPackage != null) {
      // They left the blocked app on their own — take the overlay down.
      OverlayManager.hide(this)
      overlaidPackage = null
    }
  }

  /**
   * The package on screen right now.
   *
   * queryEvents rather than queryUsageStats: the aggregated stats bucket to
   * coarse intervals and lag by minutes, which is useless for "is TikTok open
   * this second". Events give the actual MOVE_TO_FOREGROUND transitions.
   */
  private fun foregroundPackage(): String? {
    val usage = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val now = System.currentTimeMillis()
    val events = usage.queryEvents(now - LOOKBACK_MS, now)

    var latestPackage: String? = null
    var latestAt = 0L
    val event = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val isForeground =
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
          (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            event.eventType == UsageEvents.Event.ACTIVITY_RESUMED)
      if (isForeground && event.timeStamp >= latestAt) {
        latestAt = event.timeStamp
        latestPackage = event.packageName
      }
    }
    return latestPackage
  }

  private fun labelFor(packageName: String): String =
    try {
      val info = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Throwable) {
      packageName
    }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Focus session", NotificationManager.IMPORTANCE_LOW),
        )
      }
    }
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(this)
      }
    return builder
      .setContentTitle("Focus session running")
      .setContentText("Incline is keeping distracting apps away.")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .build()
  }

  companion object {
    const val EXTRA_PACKAGES = "packages"
    private const val TAG = "BlockerService"
    private const val CHANNEL_ID = "incline_focus"
    private const val NOTIFICATION_ID = 4711

    /**
     * 1.5s is the practical floor. Faster drains battery for no benefit —
     * UsageStats itself only settles within about a second of a switch.
     */
    private const val POLL_INTERVAL_MS = 1_500L

    /** Wide enough to survive a missed poll, narrow enough to stay cheap. */
    private const val LOOKBACK_MS = 10_000L
  }
}
