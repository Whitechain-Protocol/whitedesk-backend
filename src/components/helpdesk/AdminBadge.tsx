/**
 * AdminBadge — Unified admin tier badge component.
 *
 * Visual language (same in ticket cards AND message bubbles):
 *   tier 0 → Blue ShieldCheck                   (admin / discussion)
 *   tier 1 → Blue ShieldCheck + 1 green ★       (global_admin / internal_admin_ticket)
 *   tier 2 → Blue ShieldCheck + 2 green ★★      (founder / root_support / thewhite)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShieldCheck, Star } from 'lucide-react-native';

export type AdminBadgeTier = 0 | 1 | 2;

interface AdminBadgeProps {
  tier: AdminBadgeTier;
  /** Icon size — default 13 */
  size?: number;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ tier, size = 13 }) => {
  const starSize = Math.max(8, Math.floor(size * 0.7));

  return (
    <View style={styles.wrapper}>
      {/* Base: blue ShieldCheck for all admin tiers */}
      <View style={[styles.shieldCircle, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
        <ShieldCheck size={size} color="#3B82F6" strokeWidth={2.5} />
      </View>

      {/* tier 1 → 1 green star */}
      {tier >= 1 && (
        <View style={[styles.starCircle, { width: starSize + 4, height: starSize + 4, borderRadius: (starSize + 4) / 2 }]}>
          <Star size={starSize} color="#16A34A" fill="#16A34A" />
        </View>
      )}

      {/* tier 2 → 2nd green star */}
      {tier >= 2 && (
        <View style={[styles.starCircle, { width: starSize + 4, height: starSize + 4, borderRadius: (starSize + 4) / 2, marginLeft: 2 }]}>
          <Star size={starSize} color="#16A34A" fill="#16A34A" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldCircle: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starCircle: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
});

// ─── Tier derivation helpers ─────────────────────────────────────────────────

/**
 * Derive tier from a ticket category string.
 *   'root_support' | 'thewhite_support'  → 2
 *   'internal_admin_ticket'               → 1
 *   'discussion'                          → 0
 */
export function tierFromCategory(category?: string | null): AdminBadgeTier | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c === 'root_support' || c === 'thewhite_support') return 2;
  if (c === 'internal_admin_ticket') return 1;
  if (c === 'discussion') return 0;
  return null;           // regular ticket — no badge
}

/**
 * Derive tier from a sender role (used in message bubbles).
 *   'founder'      → 2
 *   'global_admin' → 1
 *   'admin'        → 0
 *   null / missing → null (not an admin message)
 */
export function tierFromRole(
  isAdmin: boolean,
  senderRole?: 'founder' | 'global_admin' | 'admin' | null,
): AdminBadgeTier | null {
  if (!isAdmin) return null;
  if (senderRole === 'founder') return 2;
  if (senderRole === 'global_admin') return 1;
  return 0;
}
