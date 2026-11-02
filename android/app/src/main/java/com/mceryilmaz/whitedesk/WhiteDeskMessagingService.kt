package com.mceryilmaz.whitedesk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import expo.modules.inwhiteringtone.RingtonePlayer

class WhiteDeskMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "WhiteDeskFCM"
        const val CALL_CHANNEL_ID = "whitedesk_calls_v2"
        const val PTT_CHANNEL_ID = "whitedesk_ptt_v4"
        const val CALL_NOTIFICATION_ID = 77777
        const val PTT_NOTIFICATION_ID = 88888
        const val PREFS_NAME = "WhiteDeskPushPrefs"
        const val KEY_FCM_TOKEN = "latest_fcm_token"

        fun getSavedToken(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_FCM_TOKEN, null)
        }

        fun saveToken(context: Context, token: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "New FCM Token received: $token")
        saveToken(applicationContext, token)
        WhiteDeskNotificationModule.sendTokenEvent(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.i(TAG, "FCM Message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val notification = remoteMessage.notification

        val type = data["type"] ?: "incoming_call"
        val ticketId = data["ticketId"] ?: ""
        val callerAlias = data["callerAlias"] ?: data["callerName"] ?: "Destek Operatörü"
        val callerWhiteId = (data["callerWhiteId"] ?: "").trim().lowercase()
        val callType = data["callType"] ?: (if (type == "direct_ptt") "ptt" else "call")

        // 1. ÇAĞRI İPTAL PUSH BİLDİRİMİ (Arayan vazgeçtiğinde arananın zilini ve bildirimini derhal sustur)
        if (type == "cancel_call") {
            Log.i(TAG, "Cancel call push received for ticketId: $ticketId. Dismissing notification & stopping ringtone.")
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(CALL_NOTIFICATION_ID)
            notificationManager.cancel(PTT_NOTIFICATION_ID)
            try {
                RingtonePlayer.stop()
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping ringtone on cancel: ${e.message}")
            }
            WhiteDeskNotificationModule.sendCallActionEvent("hangup", ticketId, callerWhiteId)
            return
        }

        // KENDİ KENDİNE BİLDİRİM KONTROLÜ: Eğer arayan kişi bu cihaz ise bildirimi doğrudan düşür
        val myWhiteId = WhiteDeskNotificationModule.getSavedWhiteId(applicationContext)
        if (!myWhiteId.isNullOrEmpty() && callerWhiteId.isNotEmpty()) {
            if (callerWhiteId.equals(myWhiteId, ignoreCase = true)) {
                Log.i(TAG, "Self push dropped: callerWhiteId matches own device identity.")
                return
            }
        }

        val isRemoteDesktop = type == "remote_desktop_offer" || callType == "remote_desktop"
        val isOrgPtt = !isRemoteDesktop && (type == "org_ptt" || (callType == "ptt" && type != "direct_ptt"))
        val isDirectPtt = !isRemoteDesktop && type == "direct_ptt"

        // 1. KESİN VE KIRILAMAZ FİRMA (TENANT) İZOLASYONU (ZERO TRUST)
        // Eğer push bildirimi belirli bir şirkete aitse ve bu cihaz o şirkete ait değilse DERHAL DÜŞÜR!
        val targetTenantId = (data["tenantId"] ?: "").trim().lowercase()
        val myTenantId = WhiteDeskNotificationModule.getSavedTenantId(applicationContext)?.trim()?.lowercase() ?: ""
        if (isOrgPtt) {
            // Telsiz anonsları için ZERO TRUST: Her iki tenant ID de kesinlikle dolu olmalı ve birbirine BİREBİR eşit olmalıdır!
            if (targetTenantId.isEmpty() || myTenantId.isEmpty() || targetTenantId != myTenantId) {
                Log.w(TAG, "Cross-tenant PTT push dropped at native level! TargetTenant: $targetTenantId, MyTenant: $myTenantId")
                return
            }
        } else if (targetTenantId.isNotEmpty()) {
            if (myTenantId.isEmpty() || targetTenantId != myTenantId) {
                Log.w(TAG, "Cross-tenant call push dropped at native level! TargetTenant: $targetTenantId, MyTenant: $myTenantId")
                return
            }
        }

        // 2. KESİN VE KIRILAMAZ GRUP / BİRİM (ORG) İZOLASYONU (ZERO TRUST)
        // Telsiz anonsunu başlatan admin bir gruba bağlıysa ya da bir grup seçmişse;
        // aynı şekilde Global Admin de bir grup seçerek anons başlatmışsa, KESİNLİKLE sadece o gruba
        // mensup kişilerde çalar. Bu grup dışındaki kullanıcılarda davet zili ve bildirim ASLA ÇALMAZ!
        val targetOrgId = (data["orgId"] ?: "").trim().lowercase()
        val isSpecificOrg = targetOrgId.isNotEmpty() && targetOrgId != "all" && targetOrgId != "*" && targetOrgId != "global"
        if (isOrgPtt && isSpecificOrg) {
            val myOrgId = WhiteDeskNotificationModule.getSavedOrgId(applicationContext)?.trim()?.lowercase() ?: ""
            if (myOrgId.isEmpty() || myOrgId != targetOrgId) {
                Log.w(TAG, "Cross-group PTT broadcast push dropped at native level! TargetOrg: $targetOrgId, MyOrg: $myOrgId")
                return
            }
        }

        val title = when {
            isRemoteDesktop -> "Uzak Masaüstü İsteği"
            isOrgPtt -> "Telsiz Yayını"
            isDirectPtt -> "Bas-konuş araması"
            type == "incoming_call" -> "Gelen Sesli Çağrı"
            else -> notification?.title ?: data["title"] ?: "WhiteDesk Destek Çağrısı"
        }

        val body = when {
            isRemoteDesktop -> {
                val caller = if (callerAlias.isNotBlank()) callerAlias else "Destek Uzmanı"
                "$caller cihaz ekranınıza bağlanmak için onayınızı bekliyor."
            }
            isOrgPtt -> {
                val caller = if (callerAlias.isNotBlank()) callerAlias else "Yetkili"
                "$caller telsiz yayını başlattı."
            }
            isDirectPtt -> {
                val caller = if (callerAlias.isNotBlank()) callerAlias else "Admin"
                "$caller Bas Konuş araması yapıyor"
            }
            type == "incoming_call" -> {
                val caller = if (callerAlias.isNotBlank()) callerAlias else "Destek Yetkilisi"
                "$caller sesli arama yapıyor..."
            }
            else -> notification?.body ?: data["body"] ?: "Arama isteği"
        }

        val orgId = data["orgId"] ?: ""
        val targetOrgName = data["orgName"] ?: ""

        showCallHeadsUpNotification(
            title = title,
            body = body,
            ticketId = ticketId,
            callerAlias = callerAlias,
            callerWhiteId = callerWhiteId,
            callType = callType,
            type = type,
            orgId = orgId,
            targetOrgName = targetOrgName,
            tenantId = targetTenantId
        )
    }

    private fun showCallHeadsUpNotification(
        title: String,
        body: String,
        ticketId: String,
        callerAlias: String,
        callerWhiteId: String,
        callType: String,
        type: String,
        orgId: String = "",
        targetOrgName: String = "",
        tenantId: String = ""
    ) {
        // 0. UYGULAMA ZATEN ÖN PLANDAYSA (Kullanıcı uygulamaya bakıyorsa):
        // Üst bildirim bandını hiç çıkarma, doğrudan uygulama içindeki cevaplama modalını aç!
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or 
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            putExtra("fcm_incoming_call", true)
            putExtra("call_action", "open")
            putExtra("ticketId", ticketId)
            putExtra("callerAlias", callerAlias)
            putExtra("callerWhiteId", callerWhiteId)
            putExtra("callType", callType)
            putExtra("type", type)
            putExtra("targetOrgId", orgId)
            putExtra("targetOrgName", targetOrgName)
            putExtra("tenantId", tenantId)
        }

        if (WhiteDeskNotificationModule.isAppInForeground) {
            Log.i(TAG, "App is already in foreground; presenting call modal directly without notification banner.")
            WhiteDeskNotificationModule.sendCallIntentEvent(launchIntent)
            return
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createCallNotificationChannels(notificationManager)

        val isPtt = type == "org_ptt" || type == "direct_ptt" || callType == "ptt"
        val targetChannelId = if (isPtt) PTT_CHANNEL_ID else CALL_CHANNEL_ID

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager

        val isScreenOn = powerManager.isInteractive
        val isLocked = keyguardManager?.isKeyguardLocked ?: false

        val pendingIntent = PendingIntent.getActivity(
            this,
            if (isPtt) PTT_NOTIFICATION_ID else CALL_NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. "CEVAPLA" / "KATIL" Butonu İntenti
        val answerIntent = Intent(this, MainActivity::class.java).apply {
            action = "com.mceryilmaz.whitedesk.ACTION_ANSWER_CALL"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or 
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            putExtra("fcm_incoming_call", true)
            putExtra("call_action", "answer")
            putExtra("ticketId", ticketId)
            putExtra("callerAlias", callerAlias)
            putExtra("callerWhiteId", callerWhiteId)
            putExtra("callType", if (isPtt) "ptt" else "call")
            putExtra("type", type)
            putExtra("targetOrgId", orgId)
            putExtra("targetOrgName", targetOrgName)
            putExtra("tenantId", tenantId)
        }
        val answerPendingIntent = PendingIntent.getActivity(
            this,
            if (isPtt) 88881 else 77771,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. "REDDET" / "KAPAT" Butonu İntenti (Tek bir kırmızı buton; ekstra siyah buton yok!)
        val rejectIntent = Intent(this, CallActionReceiver::class.java).apply {
            action = "com.mceryilmaz.whitedesk.ACTION_REJECT_CALL"
            putExtra("ticketId", ticketId)
            putExtra("callerWhiteId", callerWhiteId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            this,
            if (isPtt) 88882 else 77772,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Cihaz kilitli veya ekran kapalıysa ekranı uyandır
        if (!isScreenOn || isLocked) {
            try {
                @Suppress("DEPRECATION")
                val wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "whitedesk:incoming_call_screen_wake"
                )
                wakeLock.acquire(15000L)
            } catch (e: Exception) {
                Log.w(TAG, "WakeLock acquire failed: ${e.message}")
            }
        }

        val soundUri = if (isPtt)
            Uri.parse("android.resource://${packageName}/raw/radio_incoming")
        else
            Uri.parse("android.resource://${packageName}/raw/inwhite_ringtone")
        val vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)

        // Yuvarlak ikon alanı ve büyük ikon için uygulamanın masaüstü launcher ikonu
        val appIconCompat = IconCompat.createWithResource(this, R.mipmap.ic_launcher)

        val notificationBuilder = NotificationCompat.Builder(this, targetChannelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(appIconCompat.toIcon(this))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setOngoing(true) // Telsiz ve arama bildirimleri ekranda kalıcı olmalı
            .setVibrate(vibrationPattern)
            .setSound(soundUri)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, !isScreenOn || isLocked)

        // Person objesine de uygulama ikonunu bağla; böylece baş harf (T vb.) yerine uygulama logosu çıkar
        val callerPerson = Person.Builder()
            .setName(title)
            .setIcon(appIconCompat)
            .setImportant(true)
            .build()

        // Geniş CallStyle bandı (Yeşil Katıl, Kırmızı Kapat)
        val callStyle = NotificationCompat.CallStyle.forIncomingCall(
            callerPerson,
            rejectPendingIntent,
            answerPendingIntent
        )
        notificationBuilder.setStyle(callStyle)

        val builtNotification = notificationBuilder.build().apply {
            flags = flags or Notification.FLAG_INSISTENT
        }

        val notificationId = if (isPtt) PTT_NOTIFICATION_ID else CALL_NOTIFICATION_ID
        notificationManager.notify(notificationId, builtNotification)
    }

    private fun createCallNotificationChannels(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                manager.deleteNotificationChannel("whitedesk_calls")
                manager.deleteNotificationChannel("whitedesk_ptt_v2")
                manager.deleteNotificationChannel("whitedesk_ptt_v3")
            } catch (_: Exception) {}

            val callSoundUri = Uri.parse("android.resource://${packageName}/raw/inwhite_ringtone")
            val pttSoundUri = Uri.parse("android.resource://${packageName}/raw/radio_incoming")
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            // 1. Sesli Arama Kanalı (WhiteDesk Melodisi ile çalar)
            if (manager.getNotificationChannel(CALL_CHANNEL_ID) == null) {
                val callChannel = NotificationChannel(
                    CALL_CHANNEL_ID,
                    "WhiteDesk Güvenli Sesli Görüşmeler",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "WhiteDesk gelen 1-e-1 sesli aramalar"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
                    setSound(callSoundUri, audioAttributes)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                manager.createNotificationChannel(callChannel)
            }

            // 2. Telsiz Kanalı (WhiteDesk Melodisi ile çalar)
            if (manager.getNotificationChannel(PTT_CHANNEL_ID) == null) {
                val pttChannel = NotificationChannel(
                    PTT_CHANNEL_ID,
                    "WhiteDesk Saha Telsizi Anonsları",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Kurumsal telsiz ve bas-konuş anons bildirimleri"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
                    setSound(pttSoundUri, audioAttributes)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                manager.createNotificationChannel(pttChannel)
            }
        }
    }
}
