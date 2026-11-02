package com.mceryilmaz.whitedesk

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.inwhiteringtone.RingtonePlayer

/**
 * Android bildirim panelindeki "Reddet" (veya eylem) butonlarını yakalayan alıcı.
 * Kullanıcı bildirime dokunup "Reddet" dediğinde zil sesini ve bildirimi anında yok eder.
 */
class CallActionReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "CallActionReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "Call action received: $action")

        if (action == "com.mceryilmaz.whitedesk.ACTION_REJECT_CALL") {
            val ticketId = intent.getStringExtra("ticketId") ?: ""
            val callerWhiteId = intent.getStringExtra("callerWhiteId") ?: ""

            // 1. Android Bildirimini anında kapat
            try {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(WhiteDeskMessagingService.CALL_NOTIFICATION_ID)
                notificationManager.cancel(WhiteDeskMessagingService.PTT_NOTIFICATION_ID)
            } catch (e: Exception) {
                Log.w(TAG, "Notification cancel failed: ${e.message}")
            }

            // 2. Çalan WhiteDesk melodisini derhal sustur
            try {
                RingtonePlayer.stop()
            } catch (e: Exception) {
                Log.w(TAG, "Ringtone stop failed: ${e.message}")
            }

            // 3. React Native tarafına red sinyali fırlat (WebRTC / FastSignal red mesajı için)
            WhiteDeskNotificationModule.sendCallActionEvent("reject", ticketId, callerWhiteId)
        }
    }
}
