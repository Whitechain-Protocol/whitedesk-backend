package com.mceryilmaz.whitedesk

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Bitmap
import android.graphics.Path
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Display
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
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

    private val streamRunnable = object : Runnable {
        override fun run() {
            if (!isStreaming) return
            triggerImmediateFrameCapture()
            mainHandler.postDelayed(this, 260L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Ekran veya pencere değiştiğinde (örn. masaüstünden başka uygulama açıldığında) anında yeni kare yakala
        if (isStreaming && event != null) {
            mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 80L)
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
        mainHandler.postDelayed(streamRunnable, 150L)
    }

    fun stopNativeStreaming() {
        isStreaming = false
        mainHandler.removeCallbacks(streamRunnable)
    }

    fun triggerImmediateFrameCapture() {
        if (!isStreaming || isCaptureInFlight) return
        isCaptureInFlight = true
        captureScreenBase64 { b64 ->
            isCaptureInFlight = false
            if (b64 != null && isStreaming) {
                frameListener?.invoke(b64)
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

                            val targetW = 432
                            val ratio = targetW.toFloat() / softBitmap.width.coerceAtLeast(1).toFloat()
                            val targetH = (softBitmap.height * ratio).toInt().coerceAtLeast(1)
                            val scaled = Bitmap.createScaledBitmap(softBitmap, targetW, targetH, true)
                            if (scaled !== softBitmap) {
                                softBitmap.recycle()
                            }

                            val baos = ByteArrayOutputStream()
                            scaled.compress(Bitmap.CompressFormat.JPEG, 56, baos)
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
                .addStroke(GestureDescription.StrokeDescription(path, 0L, 60L))
                .build()
            dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        super.onCompleted(gestureDescription)
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 70L)
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 240L)
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
        durationMs: Long = 220L
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
            val safeDuration = durationMs.coerceIn(80L, 1000L)
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0L, safeDuration))
                .build()
            dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        super.onCompleted(gestureDescription)
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 70L)
                        mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 240L)
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
            val ok = when (actionName.uppercase()) {
                "BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
                "HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
                "RECENTS" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
                else -> false
            }
            mainHandler.postDelayed({ triggerImmediateFrameCapture() }, 120L)
            ok
        } catch (_: Exception) {
            false
        }
    }
}
