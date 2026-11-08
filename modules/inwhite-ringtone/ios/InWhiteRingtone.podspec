require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'InWhiteRingtone'
  s.version        = package['version']
  s.summary        = 'inWhite ringtone + WireGuard bridge'
  s.homepage       = 'https://inwhite.app'
  s.license        = 'MIT'
  s.author         = 'inWhite'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/inwhite/inwhite.git', :tag => "#{s.version}" }
  s.source_files   = 'ios/**/*.{h,m,swift}'
  s.requires_arc   = true
  s.swift_version  = '5.0'

  s.dependency 'ExpoModulesCore'

  # WireGuardKit (wireguard-go + adapter) is added via Swift Package Manager in
  # Xcode, NOT here: add https://github.com/WireGuard/wireguard-apple as an SPM
  # package dependency and link WireGuardKit + WireGuardKitGo + WireGuardKitC
  # to both the app target and the NetworkExtension target.
end
