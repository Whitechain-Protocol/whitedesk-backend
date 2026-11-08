import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { 
  helpDeskService, 
  AdminEntry, 
  AppCatEntry, 
  OrgEntry 
} from '../../../services/helpDeskService';
import { ephemeralAuthService } from '../../../services/ephemeralAuthService';
import { i18nService } from '../../../services/i18nService';

export interface UseHelpDeskConsoleDataProps {
  ownWhiteId: string;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  selectedTenantBlindId: string;
  activeEnterpriseBlindId: string;
  setActiveEnterpriseBlindId: (id: string) => void;
  setIsFounder: (val: boolean) => void;
  setIsMasterAdmin: (val: boolean) => void;
  setTenantStats: React.Dispatch<React.SetStateAction<{ adminCount: number; userCount: number }>>;
  setAdminsList: React.Dispatch<React.SetStateAction<AdminEntry[]>>;
  setAppsList: React.Dispatch<React.SetStateAction<AppCatEntry[]>>;
  setOrgsList: React.Dispatch<React.SetStateAction<OrgEntry[]>>;
  setAllSystemOrgs: (orgs: OrgEntry[]) => void;
  setSelectedAdminId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedAppId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedOrgId: React.Dispatch<React.SetStateAction<string>>;
  setAvailableCategories?: (cats: any[]) => void;
  language: 'tr' | 'en';
  loadData: () => Promise<void>;
}

export function useHelpDeskConsoleData({
  ownWhiteId,
  adminRole,
  selectedTenantBlindId,
  activeEnterpriseBlindId,
  setActiveEnterpriseBlindId,
  setIsFounder,
  setIsMasterAdmin,
  setTenantStats,
  setAdminsList,
  setAppsList,
  setOrgsList,
  setAllSystemOrgs,
  setSelectedAdminId,
  setSelectedAppId,
  setSelectedOrgId,
  setAvailableCategories,
  language,
  loadData,
}: UseHelpDeskConsoleDataProps) {
  const [licensePlans, setLicensePlans] = useState<Array<{
    id: string;
    name: string;
    tier_level: number;
    monthly_price: number;
    annual_price: number;
    features: string[];
    grace_period: string;
    grace_period_warning_interval: string;
    is_active: boolean;
  }>>([]);

  const loadConsoleData = useCallback(async (targetTenantBlindId?: string) => {
    try {
      const myId = await helpDeskService.getOwnWhiteId();
      const role = await helpDeskService.getAdminRole(myId);
      const isFounderUser = role === 'founder' || (role as string) === 'master';
      const master = role === 'global_admin' || isFounderUser;
      setIsFounder(isFounderUser);
      setIsMasterAdmin(master);

      // Resolve tenant scope: Hedef tenant seçilmişse onu kullan, yoksa adminin kendi firmasına kilitlen
      let effectiveTenant: string | undefined = undefined;
      const candidateTenant = targetTenantBlindId !== undefined ? targetTenantBlindId : selectedTenantBlindId;
      if (candidateTenant && candidateTenant !== 'all') {
        effectiveTenant = candidateTenant;
      } else if (!isFounderUser) {
        const { enterpriseBlindId } = await helpDeskService.getAdminEnterprise(myId);
        effectiveTenant = enterpriseBlindId || undefined;
      } else {
        effectiveTenant = activeEnterpriseBlindId || undefined;
      }

      const [admins, apps, orgs, plans, allOrgs, cats] = await Promise.all([
        helpDeskService.getAdminsList(effectiveTenant),
        helpDeskService.getAppCatList(effectiveTenant),
        helpDeskService.getOrgsList(effectiveTenant),
        helpDeskService.getLicensePlans(),
        helpDeskService.getOrgsList('all').catch(() => []),
        helpDeskService.getAppCategories('all', effectiveTenant).catch(() => []),
      ]);

      setLicensePlans(plans);
      if (setAvailableCategories && cats && cats.length > 0) {
        setAvailableCategories(cats);
      }

      if (effectiveTenant && effectiveTenant !== 'all') {
        setActiveEnterpriseBlindId(effectiveTenant);
        try {
          const stats = await helpDeskService.getTenantStats(effectiveTenant);
          setTenantStats(stats);
        } catch {}
      }

      let effectiveAdmins = [...admins];
      if (isFounderUser && !effectiveAdmins.some(a => a.role === 'founder' || a.alias?.toLowerCase() === 'thewhite')) {
        const rootAdmins = await helpDeskService.getAdminsList('blind_11fcac28453c3eaa3a06a5db6caf4ca1');
        const founderEntry = rootAdmins.find(a => a.role === 'founder' || a.alias?.toLowerCase() === 'thewhite') || {
          white_id: myId || 'blind_4fb078269e270cce65f3bd3214142a82',
          alias: 'TheWhite',
          role: 'founder',
          enterprise_blind_id: 'blind_11fcac28453c3eaa3a06a5db6caf4ca1',
          enterprise_name: 'TheWhite Enterprises',
          is_active: true,
          org_id: 'all',
          app_id: 'all',
          created_at: 0,
        };
        effectiveAdmins = [founderEntry, ...effectiveAdmins];
      }

      const sortedAdmins = [...effectiveAdmins].sort((a, b) => {
        const getRank = (adm: AdminEntry) => {
          if (adm.role === 'founder' || adm.role === 'master' || (adm.alias && adm.alias.toLowerCase().trim() === 'thewhite')) return 0;
          if (adm.role === 'global_admin' || (adm.alias && (adm.alias.toLowerCase().includes('whitecosmos') || adm.alias.toLowerCase().includes('global admin')))) return 1;
          return 2;
        };
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.created_at || 0) - (b.created_at || 0);
      });

      setAdminsList(sortedAdmins);
      setAppsList(apps);
      setOrgsList(orgs);
      setAllSystemOrgs(allOrgs || []);

      // Auto-align admin selection
      if (sortedAdmins.length > 0) {
        setSelectedAdminId(prev => (sortedAdmins.some(a => a.white_id === prev) ? prev : sortedAdmins[0].white_id));
      } else {
        setSelectedAdminId('');
      }

      // Auto-align app selection
      if (apps.length > 0) {
        setSelectedAppId(prev => (prev === 'all' || apps.some(a => a.app_id === prev) ? prev : apps[0].app_id));
      } else {
        setSelectedAppId('all');
      }

      // Auto-align org selection
      if (orgs.length > 0) {
        setSelectedOrgId(prev => (prev === '*' || orgs.some(o => o.org_id === prev) ? prev : orgs[0].org_id));
      } else {
        setSelectedOrgId('*');
      }
    } catch (e) {
      console.warn('[HelpDesk] loadConsoleData error:', e);
    }
  }, [selectedTenantBlindId, activeEnterpriseBlindId, setIsFounder, setIsMasterAdmin, setActiveEnterpriseBlindId, setTenantStats, setAdminsList, setAppsList, setOrgsList, setAllSystemOrgs, setSelectedAdminId, setSelectedAppId, setSelectedOrgId]);

  // Real-time Ephemeral Cloudflare Durable Object Auth & Poison Pill Listener
  useEffect(() => {
    if (!ownWhiteId) return;

    ephemeralAuthService.init(ownWhiteId, adminRole, activeEnterpriseBlindId || 'default');

    const unsubscribe = ephemeralAuthService.addListener(async (action) => {
      if (action.action === 'REVOKE') {
        Alert.alert(
          i18nService.t('helpdesk.authority_notice_title'),
          i18nService.t('helpdesk.authority_revoked_desc')
        );
        await loadData();
        await loadConsoleData();
      } else if (action.action === 'PROMOTE') {
        const roleLabel = action.targetRole === 'global_admin'
          ? i18nService.t('helpdesk.role_global_admin')
          : i18nService.t('helpdesk.role_admin');
        Alert.alert(
          i18nService.t('helpdesk.promotion_granted_title'),
          i18nService.t('helpdesk.promotion_granted_desc', { role: roleLabel })
        );
        await loadData();
        await loadConsoleData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ownWhiteId, adminRole, activeEnterpriseBlindId, language, loadData, loadConsoleData]);

  return {
    licensePlans,
    setLicensePlans,
    loadConsoleData,
  };
}
