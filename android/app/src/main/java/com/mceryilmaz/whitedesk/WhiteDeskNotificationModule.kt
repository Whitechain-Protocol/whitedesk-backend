package com.mceryilmaz.whitedesk

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.io.FileOutputStream

class WhiteDeskNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        var isAppInForeground: Boolean = false
        private var instance: WhiteDeskNotificationModule? = null
        private var pendingCallIntent: Intent? = null
        const val PREFS_NAME = "WhiteDeskPushPrefs"
        const val KEY_OWN_WHITE_ID = "own_white_id"
        const val KEY_OWN_TENANT_ID = "own_tenant_id"
        const val KEY_OWN_ORG_ID = "own_org_id"

        fun getSavedWhiteId(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_OWN_WHITE_ID, null)
        }

        fun saveWhiteId(context: Context, whiteId: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_OWN_WHITE_ID, whiteId.trim().lowercase()).apply()
        }

        fun getSavedTenantId(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_OWN_TENANT_ID, null)
        }

        fun saveTenantId(context: Context, tenantId: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_OWN_TENANT_ID, tenantId.trim().lowercase()).apply()
        }

        fun getSavedOrgId(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_OWN_ORG_ID, null)
        }

        fun saveOrgId(context: Context, orgId: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_OWN_ORG_ID, orgId.trim().lowercase()).apply()
        }

        fun sendTokenEvent(token: String) {
            try {
                instance?.let { module ->
                    val params = Arguments.createMap().apply {
                        putString("token", token)
                    }
                    module.reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onPushTokenRefresh", params)
                }
            } catch (_: Exception) {
            }
        }

        fun sendCallIntentEvent(intent: Intent) {
            try {
                if (intent.getBooleanExtra("fcm_incoming_call", false)) {
                    pendingCallIntent = intent
                    instance?.let { module ->
                        val params = Arguments.createMap().apply {
                            putBoolean("isIncomingCall", true)
                            putString("callAction", intent.getStringExtra("call_action") ?: "open")
                            putString("ticketId", intent.getStringExtra("ticketId") ?: "")
                            putString("callerAlias", intent.getStringExtra("callerAlias") ?: "")
                            putString("callerWhiteId", intent.getStringExtra("callerWhiteId") ?: "")
                            putString("callType", intent.getStringExtra("callType") ?: "call")
                            putString("type", intent.getStringExtra("type") ?: "")
                            putString("tenantId", intent.getStringExtra("tenantId") ?: "")
                            putString("targetOrgId", intent.getStringExtra("targetOrgId") ?: "")
                            putString("targetOrgName", intent.getStringExtra("targetOrgName") ?: "")
                        }
                        module.reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onIncomingCallNotificationTapped", params)
                    }
                }
            } catch (_: Exception) {
            }
        }

        fun sendCallActionEvent(action: String, ticketId: String, callerWhiteId: String) {
            try {
                instance?.let { module ->
                    val params = Arguments.createMap().apply {
                        putString("action", action)
                        putString("ticketId", ticketId)
                        putString("callerWhiteId", callerWhiteId)
                    }
                    module.reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onIncomingCallAction", params)
                }
            } catch (_: Exception) {
            }
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = "WhiteDeskNotificationModule"

    @ReactMethod
    fun setOwnWhiteId(whiteId: String) {
        if (whiteId.isNotEmpty()) {
            saveWhiteId(reactContext, whiteId)
        }
    }

    @ReactMethod
    fun getPushToken(promise: Promise) {
        val saved = WhiteDeskMessagingService.getSavedToken(reactContext)
        if (!saved.isNullOrEmpty()) {
            promise.resolve(saved)
            return
        }

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    promise.reject("TOKEN_ERROR", task.exception?.message ?: "Token fetch failed")
                    return@addOnCompleteListener
                }
                val token = task.result
                WhiteDeskMessagingService.saveToken(reactContext, token)
                promise.resolve(token)
            }
    }

    @ReactMethod
    fun checkNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            promise.resolve(granted)
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun getInitialCallIntent(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        val intent = pendingCallIntent ?: activity?.intent
        if (intent != null && intent.getBooleanExtra("fcm_incoming_call", false)) {
            val map = Arguments.createMap().apply {
                putBoolean("isIncomingCall", true)
                putString("callAction", intent.getStringExtra("call_action") ?: "open")
                putString("ticketId", intent.getStringExtra("ticketId") ?: "")
                putString("callerAlias", intent.getStringExtra("callerAlias") ?: "")
                putString("callerWhiteId", intent.getStringExtra("callerWhiteId") ?: "")
                putString("callType", intent.getStringExtra("callType") ?: "call")
                putString("type", intent.getStringExtra("type") ?: "")
                putString("tenantId", intent.getStringExtra("tenantId") ?: "")
                putString("targetOrgId", intent.getStringExtra("targetOrgId") ?: "")
                putString("targetOrgName", intent.getStringExtra("targetOrgName") ?: "")
            }
            pendingCallIntent = null
            promise.resolve(map)
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun setOwnTenantId(tenantId: String, promise: Promise) {
        try {
            saveTenantId(reactContext, tenantId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_TENANT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setOwnOrgId(orgId: String, promise: Promise) {
        try {
            saveOrgId(reactContext, orgId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ORG_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearCallIntent() {
        pendingCallIntent = null
        val activity = reactApplicationContext.currentActivity
        activity?.intent?.removeExtra("fcm_incoming_call")
    }

    @ReactMethod
    fun dismissIncomingCallNotification() {
        try {
            val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            nm.cancel(WhiteDeskMessagingService.CALL_NOTIFICATION_ID)
            nm.cancel(WhiteDeskMessagingService.PTT_NOTIFICATION_ID)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun renderPdfToImage(pdfPath: String, promise: Promise) {
        try {
            val cleanPath = pdfPath.replace("file://", "")
            val file = File(cleanPath)
            if (!file.exists()) {
                promise.reject("ENOENT", "PDF file not found: $pdfPath")
                return
            }
            val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = PdfRenderer(pfd)
            if (renderer.pageCount <= 0) {
                renderer.close()
                pfd.close()
                promise.reject("EMPTY_PDF", "PDF has no pages")
                return
            }
            val page = renderer.openPage(0)
            // 2.2x scale for crisp reading on high-DPI screens (e.g. S24 AMOLED)
            val scale = 2.2f
            val width = (page.width * scale).toInt()
            val height = (page.height * scale).toInt()
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            renderer.close()
            pfd.close()

            val previewFile = File(reactContext.cacheDir, "preview_${file.nameWithoutExtension}.png")
            FileOutputStream(previewFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 95, out)
            }
            bitmap.recycle()
            promise.resolve("file://${previewFile.absolutePath}")
        } catch (e: Exception) {
            promise.reject("PDF_RENDER_ERR", e.message, e)
        }
    }

    @ReactMethod
    fun isRemoteControlEnabled(promise: Promise) {
        promise.resolve(WhiteDeskRemoteInputService.instance != null)
    }

    @ReactMethod
    fun openRemoteControlSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun minimizeApp() {
        try {
            reactApplicationContext.currentActivity?.moveTaskToBack(true)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun injectRemoteTap(normX: Double, normY: Double, promise: Promise) {
        val svc = WhiteDeskRemoteInputService.instance
        if (svc == null) {
            promise.resolve(false)
            return
        }
        val ok = svc.performTap(normX.toFloat(), normY.toFloat())
        promise.resolve(ok)
    }

    @ReactMethod
    fun injectRemoteSwipe(
        startNormX: Double,
        startNormY: Double,
        endNormX: Double,
        endNormY: Double,
        durationMs: Int,
        promise: Promise
    ) {
        val svc = WhiteDeskRemoteInputService.instance
        if (svc == null) {
            promise.resolve(false)
            return
        }
        val ok = svc.performSwipe(
            startNormX.toFloat(),
            startNormY.toFloat(),
            endNormX.toFloat(),
            endNormY.toFloat(),
            durationMs.toLong()
        )
        promise.resolve(ok)
    }

    @ReactMethod
    fun injectRemoteKey(action: String, promise: Promise) {
        val svc = WhiteDeskRemoteInputService.instance
        if (svc == null) {
            promise.resolve(false)
            return
        }
        val ok = svc.performSystemAction(action)
        promise.resolve(ok)
    }

    @ReactMethod
    fun captureScreenFrame(promise: Promise) {
        val svc = WhiteDeskRemoteInputService.instance
        if (svc == null) {
            promise.resolve(null)
            return
        }
        svc.captureScreenBase64 { b64 ->
            promise.resolve(b64)
        }
    }

    @ReactMethod
    fun startNativeScreenStream() {
        WhiteDeskRemoteInputService.frameListener = { b64 ->
            try {
                if (reactContext.hasActiveReactInstance()) {
                    val params = Arguments.createMap().apply {
                        putString("frame", b64)
                    }
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onNativeRemoteScreenFrame", params)
                }
            } catch (_: Exception) {
            }
        }
        WhiteDeskRemoteInputService.instance?.startNativeStreaming()
    }

    @ReactMethod
    fun stopNativeScreenStream() {
        WhiteDeskRemoteInputService.frameListener = null
        WhiteDeskRemoteInputService.instance?.stopNativeStreaming()
    }
}
