// SPDX-License-Identifier: MIT
// inWhite — iOS expo-modules bridge.
//
// WireGuard methods are implemented; the remaining Android-only methods
// (ringtone/audio/Battery) are intentionally left as no-ops here until a full
// iOS port is required.

import ExpoModulesCore

public class InWhiteRingtoneModule: Module {
    public func definition() -> ModuleDefinition {
        Name("InWhiteRingtone")

        // --- WireGuard (real) ---
        Function("startWireguard") { (configText: String) in
            InWhiteWireguardManager.shared.connect(configText: configText) { _, _ in }
        }

        Function("stopWireguard") {
            InWhiteWireguardManager.shared.disconnect()
        }

        Function("isWireguardRunning") {
            return InWhiteWireguardManager.shared.isRunning()
        }

        Function("getWireguardState") {
            return InWhiteWireguardManager.shared.getState()
        }

        Function("getWireguardError") {
            return nil
        }

        // --- Android-only (no-ops on iOS for now) ---
        Function("startRingtone") {}
        Function("stopRingtone") {}
        Function("openSamsungBatterySettings") {}
        Function("hideIncomingCallSplash") {}
        Function("setSpeakerphoneOn") { (_ enabled: Bool) in }
        Function("setBluetoothScoOn") { (_ enabled: Bool) in }
        Function("resetAudioMode") {}
        Function("startArmoredVpn") {}
        Function("stopArmoredVpn") {}

        Function("isTablet") {
            return UIDevice.current.userInterfaceIdiom == .pad
        }

        Function("getPendingWebRtcOffer") {
            return nil
        }

        Function("isArmoredVpnRunning") {
            return false
        }

        Function("prepareArmoredVpn") {
            return true
        }
    }
}
