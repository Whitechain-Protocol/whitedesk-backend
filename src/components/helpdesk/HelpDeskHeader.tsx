import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  ChevronLeft,
  UserCheck,
  HelpCircle,
  RotateCcw,
  ScanLine,
  ShieldCheck,
} from 'lucide-react-native';

interface HelpDeskHeaderProps {
  title?: string;
  isAdmin: boolean;
  isGlobalAdminOrFounder: boolean;
  pendingApprovalsCount: number;
  onBack: () => void;
  onOpenApprovals: () => void;
  onOpenAdminGuide: () => void;
  onRefresh: () => void;
  onOpenScanner: () => void;
  onOpenStation: () => void;
}

export const HelpDeskHeader: React.FC<HelpDeskHeaderProps> = ({
  title = 'Destek',
  isAdmin,
  isGlobalAdminOrFounder,
  pendingApprovalsCount,
  onBack,
  onOpenApprovals,
  onOpenAdminGuide,
  onRefresh,
  onOpenScanner,
  onOpenStation,
}) => {
  return (
    <View style={styles.topBackHeaderRow}>
      <TouchableOpacity
        style={styles.samsungBackRow}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <ChevronLeft size={22} color="#1E293B" strokeWidth={2.4} style={{ marginRight: 4 }} />
        <Text style={styles.samsungBackText}>
          {title}
        </Text>
      </TouchableOpacity>

      {/* Right action buttons: Approvals Badge + Admin Guide (?) + Refresh icon + Scanner + Security Badge (ShieldCheck) */}
      <View style={styles.headerButtonlessActions}>
        {isAdmin && pendingApprovalsCount > 0 && (
          <TouchableOpacity
            style={[
              styles.refreshRoundBtn,
              { marginRight: 8, backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
            ]}
            onPress={onOpenApprovals}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <UserCheck size={16} color="#D97706" strokeWidth={2} />
            <View style={styles.pendingBadgeCircle}>
              <Text style={styles.pendingBadgeCircleText}>{pendingApprovalsCount}</Text>
            </View>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[styles.refreshRoundBtn, { marginRight: 8 }]}
            onPress={onOpenAdminGuide}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HelpCircle size={16} color="#475569" strokeWidth={2} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.refreshRoundBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCcw size={16} color="#475569" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.refreshRoundBtn, { marginLeft: 8 }]}
          onPress={onOpenScanner}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ScanLine size={16} color="#475569" strokeWidth={2} />
        </TouchableOpacity>

        {isGlobalAdminOrFounder && (
          <TouchableOpacity
            style={[
              styles.refreshRoundBtn,
              { marginLeft: 8, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
            ]}
            onPress={onOpenStation}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ShieldCheck size={16} color="#3B82F6" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  samsungBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  samsungBackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerButtonlessActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pendingBadgeCircle: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pendingBadgeCircleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
