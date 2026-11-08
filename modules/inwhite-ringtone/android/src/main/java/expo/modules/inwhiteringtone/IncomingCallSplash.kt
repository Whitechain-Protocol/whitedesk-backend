package expo.modules.inwhiteringtone

import android.app.Activity
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

/**
 * Minimal native "incoming call" overlay shown during the RN cold-start.
 * Shows only the transport mode name (e.g. "P2P Direct", "Cloud TLS",
 * "Stealth HTTP/3") in very light gray so the user never sees a blank/black
 * screen. Removed when the JS CallScreen mounts (or after a timeout fallback).
 */
object IncomingCallSplash {
  private var overlay: View? = null
  private val handler = Handler(Looper.getMainLooper())
  private val hideRunnable = Runnable { hide() }

  private fun labelForMode(mode: String?): String {
    val isTr = Locale.getDefault().language == "tr"
    return when (mode?.lowercase()) {
      "p2p", "local" -> if (isTr) "P2P Doğrudan" else "P2P Direct"
      "stealth" -> if (isTr) "Gizli HTTP/3" else "Stealth HTTP/3"
      "armored" -> if (isTr) "Zırhlı VPN" else "Armored VPN"
      "cloud", "standard", "cloud-tls" -> if (isTr) "Bulut TLS" else "Cloud TLS"
      else -> if (isTr) "Bulut TLS" else "Cloud TLS"
    }
  }

  fun show(activity: Activity, transportMode: String?) {
    try {
      if (overlay != null) return
      val root = activity.window.decorView as? ViewGroup ?: return

      val container = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.WHITE)
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
      }

      val modeText = TextView(activity).apply {
        text = labelForMode(transportMode)
        textSize = 15f
        setTextColor(Color.rgb(0xE5, 0xE7, 0xEB))
        gravity = Gravity.CENTER
      }

      container.addView(modeText)
      overlay = container

      // Overlay'i bir sonraki main-loop turunda ekle. onCreate sırasında decorView'e
      // view eklemek activity resume'unu geciktirip "top resumed state loss timeout"
      // yaratabiliyordu (uygulama öne gelemiyordu).
      root.post {
        try {
          if (container.parent == null) root.addView(container)
        } catch (_: Throwable) {}
      }

      // Fallback timeout in case the JS layer never mounts.
      handler.postDelayed(hideRunnable, 30000)
    } catch (t: Throwable) {
      Log.w("IncomingCallSplash", "show failed", t)
    }
  }

  fun hide() {
    try {
      handler.removeCallbacks(hideRunnable)
      overlay?.let { v ->
        (v.parent as? ViewGroup)?.removeView(v)
      }
    } catch (_: Throwable) {
    }
    overlay = null
  }
}
