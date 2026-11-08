package expo.modules.inwhiteringtone

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log

/**
 * Samsung One UI (6+) adds an extra "Deep sleeping apps" restriction in Device
 * Care that can kill background push delivery. Opens that exact screen, falling
 * back to the generic battery-optimization settings on other ROMs.
 */
object SamsungBattery {
  private const val TAG = "InWhiteRingtone"

  fun open(context: Context) {
    try {
      val intent = Intent().apply {
        component = ComponentName(
          "com.samsung.android.lool",
          "com.samsung.android.sm.ui.battery.BatteryActivity"
        )
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    } catch (t: Throwable) {
      try {
        val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(fallbackIntent)
      } catch (t2: Throwable) {
        Log.w(TAG, "Failed to open battery settings", t2)
      }
    }
  }
}
