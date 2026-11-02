import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Search,
  Database,
  Server,
  HardDrive,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Shield,
  Paperclip,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  X,
  FileText,
  Building,
  Lock,
  Share2,
} from 'lucide-react-native';
import {
  fdhQueryService,
  FDHUnifiedTicket,
  FDHUnifiedMessage,
  FDHBatchSummary,
  FDHFilterCriteria,
  FDHPostgresConfig,
} from '../../../../services/harvest/fdhQueryService';

export interface FDHAuditModalProps {
  visible: boolean;
  onClose: () => void;
  language?: string;
  defaultStoragePath?: string;
}

export const FDHAuditModal: React.FC<FDHAuditModalProps> = ({
  visible,
  onClose,
  language = 'tr',
  defaultStoragePath,
}) => {
  // Source Selection
  const [sourceType, setSourceType] = useState<'sqlite' | 'postgres'>('sqlite');

  // SQLite configuration
  const [localPath, setLocalPath] = useState('');

  // PostgreSQL configuration
  const [pgEndpoint, setPgEndpoint] = useState('https://pg.whitex.one/api/v1');
  const [pgApiKey, setPgApiKey] = useState('');
  const [pgDbName, setPgDbName] = useState('whitedesk_fdh');

  // Query & Data state
  const [isLoading, setIsLoading] = useState(false);
  const [batchInfo, setBatchInfo] = useState<FDHBatchSummary | null>(null);
  const [rawTickets, setRawTickets] = useState<FDHUnifiedTicket[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'user'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'pending' | 'resolved' | 'closed'>('all');
  const [onlyWithAttachments, setOnlyWithAttachments] = useState(false);

  // Active inspected ticket
  const [inspectedTicket, setInspectedTicket] = useState<FDHUnifiedTicket | null>(null);

  // Initialize paths and load data on open
  useEffect(() => {
    if (visible) {
      const p = defaultStoragePath || fdhQueryService.getDefaultLocalPath();
      setLocalPath(p);
      setErrorMessage(null);
      setInspectedTicket(null);
      setSearchQuery('');
      setSelectedRole('all');
      setSelectedStatus('all');
      setOnlyWithAttachments(false);
      handleLoadLocal(p);
    }
  }, [visible, defaultStoragePath]);

  // Load from SQLite / Local Manifest
  const handleLoadLocal = async (path?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setInspectedTicket(null);
    try {
      const res = await fdhQueryService.loadLocalHarvest(path || localPath);
      setBatchInfo(res.batch);
      setRawTickets(res.tickets);
    } catch (err: any) {
      console.warn('[FDHAuditModal] Local load error:', err);
      setErrorMessage(err?.message || 'Yerel hasat verileri okunamadı.');
      setRawTickets([]);
      setBatchInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load from PostgreSQL
  const handleLoadPostgres = async () => {
    if (!pgEndpoint.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir PostgreSQL API / REST URL giriniz.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setInspectedTicket(null);
    try {
      const config: FDHPostgresConfig = {
        endpointUrl: pgEndpoint.trim(),
        apiKey: pgApiKey.trim() || undefined,
        databaseName: pgDbName.trim() || undefined,
      };
      const res = await fdhQueryService.queryPostgresHarvest(config);
      setBatchInfo(res.batch);
      setRawTickets(res.tickets);
    } catch (err: any) {
      console.warn('[FDHAuditModal] Postgres query error:', err);
      setErrorMessage(
        err?.message || 'PostgreSQL bağlantısı sağlanamadı. Kurumsal uç noktayı ve ağ erişiminizi kontrol edin.'
      );
      setRawTickets([]);
      setBatchInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const criteria: FDHFilterCriteria = {
      searchQuery,
      targetRole: selectedRole,
      status: selectedStatus,
      hasAttachments: onlyWithAttachments,
    };
    return fdhQueryService.filterTickets(rawTickets, criteria);
  }, [rawTickets, searchQuery, selectedRole, selectedStatus, onlyWithAttachments]);

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'open':
        return { label: 'Açık', bg: '#DCFCE7', text: '#15803D' };
      case 'pending':
        return { label: 'Beklemede', bg: '#FEF3C7', text: '#B45309' };
      case 'resolved':
      case 'closed':
        return { label: 'Çözüldü', bg: '#F1F5F9', text: '#475569' };
      default:
        return { label: status, bg: '#E2E8F0', text: '#334155' };
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Database size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>FDH Sorgulama</Text>
                <Text style={styles.subtitle}>SQLite ve PostgreSQL</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* MAIN VIEW OR TICKET INSPECTION VIEW */}
          {inspectedTicket ? (
            /* TICKET DETAIL VIEW */
            <View style={styles.detailContainer}>
              {/* Detail Subheader */}
              <View style={styles.detailHeader}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setInspectedTicket(null)}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={18} color="#1E293B" />
                  <Text style={styles.backBtnText}>Bilet Listesine Dön</Text>
                </TouchableOpacity>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusBadge(inspectedTicket.status).bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: getStatusBadge(inspectedTicket.status).text },
                    ]}
                  >
                    {getStatusBadge(inspectedTicket.status).label}
                  </Text>
                </View>
              </View>

              {/* Ticket Meta Info Card */}
              <View style={styles.ticketMetaCard}>
                <View style={styles.ticketMetaTop}>
                  <Text style={styles.metaTicketNumber}>#{inspectedTicket.ticketNumber}</Text>
                  <Text style={styles.metaDate}>{formatDate(inspectedTicket.createdAt)}</Text>
                </View>
                <Text style={styles.metaTitle}>{inspectedTicket.title}</Text>

                <View style={styles.metaPillsRow}>
                  <View style={styles.metaPill}>
                    <Building size={12} color="#64748B" />
                    <Text style={styles.metaPillText}>{inspectedTicket.tenantName}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{inspectedTicket.organizationId}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{inspectedTicket.applicationId}</Text>
                  </View>
                </View>

                <View style={styles.metaPartiesRow}>
                  <View style={styles.partyItem}>
                    <Text style={styles.partyLabel}>Açan Kişi:</Text>
                    <View style={styles.partyBadge}>
                      <User size={12} color="#1E293B" />
                      <Text style={styles.partyName}>
                        {inspectedTicket.creatorAlias || inspectedTicket.creatorBlindId.substring(0, 10)}
                      </Text>
                    </View>
                  </View>

                  {inspectedTicket.assignedAdminAlias ? (
                    <View style={styles.partyItem}>
                      <Text style={styles.partyLabel}>Atanan Yönetici:</Text>
                      <View style={styles.partyBadge}>
                        <Shield size={12} color="#2563EB" />
                        <Text style={[styles.partyName, { color: '#2563EB' }]}>
                          {inspectedTicket.assignedAdminAlias}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Messages Timeline */}
              <Text style={styles.timelineHeading}>
                Mesajlar & Denetim Kayıtları ({inspectedTicket.messages?.length || 0})
              </Text>

              <ScrollView style={styles.messagesScroll} contentContainerStyle={{ paddingBottom: 24 }}>
                {inspectedTicket.messages && inspectedTicket.messages.length > 0 ? (
                  inspectedTicket.messages.map((msg, index) => {
                    const isAdmin = msg.senderType === 'admin';
                    return (
                      <View
                        key={msg.id || index}
                        style={[
                          styles.msgBubble,
                          isAdmin ? styles.msgBubbleAdmin : styles.msgBubbleUser,
                          msg.isInternal ? styles.msgBubbleInternal : null,
                        ]}
                      >
                        <View style={styles.msgHeader}>
                          <View style={styles.msgSenderRow}>
                            {isAdmin ? (
                              <Shield size={12} color="#1E293B" />
                            ) : (
                              <User size={12} color="#64748B" />
                            )}
                            <Text style={styles.msgSenderName}>{msg.senderAlias || (isAdmin ? 'Admin' : 'Kullanıcı')}</Text>
                            {msg.isInternal ? (
                              <View style={styles.internalBadge}>
                                <Lock size={10} color="#B45309" />
                                <Text style={styles.internalBadgeText}>Dahili Not</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.msgTime}>{formatDate(msg.createdAt)}</Text>
                        </View>

                        <Text style={styles.msgContent}>{msg.content}</Text>

                        {/* Attachments */}
                        {msg.attachmentName ? (
                          <TouchableOpacity
                            style={styles.attachmentBox}
                            onPress={() => {
                              const p = `${localPath}/attachments/${inspectedTicket.id}/${msg.attachmentName}`;
                              fdhQueryService.openOrShareAttachment(p);
                            }}
                          >
                            <Paperclip size={14} color="#2563EB" />
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {msg.attachmentName}
                            </Text>
                            <Share2 size={12} color="#64748B" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyMessages}>
                    <Text style={styles.emptyMessagesText}>Bu bilet için kayıtlı mesaj bulunamadı.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : (
            /* MAIN LIST & FILTER VIEW */
            <>
              {/* Source Switcher (Yerel SQLite vs PostgreSQL) */}
              <View style={styles.sourceSwitcher}>
                <TouchableOpacity
                  style={[styles.sourceTab, sourceType === 'sqlite' && styles.sourceTabActive]}
                  onPress={() => {
                    setSourceType('sqlite');
                    handleLoadLocal();
                  }}
                  activeOpacity={0.8}
                >
                  <HardDrive size={16} color={sourceType === 'sqlite' ? '#2563EB' : '#64748B'} />
                  <Text style={[styles.sourceTabText, sourceType === 'sqlite' && styles.sourceTabTextActive]}>
                    SQLite
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sourceTab, sourceType === 'postgres' && styles.sourceTabActive]}
                  onPress={() => setSourceType('postgres')}
                  activeOpacity={0.8}
                >
                  <Server size={16} color={sourceType === 'postgres' ? '#2563EB' : '#64748B'} />
                  <Text style={[styles.sourceTabText, sourceType === 'postgres' && styles.sourceTabTextActive]}>
                    PostgreSQL
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Source Connection Bar */}
              <View style={styles.configBar}>
                {sourceType === 'sqlite' ? (
                  <View style={styles.pathInputRow}>
                    <TextInput
                      style={styles.pathInput}
                      value={localPath}
                      onChangeText={setLocalPath}
                      placeholder="Depolama klasör yolu..."
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      style={styles.refreshBtn}
                      onPress={() => handleLoadLocal()}
                      disabled={isLoading}
                    >
                      <RefreshCw size={14} color="#FFFFFF" />
                      <Text style={styles.refreshBtnText}>Tara</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.pgConfigBox}>
                    <View style={styles.pgRow}>
                      <TextInput
                        style={[styles.pathInput, { flex: 2 }]}
                        value={pgEndpoint}
                        onChangeText={setPgEndpoint}
                        placeholder="https://pg-api.kurum.com/v1"
                        placeholderTextColor="#94A3B8"
                      />
                      <TextInput
                        style={[styles.pathInput, { flex: 1, marginLeft: 8 }]}
                        value={pgApiKey}
                        onChangeText={setPgApiKey}
                        placeholder="API Key (opsiyonel)"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                      />
                      <TouchableOpacity
                        style={[styles.refreshBtn, { marginLeft: 8 }]}
                        onPress={handleLoadPostgres}
                        disabled={isLoading}
                      >
                        <RefreshCw size={14} color="#FFFFFF" />
                        <Text style={styles.refreshBtnText}>Bağlan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Batch Summary Bar */}
              {batchInfo && (
                <View style={styles.summaryBar}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Kaynak</Text>
                    <Text style={styles.summaryValue}>
                      {batchInfo.sourceType === 'sqlite' ? 'SQLite' : 'PostgreSQL'}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Bilet</Text>
                    <Text style={styles.summaryValue}>{filteredTickets.length} / {batchInfo.totalTickets}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Mesaj</Text>
                    <Text style={styles.summaryValue}>{batchInfo.totalMessages}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Ek Dosya</Text>
                    <Text style={styles.summaryValue}>{batchInfo.totalAttachments}</Text>
                  </View>
                </View>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Search & Filters */}
              <View style={styles.filterSection}>
                <View style={styles.searchBox}>
                  <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Bilet No, Başlık, İsim veya Mesaj Ara..."
                    placeholderTextColor="#94A3B8"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {/* Role filter */}
                  <TouchableOpacity
                    style={[styles.chip, selectedRole === 'all' && styles.chipActive]}
                    onPress={() => setSelectedRole('all')}
                  >
                    <Text style={[styles.chipText, selectedRole === 'all' && styles.chipTextActive]}>
                      Tüm Roller
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, selectedRole === 'admin' && styles.chipActive]}
                    onPress={() => setSelectedRole('admin')}
                  >
                    <Shield size={12} color={selectedRole === 'admin' ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[styles.chipText, selectedRole === 'admin' && styles.chipTextActive]}>
                      Yöneticiler
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, selectedRole === 'user' && styles.chipActive]}
                    onPress={() => setSelectedRole('user')}
                  >
                    <User size={12} color={selectedRole === 'user' ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[styles.chipText, selectedRole === 'user' && styles.chipTextActive]}>
                      Kullanıcılar
                    </Text>
                  </TouchableOpacity>

                  {/* Status filter */}
                  <TouchableOpacity
                    style={[styles.chip, selectedStatus === 'open' && styles.chipActive]}
                    onPress={() => setSelectedStatus(selectedStatus === 'open' ? 'all' : 'open')}
                  >
                    <Text style={[styles.chipText, selectedStatus === 'open' && styles.chipTextActive]}>
                      Açık Biletler
                    </Text>
                  </TouchableOpacity>

                  {/* Attachment toggle */}
                  <TouchableOpacity
                    style={[styles.chip, onlyWithAttachments && styles.chipActive]}
                    onPress={() => setOnlyWithAttachments(!onlyWithAttachments)}
                  >
                    <Paperclip size={12} color={onlyWithAttachments ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[styles.chipText, onlyWithAttachments && styles.chipTextActive]}>
                      Ekli Olanlar
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Tickets List */}
              {isLoading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.loadingText}>Veri havuzu sorgulanıyor...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredTickets}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <FileText size={36} color="#CBD5E1" />
                      <Text style={styles.emptyTitle}>Eşleşen Bilet Bulunamadı</Text>
                      <Text style={styles.emptySubtitle}>
                        Arama filtrelerini değiştirin veya farklı bir depolama yolu/veritabanı deneyin.
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const statusBadge = getStatusBadge(item.status);
                    const isAdminCreator = item.creatorType === 'admin';

                    return (
                      <TouchableOpacity
                        style={styles.ticketCard}
                        onPress={() => setInspectedTicket(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.ticketCardHeader}>
                          <View style={styles.ticketCardNumberRow}>
                            <Text style={styles.cardTicketNumber}>#{item.ticketNumber}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                                {statusBadge.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                        </View>

                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {item.title}
                        </Text>

                        <View style={styles.cardMetaRow}>
                          <View style={styles.creatorTag}>
                            {isAdminCreator ? (
                              <Shield size={12} color="#1E293B" />
                            ) : (
                              <User size={12} color="#64748B" />
                            )}
                            <Text style={styles.creatorTagText} numberOfLines={1}>
                              {item.creatorAlias || item.creatorBlindId.substring(0, 8)}
                            </Text>
                          </View>

                          <View style={styles.cardOrgTag}>
                            <Text style={styles.cardOrgText}>{item.organizationId}</Text>
                          </View>

                          <View style={styles.countsRow}>
                            <View style={styles.countItem}>
                              <MessageSquare size={12} color="#64748B" />
                              <Text style={styles.countText}>{item.messageCount}</Text>
                            </View>
                            {item.attachmentCount > 0 && (
                              <View style={[styles.countItem, { marginLeft: 8 }]}>
                                <Paperclip size={12} color="#2563EB" />
                                <Text style={[styles.countText, { color: '#2563EB' }]}>
                                  {item.attachmentCount}
                                </Text>
                              </View>
                            )}
                          </View>

                          <ChevronRight size={16} color="#94A3B8" />
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  sourceSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  sourceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  sourceTabActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  sourceTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  sourceTabTextActive: {
    color: '#2563EB',
  },
  configBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  pathInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    marginLeft: 8,
    gap: 6,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pgConfigBox: {
    gap: 6,
  },
  pgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketCardNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTicketNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 10,
    lineHeight: 19,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  creatorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  creatorTagText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  cardOrgTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardOrgText: {
    fontSize: 11,
    color: '#64748B',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
  },

  /* DETAIL VIEW STYLES */
  detailContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  ticketMetaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  ticketMetaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaTicketNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  metaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 10,
  },
  metaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaPillText: {
    fontSize: 11,
    color: '#475569',
  },
  metaPartiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  partyItem: {
    gap: 2,
  },
  partyLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  partyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  timelineHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messagesScroll: {
    flex: 1,
  },
  msgBubble: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    maxWidth: '90%',
  },
  msgBubbleUser: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 2,
  },
  msgBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#EFF6FF',
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  msgBubbleInternal: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  msgSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msgSenderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FDE68A',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  internalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
  },
  msgTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  msgContent: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyMessagesText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
