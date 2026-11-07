package com.mceryilmaz.whitedesk

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Bitmap
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Display
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

class WhiteDeskRemoteInputService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: WhiteDeskRemoteInputService? = null
            private set

        @Volatile
        var frameListener: ((String) -> Unit)? = null
    }

    private val screenshotExecutor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile
    private var isStreaming = false
    @Volatile
    private var isCaptureInFlight = false
    @Volatile
    private var pendingImmediateCapture = false

    private var lastWindowEventTime = 0L

    private val streamRunnable = object : Runnable {
        override fun run() {
            if (!isStreaming) return
            triggerImmediateFrameCapture()
            mainHandler.postDelayed(this, 110L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Yalnızca pencere/ekran değiştiğinde (örn. masaüstü veya başka uygulama açıldığında) kontrollü kare yakala
        if (isStreaming && event != null && event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val now = System.currentTimeMillis()
            if (now - lastWindowEventTime > 300L) {
                lastWindowEventTime = now
                mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 80L)
            }
        }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        stopNativeStreaming()
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    fun startNativeStreaming() {
        isStreaming = true
        mainHandler.removeCallbacks(streamRunnable)
        mainHandler.postDelayed(streamRunnable, 80L)
    }

    fun stopNativeStreaming() {
        isStreaming = false
        pendingImmediateCapture = false
        mainHandler.removeCallbacks(streamRunnable)
    }

    fun triggerImmediateFrameCapture() {
        if (!isStreaming) return
        if (isCaptureInFlight) {
            pendingImmediateCapture = true
            return
        }
        isCaptureInFlight = true
        captureScreenBase64 { b64 ->
            isCaptureInFlight = false
            if (b64 != null && isStreaming) {
                frameListener?.invoke(b64)
            }
            if (pendingImmediateCapture && isStreaming) {
                pendingImmediateCapture = false
                mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 20L)
            }
        }
    }

    private fun getScreenDimensions(): Pair<Int, Int> {
        return try {
            val wm = getSystemService(WINDOW_SERVICE) as WindowManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bounds = wm.currentWindowMetrics.bounds
                Pair(bounds.width(), bounds.height())
            } else {
                val dm = resources.displayMetrics
                Pair(dm.widthPixels, dm.heightPixels)
            }
        } catch (_: Exception) {
            val dm = resources.displayMetrics
            Pair(dm.widthPixels, dm.heightPixels)
        }
    }

    /**
     * Captures the full system screen silently without any MediaProjection system dialog.
     * Works across the Android Home Screen (Launcher) and all third-party apps.
     */
    fun captureScreenBase64(callback: (String?) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            callback(null)
            return
        }
        try {
            takeScreenshot(
                Display.DEFAULT_DISPLAY,
                screenshotExecutor,
                object : TakeScreenshotCallback {
                    override fun onSuccess(screenshot: ScreenshotResult) {
                        try {
                            val hwBuffer = screenshot.hardwareBuffer
                            val colorSpace = screenshot.colorSpace
                            val hwBitmap = Bitmap.wrapHardwareBuffer(hwBuffer, colorSpace)
                            if (hwBitmap == null) {
                                hwBuffer.close()
                                callback(null)
                                return
                            }
                            val softBitmap = hwBitmap.copy(Bitmap.Config.ARGB_8888, false)
                            hwBitmap.recycle()
                            hwBuffer.close()

                            if (softBitmap == null) {
                                callback(null)
                                return
                            }

                            val targetW = 380
                            val ratio = targetW.toFloat() / softBitmap.width.coerceAtLeast(1).toFloat()
                            val targetH = (softBitmap.height * ratio).toInt().coerceAtLeast(1)
                            val scaled = Bitmap.createScaledBitmap(softBitmap, targetW, targetH, true)
                            if (scaled !== softBitmap) {
                                softBitmap.recycle()
                            }

                            val baos = ByteArrayOutputStream()
                            scaled.compress(Bitmap.CompressFormat.JPEG, 45, baos)
                            scaled.recycle()

                            val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
                            callback("data:image/jpeg;base64,$b64")
                        } catch (_: Exception) {
                            callback(null)
                        }
                    }

                    override fun onFailure(errorCode: Int) {
                        callback(null)
                    }
                }
            )
        } catch (_: Exception) {
            callback(null)
        }
    }

    fun performTap(normX: Float, normY: Float): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        return try {
            val (w, h) = getScreenDimensions()
            val x = (normX.coerceIn(0.01f, 0.99f) * w)
            val y = (normY.coerceIn(0.01f, 0.99f) * h)
            val path = Path().apply {
                moveTo(x, y)
            }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0L, 40L))
                .build()
            dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        super.onCompleted(gestureDescription)
                        triggerImmediateFrameCapture()
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 90L)
                    }
                },
                mainHandler
            )
        } catch (_: Exception) {
            false
        }
    }

    fun performSwipe(
        startNormX: Float,
        startNormY: Float,
        endNormX: Float,
        endNormY: Float,
        durationMs: Long = 140L
    ): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        return try {
            val (w, h) = getScreenDimensions()
            val sx = (startNormX.coerceIn(0.01f, 0.99f) * w)
            val sy = (startNormY.coerceIn(0.01f, 0.99f) * h)
            val ex = (endNormX.coerceIn(0.01f, 0.99f) * w)
            val ey = (endNormY.coerceIn(0.01f, 0.99f) * h)
            val path = Path().apply {
                moveTo(sx, sy)
                lineTo(ex, ey)
            }
            val safeDuration = durationMs.coerceIn(60L, 260L)
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0L, safeDuration))
                .build()
            dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        super.onCompleted(gestureDescription)
                        triggerImmediateFrameCapture()
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 60L)
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 130L)
                    }
                },
                mainHandler
            )
        } catch (_: Exception) {
            false
        }
    }

    fun performLongPress(normX: Float, normY: Float): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        return try {
            val (w, h) = getScreenDimensions()
            val x = (normX.coerceIn(0.01f, 0.99f) * w)
            val y = (normY.coerceIn(0.01f, 0.99f) * h)
            val path = Path().apply {
                moveTo(x, y)
            }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0L, 450L))
                .build()
            dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        super.onCompleted(gestureDescription)
                        triggerImmediateFrameCapture()
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 90L)
                    }
                },
                mainHandler
            )
        } catch (_: Exception) {
            false
        }
    }

    fun performSystemAction(actionName: String): Boolean {
        return try {
            val key = actionName.uppercase()
            val ok = when (key) {
                "BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
                "HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
                "RECENTS", "APPS", "APP_SWITCHER" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
                "NOTIFICATIONS", "NOTIFICATION_CENTER" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                "QUICK_SETTINGS", "CONTROL_CENTER" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
                "LOCK" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN) else false
                "SWIPE_UP", "HOME_INDICATOR" -> {
                    performSwipe(0.5f, 0.98f, 0.5f, 0.55f, 160L)
                }
                else -> false
            }
            triggerImmediateFrameCapture()
            mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 50L)
            mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 120L)
            ok
        } catch (_: Exception) {
            false
        }
    }

    fun performTextInjection(text: String): Boolean {
        return try {
            val root = rootInActiveWindow ?: return false
            val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (focused != null) {
                val args = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
                }
                val res = focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 100L)
                res
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }
}
