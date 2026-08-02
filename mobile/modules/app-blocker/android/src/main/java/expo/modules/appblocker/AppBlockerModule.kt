package expo.modules.appblocker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-facing surface of the Android app blocker.
 *
 * Everything here is Android-only by nature. iOS cannot be made to do this:
 * Apple never reveals which app is foregrounded to a third party, and
 * shielding requires an Apple-granted FamilyControls entitlement. The JS side
 * checks `isSupported` rather than assuming.
 */
class AppBlockerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "no react context" }

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    Events(EVENT_DISTRACTION)

    OnCreate { instance = this@AppBlockerModule }
    OnDestroy { if (instance === this@AppBlockerModule) instance = null }

    /**
     * Usage access is granted by the user toggling this app inside a Settings
     * screen — there is no runtime dialog to request, so the app has to check
     * the state and send them there.
     */
    Function("hasUsageAccess") {
      val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ops.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName,
          )
        } else {
          @Suppress("DEPRECATION")
          ops.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName,
          )
        }
      mode == AppOpsManager.MODE_ALLOWED
    }

    Function("openUsageAccessSettings") {
      context.startActivity(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("hasOverlayPermission") { OverlayManager.canDraw(context) }

    Function("openOverlaySettings") {
      context.startActivity(
        Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
          )
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    /**
     * Launchable installed apps, so the picker can show real package names
     * instead of a hardcoded guess. Requires the <queries> block in the
     * manifest on Android 11+, or this comes back with only our own app.
     */
    Function("getInstalledApps") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcher, 0)
        .mapNotNull { resolved ->
          val pkg = resolved.activityInfo?.packageName ?: return@mapNotNull null
          if (pkg == context.packageName) return@mapNotNull null
          mapOf(
            "packageName" to pkg,
            "label" to resolved.loadLabel(pm).toString(),
            "isSystem" to isSystem(pm, pkg),
          )
        }
        .distinctBy { it["packageName"] }
        .sortedBy { (it["label"] as String).lowercase() }
    }

    /** Starts watching. Safe to call again mid-session to update the list. */
    Function("startBlocking") { packages: List<String> ->
      val intent =
        Intent(context, BlockerService::class.java).apply {
          putStringArrayListExtra(BlockerService.EXTRA_PACKAGES, ArrayList(packages))
        }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stopBlocking") {
      context.stopService(Intent(context, BlockerService::class.java))
      OverlayManager.hide(context)
    }
  }

  private fun isSystem(pm: PackageManager, packageName: String): Boolean =
    try {
      val flags = pm.getApplicationInfo(packageName, 0).flags
      (flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
    } catch (_: Throwable) {
      false
    }

  companion object {
    const val EVENT_DISTRACTION = "onDistraction"

    /**
     * The service is started by the system, not constructed by us, so it needs
     * a way back to the live module instance to emit events. Held statically
     * and cleared in OnDestroy so a reloaded JS context doesn't keep a dead
     * bridge alive.
     */
    @Volatile private var instance: AppBlockerModule? = null

    fun emitDistraction(packageName: String, durationMs: Long, bypassed: Boolean) {
      instance?.sendEvent(
        EVENT_DISTRACTION,
        mapOf(
          "packageName" to packageName,
          "durationMs" to durationMs,
          "bypassed" to bypassed,
        ),
      )
    }
  }
}
