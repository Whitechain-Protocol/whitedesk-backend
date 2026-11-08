package expo.modules.inwhiteringtone

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * inWhite JS → native ringtone bridge.
 *
 * The native MediaPlayer (RingtonePlayer) is the single ringtone
 * source for incoming calls on Android (both foreground and background). The JS
 * layer only triggers it and stops it — it no longer plays its own expo-av sound.
 */
class InWhiteRingtoneModule : Module() {
  private var isCallbackRegistered = false
  private var currentSpeakerMode = false
  private var lastRoutedSpeakerMode: Boolean? = null
  private var wakeLock: android.os.PowerManager.WakeLock? = null
  private var wifiLock: android.net.wifi.WifiManager.WifiLock? = null
  private var proximityWakeLock: android.os.PowerManager.WakeLock? = null

  private val audioDeviceCallback = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
    object : android.media.AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out android.media.AudioDeviceInfo>?) {
        if (!currentSpeakerMode) {
          val context = appContext.reactContext ?: return
          val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager ?: return
          val headset = audioManager.availableCommunicationDevices.find { dev ->
            dev.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            dev.type == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_DEVICE ||
            dev.type == android.media.AudioDeviceInfo.TYPE_HEARING_AID
          }
          if (headset != null) {
            audioManager.setCommunicationDevice(headset)
            android.util.Log.i("InWhiteRingtone", "Auto-routed to plugged HEADSET: ${headset.productName}")
          }
        }
      }

      override fun onAudioDevicesRemoved(removedDevices: Array<out android.media.AudioDeviceInfo>?) {
        if (!currentSpeakerMode) {
          val context = appContext.reactContext ?: return
          val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager ?: return
          val headset = audioManager.availableCommunicationDevices.find { dev ->
            dev.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            dev.type == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_DEVICE ||
            dev.type == android.media.AudioDeviceInfo.TYPE_HEARING_AID
          }
          if (headset != null) {
            audioManager.setCommunicationDevice(headset)
          } else {
            val earpiece = audioManager.availableCommunicationDevices.find {
              it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
            }
            if (earpiece != null) {
              audioManager.setCommunicationDevice(earpiece)
            } else {
              audioManager.clearCommunicationDevice()
            }
          }
        }
      }
    }
  } else null

  override fun definition() = ModuleDefinition {
    Name("InWhiteRingtone")

    Function("startNotificationChime") {
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.startNotificationChime(context)
      }
    }

    Function("stopNotificationChime") {
      RingtonePlayer.stopNotificationChime()
    }

    Function("startRingtone") {
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.start(context)
      }
    }

    Function("stopRingtone") {
      RingtonePlayer.stop()
    }

    Function("startRingback") {
      val context = appContext.reactContext
      if (context != null) {
        val pm = context.packageManager
        val isTablet = !(pm?.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TELEPHONY) ?: true)
        RingtonePlayer.startRingback(context, isTablet)
      }
    }

    Function("stopRingback") {
      RingtonePlayer.stopRingback()
    }

    Function("startRadioRingtone") {
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.startRadioRingtone(context)
      }
    }

    Function("stopRadioRingtone") {
      RingtonePlayer.stopRadioRingtone()
    }

    Function("startRadioRingback") {
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.startRadioRingback(context)
      }
    }

    Function("stopRadioRingback") {
      RingtonePlayer.stopRadioRingback()
    }

    Function("playRadioTone") { type: String ->
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.playRadioTone(context, type)
      }
    }

    Function("playTelecomTone") { type: String ->
      val context = appContext.reactContext
      if (context != null) {
        RingtonePlayer.playTelecomTone(context, type)
      }
    }

    Function("getRingbackPath") {
      val context = appContext.reactContext ?: return@Function ""
      val targetFile = java.io.File(context.filesDir, "outgoing_call_ring.mp3")
      if (!targetFile.exists() || targetFile.length() == 0L) {
        try {
          context.resources.openRawResource(R.raw.outgoing_call_ring).use { input ->
            java.io.FileOutputStream(targetFile).use { output ->
              input.copyTo(output)
            }
          }
        } catch (e: Exception) {
          android.util.Log.e("InWhiteRingtone", "Failed to extract ringback audio", e)
          return@Function ""
        }
      }
      return@Function targetFile.absolutePath
    }

    AsyncFunction("routeAudio") { toSpeaker: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
        ?: return@AsyncFunction false

      // IDEMPOTENCY GUARD: If we are already in MODE_IN_COMMUNICATION and the requested route
      // matches our current route, do NOT re-invoke setCommunicationDevice(). Re-invoking
      // setCommunicationDevice repeatedly resets AudioFlinger buffers every 400ms, causing
      // audio popping/ticking and preventing hardware AEC from converging!
      if (audioManager.mode == android.media.AudioManager.MODE_IN_COMMUNICATION && lastRoutedSpeakerMode == toSpeaker) {
        return@AsyncFunction true
      }

      currentSpeakerMode = toSpeaker
      audioManager.mode = android.media.AudioManager.MODE_IN_COMMUNICATION

      // Register audio device change callback once so plugging/unplugging headphones switches automatically
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !isCallbackRegistered && audioDeviceCallback != null) {
        try {
          audioManager.registerAudioDeviceCallback(audioDeviceCallback, null)
          isCallbackRegistered = true
        } catch (_: Throwable) {}
      }

      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        if (toSpeaker) {
          val speakerDevice = audioManager.availableCommunicationDevices.find {
            it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
          }
          if (speakerDevice != null) {
            val success = audioManager.setCommunicationDevice(speakerDevice)
            lastRoutedSpeakerMode = true
            android.util.Log.i("InWhiteRingtone", "routeAudio: routed to SPEAKER returned $success")
            return@AsyncFunction success
          } else {
            lastRoutedSpeakerMode = true
            return@AsyncFunction true
          }
        } else {
          // Check for connected headsets (Bluetooth, Wired, USB) with highest priority
          val headsetDevice = audioManager.availableCommunicationDevices.find { dev ->
            dev.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            dev.type == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_HEADSET ||
            dev.type == android.media.AudioDeviceInfo.TYPE_USB_DEVICE ||
            dev.type == android.media.AudioDeviceInfo.TYPE_HEARING_AID
          }
          if (headsetDevice != null) {
            val success = audioManager.setCommunicationDevice(headsetDevice)
            lastRoutedSpeakerMode = false
            android.util.Log.i("InWhiteRingtone", "routeAudio: routed to HEADSET (${headsetDevice.productName}, type=${headsetDevice.type}) returned $success")
            return@AsyncFunction success
          }

          // No headset connected -> fallback to built-in earpiece (phone) or clear lock for tablet
          val earpieceDevice = audioManager.availableCommunicationDevices.find {
            it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
          }
          if (earpieceDevice != null) {
            val success = audioManager.setCommunicationDevice(earpieceDevice)
            lastRoutedSpeakerMode = false
            android.util.Log.i("InWhiteRingtone", "routeAudio: routed to EARPIECE returned $success")
            return@AsyncFunction success
          } else {
            // E.g. Tablets without earpiece (Galaxy Tab A9+):
            // Clear locked communication device so Android AudioPolicyManager routes natively with AEC active!
            audioManager.clearCommunicationDevice()
            lastRoutedSpeakerMode = false
            android.util.Log.i("InWhiteRingtone", "routeAudio: no earpiece (tablet), cleared communication device for native AEC speaker routing")
            return@AsyncFunction true
          }
        }
      } else {
        @Suppress("DEPRECATION")
        audioManager.isSpeakerphoneOn = toSpeaker
        lastRoutedSpeakerMode = toSpeaker
        return@AsyncFunction true
      }
    }

    Function("openSamsungBatterySettings") {
      val context = appContext.reactContext
      if (context != null) {
        SamsungBattery.open(context)
      }
    }

    Function("copyToClipboard") { text: String ->
      val context = appContext.reactContext ?: return@Function false
      val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
      if (clipboard != null) {
        val clip = android.content.ClipData.newPlainText("whiteId", text)
        clipboard.setPrimaryClip(clip)
        return@Function true
      }
      return@Function false
    }

    Function("hideIncomingCallSplash") {
      IncomingCallSplash.hide()
    }

    Function("setSpeakerphoneOn") { enabled: Boolean ->
      val context = appContext.reactContext
      val audioManager = context?.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
      audioManager?.let { am ->
        am.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
          if (enabled) {
            val speakerDevice = am.availableCommunicationDevices.find {
              it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            }
            if (speakerDevice != null) {
              am.setCommunicationDevice(speakerDevice)
            }
          } else {
            val earpieceDevice = am.availableCommunicationDevices.find {
              it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
            }
            if (earpieceDevice != null) {
              am.setCommunicationDevice(earpieceDevice)
            } else {
              am.clearCommunicationDevice()
            }
          }
        } else {
          @Suppress("DEPRECATION")
          am.isSpeakerphoneOn = enabled
        }
      }
    }

    Function("setBluetoothScoOn") { enabled: Boolean ->
      val context = appContext.reactContext
      val audioManager = context?.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
      audioManager?.let { am ->
        am.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
          if (enabled) {
            val devices = am.availableCommunicationDevices
            val btDevice = devices.find {
              it.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
              it.type == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET
            }
            if (btDevice != null) {
              am.setCommunicationDevice(btDevice)
            } else {
              am.startBluetoothSco()
              am.isBluetoothScoOn = true
            }
          } else {
            am.clearCommunicationDevice()
            am.isBluetoothScoOn = false
            am.stopBluetoothSco()
          }
        } else {
          if (enabled) {
            am.startBluetoothSco()
            am.isBluetoothScoOn = true
          } else {
            am.isBluetoothScoOn = false
            am.stopBluetoothSco()
          }
        }
      }
    }

    Function("isTablet") {
      val context = appContext.reactContext
      val pm = context?.packageManager
      val hasTelephony = pm?.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TELEPHONY) ?: true
      !hasTelephony
    }

    Function("resetAudioMode") {
      val context = appContext.reactContext
      val audioManager = context?.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
      audioManager?.let { am ->
        lastRoutedSpeakerMode = null
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && isCallbackRegistered && audioDeviceCallback != null) {
          try {
            am.unregisterAudioDeviceCallback(audioDeviceCallback)
            isCallbackRegistered = false
          } catch (_: Throwable) {}
        }
        am.isSpeakerphoneOn = false
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
          am.clearCommunicationDevice()
        }
        am.isBluetoothScoOn = false
        try { am.stopBluetoothSco() } catch (_: Throwable) {}
        am.mode = android.media.AudioManager.MODE_NORMAL
      }
    }

    Function("getPendingWebRtcOffer") {
      try {
        val context = appContext.reactContext
        val file = java.io.File(context?.filesDir, "webrtc_offer.json")
        if (file.exists()) {
          val text = file.readText()
          file.delete()
          return@Function text
        }
      } catch (t: Throwable) {}
      return@Function null
    }

    Function("acquireVoipWakeLock") {
      val context = appContext.reactContext ?: return@Function false
      try {
        if (wakeLock == null) {
          val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager
          wakeLock = pm?.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "inWhite:VoIPAudioCallWakeLock")
          wakeLock?.setReferenceCounted(false)
        }
        if (wakeLock?.isHeld == false) {
          wakeLock?.acquire(3600000L) // 1 hour max safeguard
        }

        if (wifiLock == null) {
          val wm = context.applicationContext.getSystemService(android.content.Context.WIFI_SERVICE) as? android.net.wifi.WifiManager
          wifiLock = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            wm?.createWifiLock(android.net.wifi.WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "inWhite:VoIPLowLatencyLock")
          } else {
            @Suppress("DEPRECATION")
            wm?.createWifiLock(android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF, "inWhite:VoIPHighPerfLock")
          }
          wifiLock?.setReferenceCounted(false)
        }
        if (wifiLock?.isHeld == false) {
          wifiLock?.acquire()
        }
        android.util.Log.i("InWhiteRingtone", "VoIP WakeLock & Low-Latency WiFi Lock ACQUIRED")
        return@Function true
      } catch (e: Exception) {
        android.util.Log.w("InWhiteRingtone", "Failed to acquire VoIP locks: ${e.message}")
        return@Function false
      }
    }

    Function("releaseVoipWakeLock") {
      try {
        if (wakeLock?.isHeld == true) {
          wakeLock?.release()
        }
        if (wifiLock?.isHeld == true) {
          wifiLock?.release()
        }
        if (proximityWakeLock?.isHeld == true) {
          proximityWakeLock?.release()
        }
        android.util.Log.i("InWhiteRingtone", "VoIP WakeLock, Low-Latency WiFi & Proximity Lock RELEASED")
        return@Function true
      } catch (e: Exception) {
        android.util.Log.w("InWhiteRingtone", "Failed to release VoIP locks: ${e.message}")
        return@Function false
      }
    }

    Function("acquireProximityLock") {
      val context = appContext.reactContext ?: return@Function false
      try {
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager ?: return@Function false
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
          if (!pm.isWakeLockLevelSupported(android.os.PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
            android.util.Log.d("InWhiteRingtone", "Proximity lock not supported on this hardware")
            return@Function false
          }
        }
        if (proximityWakeLock == null) {
          proximityWakeLock = pm.newWakeLock(android.os.PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "inWhite:VoIPProximityLock")
          proximityWakeLock?.setReferenceCounted(false)
        }
        if (proximityWakeLock?.isHeld == false) {
          proximityWakeLock?.acquire()
          android.util.Log.i("InWhiteRingtone", "Proximity screen-off lock ACQUIRED")
        }
        return@Function true
      } catch (e: Exception) {
        android.util.Log.w("InWhiteRingtone", "Failed to acquire proximity lock: ${e.message}")
        return@Function false
      }
    }

    Function("releaseProximityLock") {
      try {
        if (proximityWakeLock?.isHeld == true) {
          proximityWakeLock?.release()
          android.util.Log.i("InWhiteRingtone", "Proximity screen-off lock RELEASED")
        }
        return@Function true
      } catch (e: Exception) {
        android.util.Log.w("InWhiteRingtone", "Failed to release proximity lock: ${e.message}")
        return@Function false
      }
    }
  }
}
