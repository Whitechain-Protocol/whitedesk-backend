/**
 * WhiteDesk Sovereign HelpDesk Facade Service
 * 
 * Provides 100% backward-compatible API delegation to specialized domain services:
 * - helpDeskStationService: Organizations, Apps, Categories, Allocations, Approvals, SDK Bridges
 * - helpDeskLicenseService: Tenants, Genesis Keys, Licensing Plans, Custom Fields, Logos, Features
 * - helpDeskAuthService: Identity, Claim Commands, Roles, Admin Promotions, QR Verification
 * - helpDeskTicketService: Tickets CRUD, Discussions, Replies, Ratings, Self-Destruction
 * - helpDeskRelayService: Sovereign Cloudflare D1 + R2 Relay sync and vaporization
 */

import { helpDeskStationService } from './helpdesk/helpDeskStationService';
import { helpDeskLicenseService } from './helpdesk/helpDeskLicenseService';
import { helpDeskAuthService } from './helpdesk/helpDeskAuthService';
import { helpDeskTicketService } from './helpdesk/helpDeskTicketService';
import { helpDeskRelayService } from './helpdesk/helpDeskRelayService';
import { slaEscalationService } from './helpdesk/slaEscalationService';
import { adminRosterService } from './helpdesk/adminRosterService';
import { CURRENT_APP_ID } from './helpdesk/types';

// Re-export all domain types and database utilities
export * from './helpdesk/types';
export * from './helpdesk/db';
export * from './helpdesk/helpDeskStationService';
export * from './helpdesk/helpDeskLicenseService';
export * from './helpdesk/helpDeskAuthService';
export * from './helpdesk/helpDeskTicketService';
export * from './helpdesk/helpDeskRelayService';
export * from './helpdesk/slaEscalationService';

export const helpDeskService = {
  appId: CURRENT_APP_ID,

  // ─── AUTH & IDENTITY ────────────────────────────────────────────────────────
  getOwnWhiteId: helpDeskAuthService.getOwnWhiteId.bind(helpDeskAuthService),
  getSavedAdminKey: helpDeskAuthService.getSavedAdminKey.bind(helpDeskAuthService),
  setSavedAdminKey: helpDeskAuthService.setSavedAdminKey.bind(helpDeskAuthService),
  getAdminRole: helpDeskAuthService.getAdminRole.bind(helpDeskAuthService),
  checkIfAdmin: helpDeskAuthService.checkIfAdmin.bind(helpDeskAuthService),
  getUserEnterprise: helpDeskAuthService.getUserEnterprise.bind(helpDeskAuthService),
  getAdminEnterprise: helpDeskAuthService.getAdminEnterprise.bind(helpDeskAuthService),
  bindGlobalAdminLocally: helpDeskAuthService.bindGlobalAdminLocally.bind(helpDeskAuthService),
  suggestAdminAlias: helpDeskAuthService.suggestAdminAlias.bind(helpDeskAuthService),
  getAdminAlias: helpDeskAuthService.getAdminAlias.bind(helpDeskAuthService),
  getAdminWhiteId: helpDeskAuthService.getAdminWhiteId.bind(helpDeskAuthService),
  getCustomAlias: helpDeskAuthService.getCustomAlias.bind(helpDeskAuthService),
  setCustomAlias: helpDeskAuthService.setCustomAlias.bind(helpDeskAuthService),
  claimAdmin: helpDeskAuthService.claimAdmin.bind(helpDeskAuthService),
  handleAdminClaimCommand: helpDeskAuthService.handleAdminClaimCommand.bind(helpDeskAuthService),
  handleUserJoinCommand: helpDeskAuthService.handleUserJoinCommand.bind(helpDeskAuthService),
  getOrCreateProfilePasskey: helpDeskAuthService.getOrCreateProfilePasskey.bind(helpDeskAuthService),
  handleProfilePasskeyClaim: helpDeskAuthService.handleProfilePasskeyClaim.bind(helpDeskAuthService),
  verifyAndConsumeWhiteDeskQr: helpDeskAuthService.verifyAndConsumeWhiteDeskQr.bind(helpDeskAuthService),
  updateAdminPermissions: helpDeskAuthService.updateAdminPermissions.bind(helpDeskAuthService),
  replaceGlobalAdmin: helpDeskAuthService.replaceGlobalAdmin.bind(helpDeskAuthService),
  blockOrDeleteUser: helpDeskAuthService.blockOrDeleteUser.bind(helpDeskAuthService),
  promoteUserToAdmin: helpDeskAuthService.promoteUserToAdmin.bind(helpDeskAuthService),
  grantAdminFromTicket: helpDeskAuthService.grantAdminFromTicket.bind(helpDeskAuthService),

  // ─── LICENSE & ENTERPRISE ───────────────────────────────────────────────────
  getAllTenants: helpDeskLicenseService.getAllTenants.bind(helpDeskLicenseService),
  createSelfServiceTenant: helpDeskLicenseService.createSelfServiceTenant.bind(helpDeskLicenseService),
  getActiveEnterpriseBlindId: helpDeskLicenseService.getActiveEnterpriseBlindId.bind(helpDeskLicenseService),
  getTenantCustomFieldsAndCatalog: helpDeskLicenseService.getTenantCustomFieldsAndCatalog.bind(helpDeskLicenseService),
  updateTenantCustomFieldsAndCatalog: helpDeskLicenseService.updateTenantCustomFieldsAndCatalog.bind(helpDeskLicenseService),
  updateEnterpriseName: helpDeskLicenseService.updateEnterpriseName.bind(helpDeskLicenseService),
  getAdvancedFeaturesConfig: helpDeskLicenseService.getAdvancedFeaturesConfig.bind(helpDeskLicenseService),
  updateAdvancedFeaturesConfig: helpDeskLicenseService.updateAdvancedFeaturesConfig.bind(helpDeskLicenseService),
  getUserAdvancedPreferences: helpDeskLicenseService.getUserAdvancedPreferences.bind(helpDeskLicenseService),
  updateUserAdvancedPreferences: helpDeskLicenseService.updateUserAdvancedPreferences.bind(helpDeskLicenseService),
  getTenantLogo: helpDeskLicenseService.getTenantLogo.bind(helpDeskLicenseService),
  setTenantLogo: helpDeskLicenseService.setTenantLogo.bind(helpDeskLicenseService),
  getTenantLogoAlign: helpDeskLicenseService.getTenantLogoAlign.bind(helpDeskLicenseService),
  setTenantLogoAlign: helpDeskLicenseService.setTenantLogoAlign.bind(helpDeskLicenseService),
  getTenantLoginSettings: helpDeskLicenseService.getTenantLoginSettings.bind(helpDeskLicenseService),
  setTenantLoginSettings: helpDeskLicenseService.setTenantLoginSettings.bind(helpDeskLicenseService),
  generateNewAdminHash: helpDeskLicenseService.generateNewAdminHash.bind(helpDeskLicenseService),
  generateNewUserHash: helpDeskLicenseService.generateNewUserHash.bind(helpDeskLicenseService),
  generateNewGlobalAdminHash: helpDeskLicenseService.generateNewGlobalAdminHash.bind(helpDeskLicenseService),
  getTenantStats: helpDeskLicenseService.getTenantStats.bind(helpDeskLicenseService),
  registerGenesisBundleHashes: helpDeskLicenseService.registerGenesisBundleHashes.bind(helpDeskLicenseService),
  claimUnifiedHash: helpDeskLicenseService.claimUnifiedHash.bind(helpDeskLicenseService),
  getLicensePlans: helpDeskLicenseService.getLicensePlans.bind(helpDeskLicenseService),
  getLicenseAddons: helpDeskLicenseService.getLicenseAddons.bind(helpDeskLicenseService),
  getTenantActiveLicense: helpDeskLicenseService.getTenantActiveLicense.bind(helpDeskLicenseService),
  getUpgradePlans: helpDeskLicenseService.getUpgradePlans.bind(helpDeskLicenseService),
  getAllPlans: helpDeskLicenseService.getAllPlans.bind(helpDeskLicenseService),
  upgradeTenantLicense: helpDeskLicenseService.upgradeTenantLicense.bind(helpDeskLicenseService),
  activateLicenseWithHash: helpDeskLicenseService.activateLicenseWithHash.bind(helpDeskLicenseService),

  // ─── STATION & GOVERNANCE ───────────────────────────────────────────────────
  ensureSchema: helpDeskStationService.ensureSchema.bind(helpDeskStationService),
  getPendingApprovals: helpDeskStationService.getPendingApprovals.bind(helpDeskStationService),
  requestDeletionApproval: helpDeskStationService.requestDeletionApproval.bind(helpDeskStationService),
  reviewApproval: helpDeskStationService.reviewApproval.bind(helpDeskStationService),
  checkAppRegistration: helpDeskStationService.checkAppRegistration.bind(helpDeskStationService),
  requestAppRegistration: helpDeskStationService.requestAppRegistration.bind(helpDeskStationService),
  getPendingAppRequests: helpDeskStationService.getPendingAppRequests.bind(helpDeskStationService),
  approveAppRequest: helpDeskStationService.approveAppRequest.bind(helpDeskStationService),
  rejectAppRequest: helpDeskStationService.rejectAppRequest.bind(helpDeskStationService),
  getAppCatList: helpDeskStationService.getAppCatList.bind(helpDeskStationService),
  getAppCategories: helpDeskStationService.getAppCategories.bind(helpDeskStationService),
  getCategories: helpDeskStationService.getCategories.bind(helpDeskStationService),
  addApp: helpDeskStationService.addApp.bind(helpDeskStationService),
  addCategory: helpDeskStationService.addCategory.bind(helpDeskStationService),
  addCategoryToApp: helpDeskStationService.addCategoryToApp.bind(helpDeskStationService),
  removeCategoryFromApp: helpDeskStationService.removeCategoryFromApp.bind(helpDeskStationService),
  deleteCategory: helpDeskStationService.deleteCategory.bind(helpDeskStationService),
  getAdminsList: helpDeskStationService.getAdminsList.bind(helpDeskStationService),
  addAdmin: helpDeskStationService.addAdmin.bind(helpDeskStationService),
  toggleAdminActiveStatus: helpDeskStationService.toggleAdminActiveStatus.bind(helpDeskStationService),
  removeAdmin: helpDeskStationService.removeAdmin.bind(helpDeskStationService),
  getOrgsList: helpDeskStationService.getOrgsList.bind(helpDeskStationService),
  getTenantMembers: helpDeskStationService.getTenantMembers.bind(helpDeskStationService),
  addOrganization: helpDeskStationService.addOrganization.bind(helpDeskStationService),
  removeOrganizationWithReassign: helpDeskStationService.removeOrganizationWithReassign.bind(helpDeskStationService),
  removeOrganization: helpDeskStationService.removeOrganization.bind(helpDeskStationService),
  removeApp: helpDeskStationService.removeApp.bind(helpDeskStationService),
  saveAdminAlloc: helpDeskStationService.saveAdminAlloc.bind(helpDeskStationService),
  deleteAdminAlloc: helpDeskStationService.deleteAdminAlloc.bind(helpDeskStationService),
  getAdminAllocations: helpDeskStationService.getAdminAllocations.bind(helpDeskStationService),
  createSdkBridge: helpDeskStationService.createSdkBridge.bind(helpDeskStationService),
  revokeSdkBridge: helpDeskStationService.revokeSdkBridge.bind(helpDeskStationService),
  getSdkBridges: helpDeskStationService.getSdkBridges.bind(helpDeskStationService),
  moveAdminToTarget: helpDeskStationService.moveAdminToTarget.bind(helpDeskStationService),
  moveAppToTarget: helpDeskStationService.moveAppToTarget.bind(helpDeskStationService),
  assignCategoryToTarget: helpDeskStationService.assignCategoryToTarget.bind(helpDeskStationService),
  findBestAdminForTicket: helpDeskStationService.findBestAdminForTicket.bind(helpDeskStationService),
  incrementAdminTicketCount: helpDeskStationService.incrementAdminTicketCount.bind(helpDeskStationService),
  decrementAdminTicketCount: helpDeskStationService.decrementAdminTicketCount.bind(helpDeskStationService),
  getEnterpriseAdmins: helpDeskStationService.getEnterpriseAdmins.bind(helpDeskStationService),

  // ─── TICKETS & MESSAGING ────────────────────────────────────────────────────
  getTickets: helpDeskTicketService.getTickets.bind(helpDeskTicketService),
  getLocalTicketMessages: helpDeskTicketService.getLocalTicketMessages.bind(helpDeskTicketService),
  getTicketMessages: helpDeskTicketService.getTicketMessages.bind(helpDeskTicketService),
  createTicket: helpDeskTicketService.createTicket.bind(helpDeskTicketService),
  createDiscussion: helpDeskTicketService.createDiscussion.bind(helpDeskTicketService),
  deleteTicket: helpDeskTicketService.deleteTicket.bind(helpDeskTicketService),
  replyToTicket: helpDeskTicketService.replyToTicket.bind(helpDeskTicketService),
  requestTicketTransfer: helpDeskTicketService.requestTicketTransfer.bind(helpDeskTicketService),
  cancelTicketTransfer: helpDeskTicketService.cancelTicketTransfer.bind(helpDeskTicketService),
  acceptTicketTransfer: helpDeskTicketService.acceptTicketTransfer.bind(helpDeskTicketService),
  rejectTicketTransfer: helpDeskTicketService.rejectTicketTransfer.bind(helpDeskTicketService),
  setTicketStatus: helpDeskTicketService.setTicketStatus.bind(helpDeskTicketService),
  editMessage: helpDeskTicketService.editMessage.bind(helpDeskTicketService),
  reassignTicketAndUserOrgApp: helpDeskTicketService.reassignTicketAndUserOrgApp.bind(helpDeskTicketService),
  resolveTicketByUser: helpDeskTicketService.resolveTicketByUser.bind(helpDeskTicketService),
  startTicketSelfDestruct: helpDeskTicketService.startTicketSelfDestruct.bind(helpDeskTicketService),
  cancelTicketSelfDestruct: helpDeskTicketService.cancelTicketSelfDestruct.bind(helpDeskTicketService),
  startAdminVaultSelfDestruct: helpDeskTicketService.startAdminVaultSelfDestruct.bind(helpDeskTicketService),
  scheduleTicketAutoDelete: helpDeskTicketService.scheduleTicketAutoDelete.bind(helpDeskTicketService),
  cancelTicketAutoDelete: helpDeskTicketService.cancelTicketAutoDelete.bind(helpDeskTicketService),
  closeTicketWithDelay: helpDeskTicketService.closeTicketWithDelay.bind(helpDeskTicketService),
  submitRatingWithDelay: helpDeskTicketService.submitRatingWithDelay.bind(helpDeskTicketService),
  getTicketLifecycleStatus: helpDeskTicketService.getTicketLifecycleStatus.bind(helpDeskTicketService),
  getTicketSelfDestructInfo: helpDeskTicketService.getTicketSelfDestructInfo.bind(helpDeskTicketService),
  submitTicketRating: helpDeskTicketService.submitTicketRating.bind(helpDeskTicketService),
  getAdminRatingsOverview: helpDeskTicketService.getAdminRatingsOverview.bind(helpDeskTicketService),
  attachDiagnosticToTicket: helpDeskTicketService.attachDiagnosticToTicket.bind(helpDeskTicketService),
  deleteTicketDiagnostics: helpDeskTicketService.deleteTicketDiagnostics.bind(helpDeskTicketService),
  claimEscalatedTicket: helpDeskTicketService.claimEscalatedTicket.bind(helpDeskTicketService),

  // ─── CLOUDFLARE D1 RELAY ────────────────────────────────────────────────────
  syncRelayInbox: helpDeskRelayService.syncRelayInbox.bind(helpDeskRelayService),

  // ─── SLA ENGINE & ESCALATION ────────────────────────────────────────────────
  checkAndEscalateTickets: slaEscalationService.checkAndEscalateTickets.bind(slaEscalationService),
  startSlaEngineTimer: slaEscalationService.startSlaEngineTimer.bind(slaEscalationService),
  stopSlaEngineTimer: slaEscalationService.stopSlaEngineTimer.bind(slaEscalationService),
  onSlaEscalated: slaEscalationService.onSlaEscalated.bind(slaEscalationService),

  // ─── ADMIN ROSTER & HEARTBEAT ───────────────────────────────────────────────
  startAdminHeartbeat: adminRosterService.startHeartbeat.bind(adminRosterService),
  stopAdminHeartbeat: adminRosterService.stopHeartbeat.bind(adminRosterService),
  getAdminBreakStatus: adminRosterService.getBreakStatus.bind(adminRosterService),
  setAdminBreakStatus: adminRosterService.setBreakStatus.bind(adminRosterService),
  checkAdminBreakReturn: adminRosterService.checkBreakReturnOnEntry.bind(adminRosterService),
  subscribeAdminBreakStatus: adminRosterService.subscribe.bind(adminRosterService),
  sendAdminHeartbeat: adminRosterService.sendHeartbeat.bind(adminRosterService),
};

export default helpDeskService;
