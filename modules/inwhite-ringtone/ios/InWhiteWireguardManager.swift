// SPDX-License-Identifier: MIT
// inWhite — App-side WireGuard tunnel manager (NETunnelProviderManager).
//
// Saves a wg-quick config into the system VPN preferences and drives the
// NetworkExtension. Mirrors vpnService.ts on Android.
//
// NOTE: `providerBundleIdentifier` must match the NetworkExtension target's
// bundle id that you create in Xcode (see README.md).

import Foundation
import NetworkExtension

final class InWhiteWireguardManager {
    static let shared = InWhiteWireguardManager()

    private let providerBundleIdentifier = "com.mceryilmaz.inwhite.wireguard-tunnel"

    enum State: String {
        case down = "DOWN"
        case connecting = "CONNECTING"
        case up = "UP"
        case error = "ERROR"
    }

    private var currentState: State = .down

    func getState() -> String {
        return currentState.rawValue
    }

    func isRunning() -> Bool {
        return currentState == .up
    }

    /// Saves the WireGuard config, then starts the tunnel.
    func connect(configText: String, completion: @escaping (Bool, String?) -> Void) {
        currentState = .connecting

        let proto = NETunnelProviderProtocol()
        proto.providerBundleIdentifier = providerBundleIdentifier
        proto.serverAddress = "inwhite-wg"
        proto.providerConfiguration = ["wgQuickConfig": configText]

        let manager = NETunnelProviderManager()
        manager.protocolConfiguration = proto
        manager.localizedDescription = "inWhite Armored VPN"
        manager.isEnabled = true

        manager.saveToPreferences { [weak self] saveError in
            guard let self = self else { return }
            if let saveError = saveError {
                self.currentState = .error
                completion(false, saveError.localizedDescription)
                return
            }

            manager.loadFromPreferences { [weak self] loadError in
                guard let self = self else { return }
                if let loadError = loadError {
                    self.currentState = .error
                    completion(false, loadError.localizedDescription)
                    return
                }

                do {
                    try manager.connection.startVPNTunnel()
                    self.currentState = .up
                    completion(true, nil)
                } catch {
                    self.currentState = .error
                    completion(false, error.localizedDescription)
                }
            }
        }
    }

    func disconnect() {
        NETunnelProviderManager.loadAllFromPreferences { managers in
            for manager in managers ?? [] {
                if manager.protocolConfiguration is NETunnelProviderProtocol {
                    manager.connection.stopVPNTunnel()
                }
            }
        }
        currentState = .down
    }
}
