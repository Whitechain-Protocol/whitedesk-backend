// SPDX-License-Identifier: MIT
// inWhite — iOS WireGuard Packet Tunnel Provider (NetworkExtension).
//
// Based on the official wireguard-apple PacketTunnelProvider. Requires the
// wireguard-apple Swift package (WireGuardKit + WireGuardKitGo + WireGuardKitC).
//
// NOTE: not compiled in this workspace (no Xcode/macOS) — verify against the
// WireGuardKit version in use on a Mac.

import Foundation
import NetworkExtension
import os

class PacketTunnelProvider: NEPacketTunnelProvider {

    private lazy var adapter: WireGuardAdapter = {
        return WireGuardAdapter(with: self) { logLevel, message in
            wg_log(logLevel.osLogLevel, message: message)
        }
    }()

    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        guard let tunnelProviderProtocol = self.protocolConfiguration as? NETunnelProviderProtocol,
              let configString = tunnelProviderProtocol.providerConfiguration?["wgQuickConfig"] as? String,
              let tunnelConfiguration = TunnelConfiguration(fromWgQuickConfig: configString) else {
            let error = NSError(domain: "inWhite.WireGuard",
                                code: -1,
                                userInfo: [NSLocalizedDescriptionKey: "Invalid WireGuard configuration"])
            completionHandler(error)
            return
        }

        adapter.start(tunnelConfiguration: tunnelConfiguration) { adapterError in
            guard let adapterError = adapterError else {
                completionHandler(nil)
                return
            }

            wg_log(.error, message: "Failed to start tunnel: \(adapterError)")
            completionHandler(adapterError)
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        adapter.stop { _ in
            completionHandler()
        }
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)? = nil) {
        completionHandler?(nil)
    }
}

extension WireGuardLogLevel {
    var osLogLevel: OSLogType {
        switch self {
        case .verbose: return .debug
        case .error: return .error
        }
    }
}
