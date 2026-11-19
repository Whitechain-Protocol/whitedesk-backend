# WhiteDesk — Zero-Knowledge Destek & Yetkilendirme SDK Spesifikasyonu

> Bu belge, WhiteDesk modülünü **sıfırdan bağımsız bir SDK veya standalone uygulama** olarak inşa edecek
> herhangi bir agent veya geliştirici için tek kaynak gerçeğidir.

---

## 1. Genel Mimari ve Sıfır-Bilgi (Zero-Knowledge) Felsefesi

WhiteDesk; inWhite, WhiteFin ve ekosistemdeki diğer tüm uygulamalara gömülü (embedded) çalışan veya
müstakil (standalone) bir mobil/web uygulaması olarak ayağa kalkabilen, **sıfır-bilgi (zero-knowledge / zero-trust)**
ve **kriptografik itimat zinciri** prensibiyle çalışan bir destek platformudur.

- **Kimlik İzolasyonu (Blind ID):** Gerçek WhiteID'ler veritabanına (Neon PostgreSQL) **asla düz metin yazılamaz**.
  Tüm kimlikler `HMAC-SHA256(WhiteID, SystemSalt)` ile tek yönlü körleştirilir (`blind_...`).
- **Kriptografik İtimat Zinciri (No Master Passwords):** Veritabanı yetki kaynağı değildir; yalnızca kör bir kara tahtadır.
  Yönetici yetkileri **TheWhite (Genesis Root)** aktörünün Ed25519 dijital imzasıyla doğrulanır.
- **Canlı Bilet Üzerinden Yetkilendirme:** Yetki dağıtımı için umuma açık butonlar veya açık parolalar kullanılmaz.
  Aday kullanıcı bir bilet açar (`#TKT-XXXXXX`). TheWhite bilet üzerindeki kör kimlik ve açık anahtarı
  yerel özel anahtarıyla (`TheWhite_PrivKey`) Ed25519 imzalar ve `admin_allocations` tablosuna mühürler.
- **SDK-First Yapı (`src/whitedesk-sdk/`):** Çekirdek iş mantığı, kripto motoru ve veritabanı erişimi
  üst uygulamadan tamamen bağımsız bir TypeScript SDK katmanı olarak çalışır.

---

## 2. Neon Veritabanı

### Bağlantı

```
ENDPOINT : https://ep-red-river-b2xdk16j-pooler.c-6.eu-central-1.aws.neon.tech/sql
CONNECTION: postgresql://neondb_owner:npg_DbxBS3NtQK1c@ep-red-river-b2xdk16j-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Her SQL isteği şu formatta `POST` atılır:

```ts
fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Neon-Connection-String': CONNECTION,
  },
  body: JSON.stringify({ query: '<SQL>' }),
});
// Yanıt: { rows: [...] }
```

### Tablolar (Zero-Knowledge DDL)

```sql
-- 1. İMZALI YETKİ TAHSİSLERİ (admin_allocations)
CREATE TABLE IF NOT EXISTS admin_allocations (
  id                SERIAL PRIMARY KEY,
  admin_blind_id    VARCHAR(64) NOT NULL,   -- HMAC-SHA256(WhiteID, Salt)
  admin_pubkey      VARCHAR(64) NOT NULL,   -- Ed25519 Public Key
  app_id            VARCHAR(64) NOT NULL,   -- 'inwhite', 'whitefin' veya '*'
  category_id       VARCHAR(64) NOT NULL,   -- 'connection', 'billing' veya '*'
  role              VARCHAR(32) NOT NULL,   -- 'cosmos', 'admin', 'operator'
  alias             VARCHAR(64) NOT NULL,   -- 'TheWhite', 'Macrocosm', 'Supernova-1'
  granted_by_blind  VARCHAR(64) NOT NULL,   -- Yetkiyi veren TheWhite/Cosmos Blind ID
  nonce             VARCHAR(64) NOT NULL,   -- Replay attack koruması
  signature         TEXT NOT NULL,          -- TheWhite Ed25519 İmzası
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  CONSTRAINT uq_admin_app_cat UNIQUE (admin_blind_id, app_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_alloc_admin_blind ON admin_allocations(admin_blind_id);

-- 2. ÇOK KİRACILI UYGULAMA VE KATEGORİ HARİTASI (whitedesk_app_cat)
CREATE TABLE IF NOT EXISTS whitedesk_app_cat (
  id          SERIAL PRIMARY KEY,
  app_id      VARCHAR(64) NOT NULL,
  category_id VARCHAR(64) NOT NULL,
  label_tr    VARCHAR(255),
  label_en    VARCHAR(255),
  icon        VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_app_category UNIQUE (app_id, category_id)
);

-- 3. DESTEK BİLETLERİ (whitedesk_tickets)
CREATE TABLE IF NOT EXISTS whitedesk_tickets (
  ticket_no            VARCHAR(32) PRIMARY KEY, -- 'TKT-XXXXXX'
  app_id               VARCHAR(64) NOT NULL,
  category_id          VARCHAR(64) NOT NULL,
  ticket_pubkey        VARCHAR(64) NOT NULL,   -- Ephemeral X25519 / Ed25519 PubKey
  user_blind_id        VARCHAR(64) NOT NULL,   -- Kullanıcının Kör Kimliği
  user_pubkey          VARCHAR(64),            -- Kullanıcının Ed25519 PubKey'i (Yetkilendirme için)
  assigned_admin_blind VARCHAR(64),            -- Atanan operatör Blind ID
  subject              VARCHAR(512) NOT NULL,
  payload              TEXT NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open'|'answered'|'resolved'|'closed'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_blind ON whitedesk_tickets(user_blind_id);

-- 4. BİLET MESAJLARI (whitedesk_ticket_messages)
CREATE TABLE IF NOT EXISTS whitedesk_ticket_messages (
  id              SERIAL PRIMARY KEY,
  ticket_no       VARCHAR(32) NOT NULL REFERENCES whitedesk_tickets(ticket_no) ON DELETE CASCADE,
  sender_blind_id VARCHAR(64) NOT NULL,
  sender_role     VARCHAR(20) NOT NULL,        -- 'user' | 'admin'
  sender_alias    VARCHAR(64),                 -- 'Supernova-1'
  message         TEXT NOT NULL,
  attachment_data TEXT,                        -- Base64 ek verisi
  attachment_type VARCHAR(32),                 -- 'image' | 'document'
  attachment_name VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_ticket_no ON whitedesk_ticket_messages(ticket_no);
```

### Ticket ID Formatı

```ts
// 'TKT-' + 6 karakter (Base32 alfabe: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ)
function generateTicketId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `TKT-${rand}`;
}
```

---

## 3. Güvenli Depolama Anahtarları (expo-secure-store)

| Anahtar | İçerik |
|---|---|
| `inwhite_id` | Cihazın WhiteID'si (64 hex) |
| `inwhite_helpdesk_admin_secret` | Master şifre (cihazda saklanır) |
| `inwhite_helpdesk_admin_white_id` | Admin olarak claim edilen WhiteID |
| `inwhite_mailbox_admin_secret` | Legacy fallback |

---

## 4. Sabitler ve İş Kuralları

```ts
const CURRENT_APP_ID = 'inwhite'; // Bu uygulamanın varsayılan app_id'si
```

### Admin Kontrolü Sırası (`checkIfAdmin`)

1. Zero-Knowledge Kör Kimlik (`admin_allocations` tablosunda Ed25519 imza doğrulaması)
2. `whitedesk_admins` tablosunda `blind_id` veya `white_id` aktiflik denetimi
3. `whitedesk_genesis_vault` tablosunda Genesis mühür kontrolü (`claimed_by_blind_id`)
4. Yerel donanım kasasında (`SafeSecureStore`) kayıtlı aktif rol kontrolü (`global_admin` / `admin`)

### Cosmic Alias Hiyerarşisi

| Rol | Koşul | Alias |
|---|---|---|
| `master` | whitedesk_admins tablosu boş (ilk kayıt) | `TheWhite` |
| `master` | Tablo dolu | `WhiteCosmos` |
| `operator` | — | `Supernova-1`, `Andromeda-2`, `Nebula-3`, … |

**STELLAR_NAMES pool (20 isim, döngüsel):**
`Supernova, Andromeda, Nebula, Quasar, Pulsar, Cygnus, Cassiopeia, Orion, Vega, Sirius,
Antares, Arcturus, Rigel, Polaris, Altair, Deneb, Fomalhaut, Capella, Aldebaran, Spica`

Numara = mevcut operator sayısı / 20 + 1 mantığıyla artar.

---

## 5. Registration (Kayıt) Ekranı

**Yeni bir uygulama ilk açıldığında**, cihazda `inwhite_id` anahtarı yoksa kayıt ekranı
gösterilir. WhiteDesk kayıt ekranı yalnızca tek bir şey ister:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   inWhite logosu (metin, #0F172A, 28px bold)    │
│                                                 │
│   "WhiteDesk'e Hoş Geldiniz"                    │
│   subtitle: "Admin WhiteID'nizi girin"          │
│                                                 │
│   ┌───────────────────────────────────────┐     │
│   │  WhiteID (64 hex)...                  │     │
│   └───────────────────────────────────────┘     │
│                                                 │
│   [   Devam Et   ]   ← mavi, aktif olunca       │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Input: `autoCapitalize="none"`, `autoCorrect={false}`, `keyboardType="default"`
- Validasyon: trim + 20 karakter minimum (gerçek WhiteID 64 char)
- Kayıt: `SafeSecureStore.setItemAsync('inwhite_id', whiteId.trim())`
- Kayıt sonrası `CURRENT_APP_ID` için `helpDeskService.ensureSchema()` çağrılır

---

## 6. Ekran Mimarisi

Tüm WhiteDesk görünümleri tek bir ekranda `currentView` state'iyle yönetilir:

```ts
type ViewMode = 'list' | 'compose' | 'detail';
const [currentView, setCurrentView] = useState<ViewMode>('list');
```

---

## 7. Renk Paleti ve Genel Stil

```ts
// Arka plan
screenBg: '#F4F7FA'           // Açık gri-mavi, tüm ekran arka planı

// Beyaz kartlar
cardBg: '#FFFFFF'
cardBorderRadius: 16
cardShadow: { shadowColor:'#000', shadowOffset:{w:0,h:1}, shadowOpacity:0.03, shadowRadius:4, elevation:1 }

// Birincil renk
primary: '#2563EB'            // İnWhite mavisi
primaryLight: '#EFF6FF'
primaryBorder: '#DBEAFE'

// Metin renkleri
textPrimary: '#0F172A'
textSecondary: '#64748B'
textMuted: '#94A3B8'

// Durum renkleri
statusOpen:     { bg:'#FEF3C7', text:'#92400E' }   // Sarı
statusAnswered: { bg:'#DBEAFE', text:'#1E40AF' }   // Mavi
statusClosed:   { bg:'#F1F5F9', text:'#64748B' }   // Gri

// İnce ayırıcılar
divider: '#F1F5F9'
inputBorder: '#E2E8F0'
inputBorderFocus: '#38BDF8'   // Sky-400, aktif TextInput kontürü
```

### Tipografi

```ts
fontTitle:    { fontSize:16, fontWeight:'700', color:'#0F172A' }
fontSubtitle: { fontSize:13, fontWeight:'600', color:'#1E293B' }
fontBody:     { fontSize:13, fontWeight:'400', color:'#374151' }
fontMuted:    { fontSize:11, fontWeight:'400', color:'#94A3B8' }
fontMono:     { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }
fontLogo:     { fontSize:22, fontWeight:'800', color:'#0F172A', letterSpacing:-0.5 }
```

---

## 8. Liste Görünümü (currentView === 'list')

### 8.1 Genel Yapı

```
SafeAreaView (bg: #F4F7FA, flex:1)
  StatusBar (translucent, dark-content)
  Animated.ScrollView (tüm ekranı kaplar, absoluteFillObject)
    View: Logo satırı (inWhite logosu — dokunulmazlık kuralı)
    View: Section header row
      Text: "WhiteDesk" + "Admin" badge (eğer admin)
      TouchableOpacity: 🔒 lock ikonu (sağda)
    FlatList / map: Ticket kartları
  TouchableOpacity: FAB "+" butonu (yeni bilet compose'u açar)
```

### 8.2 Ticket Kartı (`fluidTicketCard`)

```tsx
<TouchableOpacity style={styles.fluidTicketCard} onPress={() => açDetayView(ticket)}>
  {/* Üst satır: Ticket ID (monospace) + App badge + Category badge + Status pill */}
  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      <Text style={fontMono}>#TKT-XXXXXX</Text>
      <View style={appTagBadge}><Text>{app_id}</Text></View>
      {category && <View style={categoryBadge}><Text>{catLabel}</Text></View>}
      {isAdmin && <Text style={adminSenderText}>({formatWhiteId(user_white_id)})</Text>}
    </View>
    {renderStatusPill(status)}   {/* 'open'|'answered'|'closed' */}
  </View>

  {/* Konu */}
  <Text style={ticketSubjectText} numberOfLines={2}>{subject}</Text>

  {/* Alt satır: tarih */}
  <View style={cardBottomRow}>
    <Text style={fontMuted}>{formatTicketDate(created_at)}</Text>
  </View>
</TouchableOpacity>
```

**Status Pill renkleri:**

| Status | Background | Text |
|---|---|---|
| `open` | `#FEF3C7` | `#92400E` |
| `answered` | `#DBEAFE` | `#1E40AF` |
| `closed` | `#F1F5F9` | `#64748B` |

### 8.3 Admin Ekstra: Filtre Bar

Admin görünümünde ticket listesi üstünde yatay kaydırmalı App + Category filtre pill'leri bulunur.

### 8.4 Boş Liste

```
<View centered>
  <MessageSquare size={40} color="#CBD5E1" />
  <Text>Henüz destek talebiniz bulunmuyor.</Text>
  <Text muted>Yeni bir talep oluşturun.</Text>
</View>
```

### 8.5 FAB Butonu (Floating Action Button)

```tsx
position: 'absolute', bottom: insets.bottom + 20, right: 20,
width: 52, height: 52, borderRadius: 26,
backgroundColor: '#2563EB',
shadow: { shadowColor:'#2563EB', opacity:0.3, radius:8, elevation:6 }
// İçi: <Plus size={22} color="#FFF" />
```

---

## 9. Compose Görünümü (currentView === 'compose')

### 9.1 Yapı

```
View (screenContainer, bg: #F4F7FA)
  StatusBar
  View: Semi-transparent status bar overlay (height: safeTop, rgba(244,247,250,0.5))
  KeyboardAvoidingView behavior='padding'
    ScrollView (ref=composeScrollRef, keyboardShouldPersistTaps='handled')
      View: Logo satırı (scroll edince status bar'ın altından geçer)
      View: Section header (← Geri + "Yeni Talep" başlığı)
      View: Compose Card (fluidTicketCard stili)
        TextInput: Konu (subject)
        ScrollView: Category pills (yatay)
        TextInput: Mesaj (multiline, minHeight:140)
        View: Bottom bar (Ekle ikonları + Gönder butonu)
```

### 9.2 Compose Kart

```tsx
<View style={composeCardFluid}>  // fluidTicketCard ile aynı stil
  {/* Konu input */}
  <TextInput
    placeholder="Konuyu kısaca özetleyin..."
    style={composeSubjectInput}   // fontSize:15, fontWeight:'600', color:'#0F172A'
  />

  {/* Kategori seçimi — yatay scroll */}
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {categories.map(cat => (
      <TouchableOpacity
        style={[catPill, selected && catPillSelected]}
        onPress={() => setCategory(cat.id)}
      >
        <Text>{cat.labelTr || cat.labelEn}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>

  {/* Mesaj alanı */}
  <TextInput
    multiline
    style={composeTextArea}   // minHeight:140, transparent bg, F1F5F9 border
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    // focus anında borderColor: '#38BDF8'
  />

  {/* Attachment önizleme chip (dosya eklendiyse) */}

  {/* Alt bar */}
  <View style={bottomRow}>
    <TouchableOpacity onPress={openCamera}><Camera size={18} color="#64748B"/></TouchableOpacity>
    <TouchableOpacity onPress={openGallery}><ImageIcon size={18} color="#64748B"/></TouchableOpacity>
    <TouchableOpacity onPress={openDocument}><FileText size={18} color="#64748B"/></TouchableOpacity>
    <View flex={1} />
    <TouchableOpacity style={[sendBtn, hasContent && sendBtnActive]} onPress={handleSubmit}>
      <Send size={16} color={hasContent ? '#FFF' : '#94A3B8'} />
      <Text>Gönder</Text>
    </TouchableOpacity>
  </View>
</View>
```

**Send Button:**

```ts
sendBtn:       { bg:'#F1F5F9', borderRadius:12, px:16, py:10, border:'1px #E2E8F0' }
sendBtnActive: { bg:'#2563EB', border:'#2563EB' }
```

---

## 10. Detay Görünümü (currentView === 'detail')

### 10.1 Yapı

```
View (screenContainer)
  StatusBar
  Semi-transparent overlay (safeTop yüksekliğinde, rgba(244,247,250,0.5))

  Animated.ScrollView (absoluteFillObject, paddingBottom: replyPanel + keyboard)
    View: Logo satırı
    View: Section header (← Geri + "WhiteDesk" / "WhiteDesk Admin" + Status toggle butonu)

    {/* Ticket başlık kartı — fluidTicketCard stiliyle */}
    <View style={detailCardHeaderFluid}>
      <View row>
        <Text mono>#{ticket.id}</Text>
        <View appTagBadge><Text>{app_id}</Text></View>
        <View categoryBadge><Text>{category}</Text></View>
        {isAdmin && <Text adminSenderText>({formatWhiteId(user_white_id)})</Text>}
        {renderStatusPill(status)}
      </View>
      <Text style={detailSubjectText}>{subject}</Text>
      <View bottomRow>
        <Text muted>Oluşturma: {formatTicketDate(created_at)}</Text>
      </View>
    </View>

    {/* Mesaj listesi */}
    {messages.map(msg => renderMessage(msg))}

  {/* Reply paneli — absolute, klavye üstünde */}
  <View style={replyCardPanelContainerFluid}>
    {editingMessage && <EditIndicatorBar />}
    {attachedFile && <AttachPreviewChip />}
    <TextInput
      style={[replyPanelTextArea, focused && {borderColor:'#38BDF8'}]}
      multiline
      onFocus={() => setReplyFocused(true)}
      onBlur={() => setReplyFocused(false)}
    />
    <View replyPanelBottomRow>
      <Camera /> <ImageIcon /> <FileText />  {/* attachment butonları */}
      <View flex={1}/>
      <TouchableOpacity style={[sendBtn, hasContent && sendBtnActive]} onPress={handleReply}>
        <Send/><Text>{editingMessage ? 'Güncelle' : 'Yanıtla'}</Text>
      </TouchableOpacity>
    </View>
  </View>
```

### 10.2 Mesaj Baloncukları

```ts
// Benim mesajım (isMine = true)
myBubble: {
  alignSelf: 'flex-end',
  backgroundColor: '#2563EB',
  borderRadius: 16, borderBottomRightRadius: 4,
  padding: 12, maxWidth: '78%', marginBottom: 8
}

// Karşı taraf
theirBubble: {
  alignSelf: 'flex-start',
  backgroundColor: '#FFFFFF',
  borderRadius: 16, borderBottomLeftRadius: 4,
  padding: 12, maxWidth: '78%', marginBottom: 8,
  elevation: 1, shadowOpacity: 0.03
}
```

### 10.3 Reply Panel Stili (fluidTicketCard ile aynı)

```ts
replyCardPanelContainerFluid: {
  position: 'absolute', left: 14, right: 14, zIndex: 20,
  backgroundColor: '#FFFFFF',
  borderRadius: 16, borderWidth: 0, padding: 15,
  shadowColor: '#000', shadowOffset:{w:0,h:1}, shadowOpacity:0.03, shadowRadius:4,
  elevation: 1,
  // bottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom, 12)
}

replyPanelTextArea: {
  backgroundColor: 'transparent',
  borderWidth: 1, borderColor: '#F1F5F9',
  borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  fontSize: 13, color: '#0F172A',
  minHeight: 65, maxHeight: 115,
  textAlignVertical: 'top', marginBottom: 10,
}
// Focus → borderColor: '#38BDF8'
```

### 10.4 Status Toggle Butonu

Admin, detay ekranında üstte "Bileti Kapat" / "Yeniden Aç" butonu görür:

```ts
statusToggleBtnFluid:       { bg:'#F1F5F9', borderRadius:999, px:12, py:5, border:'#E2E8F0' }
statusToggleBtnFluidClosed: { bg:'#DCFCE7', border:'#BBF7D0' }  // yeşil tonu
```

### 10.5 Mesajda Uzun Basınca Düzenleme

Son mesaj, benim mesajım ve bilet kapalı değilse → uzun basınca `editingMessage` state'ine set
edilir. Edit mode'da üstte mavi banner çıkar, TextInput dolup aktif olur.

---

## 11. Admin Provizyon Konsolu

### 11.1 Açılış Akışı

```
1. Kilit ikonu (🔒) → handleLockPress()
2. Yerel ADMIN_KEY = MASTER_ADMIN_SECRET → konsol direk açılır
3. Değilse → Şifre Modal açılır
4. Şifre doğrulandı → claimAdmin() → konsol açılır
```

### 11.2 Konsol Yapısı

```
Modal (animationType:'slide', transparent:true)
  View overlay (rgba(0,0,0,0.4), justifyContent:'center')
    View container (bg:#FFF, borderRadius:24, padding:20, flex:1, flexShrink:1, maxHeight:'88%')

      {/* Header */}
      <ShieldCheck /> "WhiteDesk Provizyon Konsolu"
      subtitle: "Admin ➔ Uygulama ➔ Kategori Tahsisi"
      <LogOut />  <X />

      {/* Scrollable content */}
      <ScrollView flex:1>

        {/* TIER 1 — Admin */}
        <View tierSection>
          <View tierHeaderRow>
            <View tierBadge><Text>1</Text></View>  {/* mavi daire */}
            <View flex:1 />
            <TouchableOpacity tierIconBtn onPress={openAddAdminModal}>
              <Plus size={15} color="#2563EB"/>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal>
            {adminsList.map(adm => <AdminPill />)}
          </ScrollView>
        </View>

        {/* TIER 2 — Uygulama */}
        <View tierSection>
          <View tierHeaderRow>
            <View tierBadge><Text>2</Text></View>
            <View flex:1 />
            <TouchableOpacity tierIconBtn onPress={() => setAddAppModalVisible(true)}>
              <Plus size={15} color="#2563EB"/>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal>
            <AppPill id="all" icon={<Layers/>} />
            {appsList.map(app => <AppPill />)}
          </ScrollView>
        </View>

        {/* TIER 3 — Kategori */}
        <View tierSection>
          <View tierHeaderRow>
            <View tierBadge><Text>3</Text></View>
            <View flex:1 />
            <TouchableOpacity
              tierIconBtn
              style={selectedAppId==='all' && {opacity:0.3}}
              onPress={() => selectedAppId!=='all' && setAddCatModalVisible(true)}
            >
              <Plus size={15} color="#2563EB"/>
            </TouchableOpacity>
          </View>
          {selectedAppId === 'all'
            ? <AllCoveredBanner />
            : <ScrollView horizontal>
                <CatPill id="all" label="✨ Tümü" />
                {currentAppCategories.map(cat =>
                  <CatPill
                    onPress={() => handleToggleCategory(cat.id)}
                    onLongPress={() => handleDeleteCategoryFromApp(cat.id, catLabel)}
                    delayLongPress={600}
                  />
                )}
              </ScrollView>
          }
        </View>

        {/* Kaydet Butonu */}
        <TouchableOpacity style={sealBtn} onPress={handleSaveAllocationSubmit}>
          <CheckCircle2 /> "TAHSİSİ MÜHÜRLE & KAYDET"
        </TouchableOpacity>

        {/* Aktif Tahsis Listesi */}
        <View>
          {allocationsList.map(alloc => <AllocRowCard />)}
        </View>

      </ScrollView>
    </View>
  </View>
</Modal>
```

### 11.3 Tier Stiller

```ts
tierBadge: {
  width:20, height:20, borderRadius:10,
  backgroundColor:'#2563EB',
  justifyContent:'center', alignItems:'center', marginRight:6
}
tierBadgeText: { fontSize:11, fontWeight:'700', color:'#FFF' }

tierIconBtn: {
  width:26, height:26, borderRadius:13,
  backgroundColor:'#EFF6FF',
  borderWidth:1, borderColor:'#DBEAFE',
  justifyContent:'center', alignItems:'center'
}

tierHScroll: { paddingVertical:2 }
```

### 11.4 Admin Pill Stili

```ts
adminPill: {
  flexDirection:'row', alignItems:'center',
  backgroundColor:'#F8FAFC',
  borderRadius:12, paddingHorizontal:12, paddingVertical:8,
  borderWidth:1, borderColor:'#E2E8F0', marginRight:8, minWidth:100
}
adminPillSelected: { backgroundColor:'#EFF6FF', borderColor:'#2563EB' }
// İçi: alias (bold) + formatWhiteId(id) (küçük muted) + Trash2 ikonu
```

### 11.5 App Pill Stili

```ts
appPill: {
  flexDirection:'row', alignItems:'center',
  backgroundColor:'#F8FAFC',
  borderRadius:999, paddingHorizontal:12, paddingVertical:7,
  borderWidth:1, borderColor:'#E2E8F0', marginRight:8
}
appPillSelected: { backgroundColor:'#EFF6FF', borderColor:'#2563EB' }
```

### 11.6 Category Pill Stili

```ts
catPill: {
  backgroundColor:'#F1F5F9',
  borderRadius:999, paddingHorizontal:12, paddingVertical:7,
  borderWidth:1, borderColor:'transparent', marginRight:6
}
catPillSelected: { backgroundColor:'#EFF6FF', borderColor:'#2563EB' }
catPillText:         { fontSize:12, color:'#374151' }
catPillTextSelected: { color:'#2563EB', fontWeight:'600' }
```

### 11.7 Add Admin Modal

```
Input 1: WhiteID  (autoCapitalize:'none')
Input 2: Alias    (pre-filled: suggestAdminAlias(role))
         → Sağ tarafta ↺ (RotateCcw) ikonu: yeni alias önerisi çeker
Butonlar: Vazgeç | Ekle
```

**Alias öneri kuralı:**
- `newAdminIdInput === ownWhiteId` → `role='master'`
- diğer → `role='operator'`

### 11.8 Add App Modal

```
Input: App ID (lowercase, alfanumerik-tire)
Butonlar: Vazgeç | Ekle
```

### 11.9 Add Category Modal

```
Input 1: Kategori Kodu  (lowercase, örn: billing, kargo, teknik)
Input 2: Kategori Adı   (şirket kendi dilinde, tek alan — labelTr=labelEn=bu değer)
Butonlar: Vazgeç | Ekle
```

### 11.10 Allocation İş Mantığı

`handleSaveAllocationSubmit`:
- `selectedAdminId` + `selectedAppId` + `selectedCatIds` → `whitedesk_admin_alloc`'a upsert
- `categories` varsayılan: `['all']`
- Her admin-app çifti için tek kayıt (UNIQUE mantığı: önce DELETE, sonra INSERT)

`handleDeleteAlloc(adminWhiteId, appId)`:
- `DELETE FROM whitedesk_admin_alloc WHERE admin_white_id=... AND app_id=...`

---

## 12. Klavye Davranışı (Android Kritik)

```tsx
// TÜM modallarda:
<KeyboardAvoidingView behavior='padding'>  {/* NOT: 'padding' her iki platform için */}
```

`AndroidManifest.xml`:
```xml
android:windowSoftInputMode="adjustResize"
```

**Reply panel klavye takibi:**

```ts
const [keyboardHeight, setKeyboardHeight] = useState(0);

useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
  const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
  return () => { show.remove(); hide.remove(); };
}, []);

// Reply panel'in bottom değeri:
bottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom, 12)
```

---

## 13. Alert / Onay Kuralı

**`Alert.alert` kullanımı kesinlikle yasaktır.**

Tüm onay ve uyarı diyalogları için `BottomConfirmationSheet` bileşeni kullanılır:

```tsx
<BottomConfirmationSheet
  visible={confirmSheet.visible}
  title={confirmSheet.title}
  description={confirmSheet.description}
  actionText={confirmSheet.actionText}
  actionColor={confirmSheet.actionColor}
  cancelText={confirmSheet.cancelText}
  onAction={confirmSheet.onAction}
  onCancel={confirmSheet.onCancel}
/>
```

State pattern:

```ts
const [confirmSheet, setConfirmSheet] = useState({
  visible: false,
  title: '', description: '', actionText: '', actionColor: '#EF4444',
  cancelText: 'Vazgeç',
  onAction: () => {}, onCancel: () => {},
});
```

---

## 14. Yardımcı Fonksiyonlar

```ts
// WhiteID'nin ilk 8 karakterini göster
formatWhiteId(id: string) => `${id.slice(0,4)}…${id.slice(-4)}`

// App ID'yi okunabilir formata çevir
formatAppId(id: string) => id.charAt(0).toUpperCase() + id.slice(1)

// Tarih formatlama
formatTicketDate(ts: number, long=false) =>
  long
    ? new Date(ts).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date(ts).toLocaleDateString('tr-TR', { day:'2-digit', month:'short' })
```

---

## 15. Lokalizasyon

Desteklenen diller: `tr` (Türkçe, varsayılan) ve `en` (İngilizce).

`getLabel(key, tr, en)` yardımcı fonksiyonu:

```ts
const getLabel = (key: string, tr: string, en: string) =>
  language === 'tr' ? tr : en;
```

Dil tercihi `SafeSecureStore` veya sistem dil ayarından okunur.

---

## 16. Bağımlılıklar

```json
{
  "expo-secure-store":    "~14.0.1",
  "expo-image-picker":   "~16.0.6",
  "expo-document-picker":"~13.0.3",
  "lucide-react-native": "^0.475.0",
  "@react-native-community/blur": "^4.4.1"
}
```

**Kullanılan Lucide ikonları:**
`Lock, ShieldCheck, LogOut, Plus, X, Trash2, UserCheck, Layers,
CheckCircle2, RotateCcw, Send, Camera, Image, FileText, ChevronLeft,
MessageSquare, Edit3, MoreVertical`

---

## 17. Yeni Uygulama Entegrasyon Adımları

1. **Registration Screen:** Cihazda WhiteID yoksa önce yalnızca Admin WhiteID'yi iste →
   `SafeSecureStore.setItemAsync('inwhite_id', id)` → `ensureSchema()` çağır
2. **`CURRENT_APP_ID`** değerini uygulamaya göre ayarla (örn. `'whitefin'`)
3. **Neon bağlantısı:** endpoint ve connection string sabit kalır, tablo yapısı aynıdır
4. **Kategoriler:** İlk açılışta `ensureSchema()` içinde `whitedesk_app_cat`'a
   uygulamaya özgü varsayılan kategoriler seed edilir
5. **Admin akışı:** Kilit ikonu → şifre → `claimAdmin()` → ilk admin kaydı `TheWhite` alias'ıyla
   `whitedesk_admins`'e yazılır
6. **Push Notification:** `replyToTicket` ve `createTicket` içinde FCM push gönderilir.
   Yeni uygulama kendi FCM backend entegrasyonunu sağlamalıdır.
