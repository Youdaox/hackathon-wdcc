package expo.modules.appblocker

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The block screen drawn over a distracting app.
 *
 * Built in code rather than XML because a local Expo module has no resource
 * merging of its own — layouts would have to live in the host app, which
 * splits one feature across two places.
 *
 * Deliberately *not* a hard block. The overlay is dismissible and the bypass
 * is one tap, because an unskippable block gets the whole app uninstalled the
 * first time someone genuinely needs Maps mid-session. The cost is meant to be
 * emotional: the creature reacts, and the bypass is recorded and shown back to
 * you afterward.
 */
object OverlayManager {

  private var view: View? = null
  private var shownAt: Long = 0L

  fun canDraw(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true

  fun show(
    context: Context,
    packageName: String,
    label: String,
    onBypass: (String, Long) -> Unit,
    onDismiss: (String, Long) -> Unit,
  ) {
    if (!canDraw(context)) return
    hide(context)

    val manager = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return
    shownAt = System.currentTimeMillis()

    val root =
      LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.parseColor("#FBF7F0"))
        setPadding(64, 64, 64, 64)
      }

    root.addView(
      TextView(context).apply {
        text = "🌱"
        textSize = 72f
        gravity = Gravity.CENTER
      },
    )

    root.addView(
      TextView(context).apply {
        text = "Your pet needs you focused"
        textSize = 24f
        setTextColor(Color.parseColor("#373128"))
        gravity = Gravity.CENTER
        setPadding(0, 32, 0, 12)
      },
    )

    root.addView(
      TextView(context).apply {
        text = "$label will be here after your session."
        textSize = 16f
        setTextColor(Color.parseColor("#918A79"))
        gravity = Gravity.CENTER
        setPadding(0, 0, 0, 44)
      },
    )

    root.addView(
      Button(context).apply {
        text = "Back to focusing"
        setTextColor(Color.WHITE)
        background =
          GradientDrawable().apply {
            cornerRadius = 40f
            setColor(Color.parseColor("#56AD70"))
          }
        setPadding(48, 28, 48, 28)
        setOnClickListener {
          onDismiss(packageName, shownAt)
          hide(context)
          // Send them home; leaving them on the blocked app just re-triggers
          // the overlay on the next poll.
          goHome(context)
        }
      },
    )

    root.addView(
      Button(context).apply {
        text = "5 more minutes"
        setTextColor(Color.parseColor("#918A79"))
        background = null
        setPadding(0, 24, 0, 0)
        setOnClickListener {
          onBypass(packageName, shownAt)
          hide(context)
        }
      },
    )

    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      }

    val params =
      WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        type,
        // Focusable on purpose: the overlay must receive taps, and not
        // capturing input is what makes an overlay feel broken.
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        android.graphics.PixelFormat.OPAQUE,
      )

    try {
      manager.addView(root, params)
      view = root
    } catch (error: Throwable) {
      android.util.Log.e("OverlayManager", "could not add overlay", error)
      view = null
    }
  }

  fun hide(context: Context) {
    val current = view ?: return
    val manager = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
    try {
      manager?.removeView(current)
    } catch (_: Throwable) {
      // Already detached — nothing to undo.
    }
    view = null
  }

  private fun goHome(context: Context) {
    val home =
      android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
        addCategory(android.content.Intent.CATEGORY_HOME)
        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
      }
    try {
      context.startActivity(home)
    } catch (_: Throwable) {
      // Non-fatal; the overlay is already down.
    }
  }
}
