// SPDX-License-Identifier: MIT
// inWhite — wg-quick INI → TunnelConfiguration parser.
//
// WireGuardKit does not ship a public INI parser; the official app keeps one in
// its own target. This is a minimal, self-contained parser for the app's needs.
//
// TODO(ios-build): verify every initializer below against the WireGuardKit
// version you actually integrate (PrivateKey/PublicKey/IPAddressRange/DNSServer/
// Endpoint/InterfaceConfiguration/PeerConfiguration/TunnelConfiguration).

import Foundation
import NetworkExtension
import WireGuardKit

extension TunnelConfiguration {
    static func fromWgQuickConfig(_ text: String) -> TunnelConfiguration? {
        var privateKey: String?
        var addresses: [String] = []
        var dnsServers: [String] = []
        var mtu: UInt16?

        var peers: [(publicKey: String, endpoint: String?, allowedIPs: [String])] = []
        var currentSection = ""
        var currentPeerPublicKey: String?
        var currentPeerEndpoint: String?
        var currentPeerAllowedIPs: [String] = []

        func flushPeer() {
            if let pk = currentPeerPublicKey {
                peers.append((pk, currentPeerEndpoint, currentPeerAllowedIPs))
            }
            currentPeerPublicKey = nil
            currentPeerEndpoint = nil
            currentPeerAllowedIPs = []
        }

        for rawLine in text.components(separatedBy: .newlines) {
            var line = rawLine
            if let commentIndex = line.firstIndex(of: "#") {
                line = String(line[..<commentIndex])
            }
            line = line.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }

            if line.hasPrefix("[") && line.hasSuffix("]") {
                if currentSection == "peer" { flushPeer() }
                currentSection = String(line.dropFirst().dropLast()).lowercased()
                continue
            }

            let parts = line.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }
            let key = parts[0].lowercased()
            let value = parts[1]
            let csv = value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }

            switch currentSection {
            case "interface":
                switch key {
                case "privatekey": privateKey = value
                case "address": addresses.append(contentsOf: csv)
                case "dns": dnsServers.append(contentsOf: csv)
                case "mtu": mtu = UInt16(value)
                default: break
                }
            case "peer":
                switch key {
                case "publickey": currentPeerPublicKey = value
                case "endpoint": currentPeerEndpoint = value
                case "allowedips": currentPeerAllowedIPs.append(contentsOf: csv)
                default: break
                }
            default: break
            }
        }
        if currentSection == "peer" { flushPeer() }

        guard let privKey = privateKey,
              let privateKeyValue = PrivateKey(base64Key: privKey) else {
            return nil
        }

        let iface = InterfaceConfiguration(
            name: nil,
            privateKey: privateKeyValue,
            addresses: addresses.compactMap { IPAddressRange(from: $0) },
            dnsServers: dnsServers.compactMap { DNSServer(from: $0) },
            mtu: mtu
        )

        let peerConfigs: [PeerConfiguration] = peers.compactMap { peer in
            guard let pubKey = PublicKey(base64Key: peer.publicKey) else { return nil }
            return PeerConfiguration(
                publicKey: pubKey,
                endpoint: peer.endpoint.flatMap { Endpoint(from: $0) },
                allowedIPs: peer.allowedIPs.compactMap { IPAddressRange(from: $0) },
                persistentKeepAlive: 25,
                preSharedKey: nil
            )
        }

        return TunnelConfiguration(name: "inwhite-wg", interface: iface, peers: peerConfigs)
    }
}
