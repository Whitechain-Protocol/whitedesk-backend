package com.mceryilmaz.whitedesk

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.sqrt

class ImageTransparencyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "ImageTransparency"

    private fun decodeBitmapFromUri(uriString: String): Bitmap? {
        val context = reactApplicationContext
        val uri = Uri.parse(uriString)
        val stream: InputStream? = if (uriString.startsWith("content://")) {
            context.contentResolver.openInputStream(uri)
        } else if (uriString.startsWith("file://")) {
            File(uri.path ?: "").inputStream()
        } else {
            File(uriString).inputStream()
        }

        if (stream == null) return null

        val bitmap = BitmapFactory.decodeStream(stream)
        stream.close()
        return bitmap
    }

    private fun processBitmapTransparency(inputBitmap: Bitmap, context: Context): String {
        val width = inputBitmap.width
        val height = inputBitmap.height
        val mutableBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

        val pixels = IntArray(width * height)
        inputBitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        // Sample corners to detect background color
        val corners = listOf(
            pixels[0],
            pixels[width - 1],
            pixels[(height - 1) * width],
            pixels[width * height - 1]
        )
        val avgBgR = corners.map { Color.red(it) }.average().toInt()
        val avgBgG = corners.map { Color.green(it) }.average().toInt()
        val avgBgB = corners.map { Color.blue(it) }.average().toInt()
        val isLightBg = (avgBgR + avgBgG + avgBgB) / 3 >= 180

        for (i in pixels.indices) {
            val pixel = pixels[i]
            val r = Color.red(pixel)
            val g = Color.green(pixel)
            val b = Color.blue(pixel)
            val a = Color.alpha(pixel)

            if (a == 0) continue

            val luminance = (r * 299 + g * 587 + b * 114) / 1000

            // Distance to detected corner background
            val distToBg = if (isLightBg) {
                val dr = (r - avgBgR).toDouble()
                val dg = (g - avgBgG).toDouble()
                val db = (b - avgBgB).toDouble()
                sqrt(dr * dr + dg * dg + db * db)
            } else {
                999.0
            }

            if ((luminance >= 236 && r >= 215 && g >= 215 && b >= 215) || (isLightBg && distToBg < 28.0)) {
                // Strip background completely
                pixels[i] = Color.TRANSPARENT
            } else if ((luminance > 195 && r > 180 && g > 180 && b > 180) || (isLightBg && distToBg < 45.0)) {
                // Smooth edge feathering to completely remove white halo/edges
                val factor = if (isLightBg && distToBg < 45.0) {
                    ((distToBg - 28.0) / 17.0).toFloat().coerceIn(0f, 1f)
                } else {
                    ((236 - luminance).toFloat() / 41f).coerceIn(0f, 1f)
                }
                val newAlpha = (a * factor).toInt().coerceIn(0, 255)
                pixels[i] = Color.argb(newAlpha, r, g, b)
            }
        }

        mutableBitmap.setPixels(pixels, 0, width, 0, 0, width, height)

        val outFile = File(context.cacheDir, "transparent_logo_${System.currentTimeMillis()}.png")
        val outStream = FileOutputStream(outFile)
        mutableBitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
        outStream.flush()
        outStream.close()

        mutableBitmap.recycle()
        return "file://${outFile.absolutePath}"
    }

    @ReactMethod
    fun makeTransparent(uriString: String, promise: Promise) {
        try {
            val originalBitmap = decodeBitmapFromUri(uriString)
            if (originalBitmap == null) {
                promise.resolve(uriString)
                return
            }

            val resultUri = processBitmapTransparency(originalBitmap, reactApplicationContext)
            originalBitmap.recycle()
            promise.resolve(resultUri)
        } catch (e: Exception) {
            promise.resolve(uriString)
        }
    }

    @ReactMethod
    fun cropAndMakeTransparent(uriString: String, cropX: Int, cropY: Int, cropWidth: Int, cropHeight: Int, promise: Promise) {
        try {
            val originalBitmap = decodeBitmapFromUri(uriString)
            if (originalBitmap == null) {
                promise.reject("ERR_DECODE", "Could not decode source image: $uriString")
                return
            }

            val safeX = cropX.coerceIn(0, (originalBitmap.width - 1).coerceAtLeast(0))
            val safeY = cropY.coerceIn(0, (originalBitmap.height - 1).coerceAtLeast(0))
            val safeWidth = cropWidth.coerceIn(1, (originalBitmap.width - safeX).coerceAtLeast(1))
            val safeHeight = cropHeight.coerceIn(1, (originalBitmap.height - safeY).coerceAtLeast(1))

            val croppedBitmap = Bitmap.createBitmap(originalBitmap, safeX, safeY, safeWidth, safeHeight)
            if (croppedBitmap != originalBitmap) {
                originalBitmap.recycle()
            }

            val resultUri = processBitmapTransparency(croppedBitmap, reactApplicationContext)
            croppedBitmap.recycle()
            promise.resolve(resultUri)
        } catch (e: Exception) {
            promise.reject("ERR_CROP", e.message, e)
        }
    }
}
