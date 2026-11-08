package expo.modules.inwhiteringtone

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Single native ringtone source for incoming calls on Android.
 *
 * Lives in this module so BOTH the native FCM service (background/killed) and the
 * JS bridge (foreground) control the SAME MediaPlayer instance — no double-play.
 */
object RingtonePlayer {
  private const val TAG = "InWhiteRingtone"
  private var ringtonePlayer: MediaPlayer? = null
  private var ringbackPlayer: MediaPlayer? = null
  private var radioRingtonePlayer: MediaPlayer? = null
  private var radioRingbackPlayer: MediaPlayer? = null
  private var radioTonePlayer: MediaPlayer? = null
  private var isChimeRunning = false
  private val chimeHandler = Handler(Looper.getMainLooper())
  private var chimeRunnable: Runnable? = null

  fun start(context: Context) {
    try {
      if (ringtonePlayer?.isPlaying == true) return
      stop()

      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val isTablet = !(context.packageManager?.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TELEPHONY) ?: true)

      if (!isTablet && (audioManager.ringerMode == AudioManager.RINGER_MODE_SILENT ||
        audioManager.ringerMode == AudioManager.RINGER_MODE_VIBRATE)
      ) {
        Log.i(TAG, "Ringer mode is silent/vibrate, skipping native ringtone")
        return
      }

      // Route the ringtone through the MEDIA path (MODE_NORMAL), not the
      // communication path. This avoids the proximity sensor and the low-quality
      // communication speaker while the engine is pre-joined muted.
      audioManager.mode = AudioManager.MODE_NORMAL

      val mp = MediaPlayer()
      // Pin the ringtone to the BUILTIN SPEAKER directly. The Agora engine locks
      // the default route to earpiece (setEnableSpeakerphone(false)) to keep the
      // outgoing ringback on the earpiece; that lock must NOT pull the incoming
      // ringtone down to the earpiece too, so we force the speaker here.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val speakerDevice = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).find {
          it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
        }
        if (speakerDevice != null) {
          mp.setPreferredDevice(speakerDevice)
          Log.i(TAG, "Incoming ringtone pinned to SPEAKER")
        }
      }
      val usage = if (isTablet) AudioAttributes.USAGE_MEDIA else AudioAttributes.USAGE_NOTIFICATION_RINGTONE
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(usage)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.isLooping = true
      mp.setVolume(1.0f, 1.0f)
      try {
        val afd = context.resources.openRawResourceFd(R.raw.inwhite_ringtone)
        mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        afd.close()
      } catch (_: Throwable) {
        mp.setDataSource(context, Uri.parse("android.resource://${context.packageName}/raw/inwhite_ringtone"))
      }
      mp.prepare()
      mp.start()
      ringtonePlayer = mp
      Log.i(TAG, "Native incoming ringtone started (isTablet=$isTablet)")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to start native incoming ringtone", t)
    }
  }

  fun stop() {
    try {
      ringtonePlayer?.let { p ->
        if (p.isPlaying) p.stop()
        p.release()
      }
    } catch (_: Throwable) {
    }
    ringtonePlayer = null
    stopRadioRingtone()
    stopNotificationChime()
  }

  // --- Outgoing Ringback Tone (Strictly Earpiece / MODE_IN_COMMUNICATION for P2P Mode) ---
  fun startRingback(context: Context, isTablet: Boolean = false) {
    try {
      if (ringbackPlayer?.isPlaying == true) return
      stopRingback()

      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
      audioManager.isSpeakerphoneOn = false

      if (!isTablet) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val earpieceDevice = audioManager.availableCommunicationDevices.find {
            it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
          }
          if (earpieceDevice != null) {
            audioManager.setCommunicationDevice(earpieceDevice)
          } else {
            audioManager.clearCommunicationDevice()
            audioManager.isSpeakerphoneOn = false
          }
        } else {
          audioManager.isSpeakerphoneOn = false
        }
      }

      val mp = MediaPlayer()
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.isLooping = true
      mp.setVolume(0.85f, 0.85f)
      try {
        val afd = context.resources.openRawResourceFd(R.raw.outgoing_call_ring)
        mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        afd.close()
      } catch (_: Throwable) {
        mp.setDataSource(context, Uri.parse("android.resource://${context.packageName}/raw/outgoing_call_ring"))
      }
      mp.prepare()
      mp.start()
      ringbackPlayer = mp
      Log.i(TAG, "Native P2P outgoing ringback started (Earpiece / MODE_IN_COMMUNICATION)")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to start native P2P ringback", t)
    }
  }

  fun stopRingback() {
    try {
      ringbackPlayer?.let { p ->
        if (p.isPlaying) p.stop()
        p.release()
      }
    } catch (_: Throwable) {
    }
    ringbackPlayer = null
    stopRadioRingback()
  }

  // --- Walkie-Talkie (Telsiz) Radio Tones ---

  private fun pinToSpeaker(mp: MediaPlayer, audioManager: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val speakerDevice = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).find {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
      }
      if (speakerDevice != null) {
        mp.setPreferredDevice(speakerDevice)
      }
    }
  }

  private fun setRawDataSource(mp: MediaPlayer, context: Context, resId: Int) {
    try {
      val afd = context.resources.openRawResourceFd(resId)
      mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
      afd.close()
    } catch (_: Throwable) {
      val resName = context.resources.getResourceEntryName(resId)
      mp.setDataSource(context, Uri.parse("android.resource://${context.packageName}/raw/$resName"))
    }
  }

  fun startRadioRingtone(context: Context) {
    try {
      if (radioRingtonePlayer?.isPlaying == true) return
      stop()
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val isTablet = !(context.packageManager?.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TELEPHONY) ?: true)
      if (!isTablet && (audioManager.ringerMode == AudioManager.RINGER_MODE_SILENT || audioManager.ringerMode == AudioManager.RINGER_MODE_VIBRATE)) {
        Log.i(TAG, "Ringer mode is silent/vibrate, skipping radio incoming ringtone")
        return
      }
      audioManager.mode = AudioManager.MODE_NORMAL
      val mp = MediaPlayer()
      pinToSpeaker(mp, audioManager)
      val usage = if (isTablet) AudioAttributes.USAGE_MEDIA else AudioAttributes.USAGE_NOTIFICATION_RINGTONE
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(usage)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.isLooping = true
      mp.setVolume(1.0f, 1.0f)
      setRawDataSource(mp, context, R.raw.radio_incoming)
      mp.prepare()
      mp.start()
      radioRingtonePlayer = mp
      Log.i(TAG, "Radio incoming ringtone started (speaker, looping)")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to start radio incoming ringtone", t)
    }
  }

  fun stopRadioRingtone() {
    try {
      radioRingtonePlayer?.let { p ->
        if (p.isPlaying) p.stop()
        p.release()
      }
    } catch (_: Throwable) {
    }
    radioRingtonePlayer = null
  }

  fun startRadioRingback(context: Context) {
    try {
      if (radioRingbackPlayer?.isPlaying == true) return
      stopRadioRingback()
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_NORMAL
      audioManager.isSpeakerphoneOn = true
      val mp = MediaPlayer()
      pinToSpeaker(mp, audioManager)
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.isLooping = true
      mp.setVolume(1.0f, 1.0f)
      setRawDataSource(mp, context, R.raw.radio_outgoing)
      mp.prepare()
      mp.start()
      radioRingbackPlayer = mp
      Log.i(TAG, "Radio outgoing ringback started (speaker, looping)")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to start radio outgoing ringback", t)
    }
  }

  fun stopRadioRingback() {
    try {
      radioRingbackPlayer?.let { p ->
        if (p.isPlaying) p.stop()
        p.release()
      }
    } catch (_: Throwable) {
    }
    radioRingbackPlayer = null
  }

  fun playRadioTone(context: Context, type: String) {
    try {
      stopRadioTone()
      val rawRes = if (type == "close") R.raw.radio_close else R.raw.radio_open
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_NORMAL
      val mp = MediaPlayer()
      pinToSpeaker(mp, audioManager)
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.isLooping = false
      mp.setVolume(1.0f, 1.0f)
      setRawDataSource(mp, context, rawRes)
      mp.setOnCompletionListener { p ->
        try { p.release() } catch (_: Throwable) {}
        if (radioTonePlayer === p) radioTonePlayer = null
      }
      mp.prepare()
      mp.start()
      radioTonePlayer = mp
      Log.i(TAG, "Played radio tone: $type")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to play radio tone", t)
    }
  }

  fun stopRadioTone() {
    try {
      radioTonePlayer?.let { p ->
        if (p.isPlaying) p.stop()
        p.release()
      }
    } catch (_: Throwable) {
    }
    radioTonePlayer = null
  }

  private fun createChimePcm(sampleRate: Int = 44100): ByteArray {
    val freqs = doubleArrayOf(523.25, 659.25, 783.99)
    val toneDurations = doubleArrayOf(0.18, 0.18, 0.35)
    var totalSamples = 0
    for (d in toneDurations) {
      totalSamples += (sampleRate * d).toInt()
    }
    val pcm = ByteArray(totalSamples * 2)
    var idx = 0
    for (tIdx in freqs.indices) {
      val f = freqs[tIdx]
      val d = toneDurations[tIdx]
      val samples = (sampleRate * d).toInt()
      for (i in 0 until samples) {
        val t = i.toDouble() / sampleRate
        val progress = i.toDouble() / samples
        val envelope = Math.exp(-3.5 * progress)
        val sample = (Math.sin(2.0 * Math.PI * f * t) * envelope * 0.7 * Short.MAX_VALUE).toInt()
        pcm[idx++] = (sample and 0xFF).toByte()
        pcm[idx++] = ((sample shr 8) and 0xFF).toByte()
      }
    }
    return pcm
  }

  fun startNotificationChime(context: Context) {
    try {
      if (isChimeRunning) return
      isChimeRunning = true

      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_NORMAL

      val sampleRate = 44100
      val pcmData = createChimePcm(sampleRate)

      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val format = AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(sampleRate)
        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
        .build()

      chimeRunnable = object : Runnable {
        override fun run() {
          if (!isChimeRunning) return
          try {
            val track = AudioTrack(
              attributes,
              format,
              pcmData.size,
              AudioTrack.MODE_STATIC,
              AudioManager.AUDIO_SESSION_ID_GENERATE
            )
            track.write(pcmData, 0, pcmData.size)
            track.play()
            chimeHandler.postDelayed({
              try {
                track.stop()
                track.release()
              } catch (_: Throwable) {}
            }, 1000L)
          } catch (t: Throwable) {
            Log.e(TAG, "Chime play error", t)
          }
          if (isChimeRunning) {
            chimeHandler.postDelayed(this, 3500L)
          }
        }
      }
      chimeHandler.post(chimeRunnable as Runnable)
      Log.i(TAG, "Notification chime loop started")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to start notification chime", t)
    }
  }

  fun stopNotificationChime() {
    isChimeRunning = false
    chimeRunnable?.let { chimeHandler.removeCallbacks(it) }
    chimeRunnable = null
    Log.i(TAG, "Notification chime stopped")
  }

  // --- System Telecom Tones (reject / end / busy / offline via ToneGenerator) ---
  fun playTelecomTone(context: Context, type: String) {
    try {
      val toneType = when (type) {
        "busy" -> ToneGenerator.TONE_SUP_BUSY
        "offline" -> ToneGenerator.TONE_SUP_RADIO_NOTAVAIL
        else -> ToneGenerator.TONE_PROP_BEEP
      }
      val durationMs = if (type == "busy" || type == "offline") 1200 else 400
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
      val toneGen = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 80)
      toneGen.startTone(toneType, durationMs)
      Handler(Looper.getMainLooper()).postDelayed({ toneGen.release() }, durationMs + 200L)
      Log.i(TAG, "Played telecom tone: $type")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to play telecom tone", t)
    }
  }
}
