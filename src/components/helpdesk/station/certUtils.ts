import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { i18nService } from '../../../services/i18nService';

export async function exportOrgPubCertificate(data: {
  enterpriseName?: string;
  appName?: string;
  orgPub?: string;
  enterpriseBlindId?: string;
}) {
  try {
    const orgName = data.enterpriseName || i18nService.t('helpdesk.cert_default_org');
    const certData = {
      enterprise_name: orgName,
      app_name: data.appName || 'WhiteDesk',
      org_pub: data.orgPub || '',
      enterprise_blind_id: data.enterpriseBlindId || '',
      issued_at: new Date().toISOString(),
      authority: i18nService.t('helpdesk.cert_issuer'),
      type: i18nService.t('helpdesk.cert_type'),
    };
    const jsonContent = JSON.stringify(certData, null, 2);
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `${slug}_org_pub.json`;

    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } else {
      const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, jsonContent, 'utf8');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: i18nService.t('settings.cert_export_dialog_title', { orgName }),
          UTI: 'public.json',
        });
      }
    }
  } catch (e) {
    console.warn('[certUtils] exportOrgPubCertificate error:', e);
  }
}
