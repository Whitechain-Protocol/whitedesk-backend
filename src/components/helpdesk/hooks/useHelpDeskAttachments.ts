import { useState, useCallback } from 'react';
import { Platform, NativeModules } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { AttachedFile } from '../types';
import { getFileMimeType, isImageFile } from '../utils/fileMimeUtils';

export function useHelpDeskAttachments() {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);

  const attachedFile = attachedFiles[0] || null;

  const setAttachedFile = useCallback((f: AttachedFile | null) => {
    setAttachedFiles(f ? [f] : []);
  }, []);

  const handleRemoveAttachedFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // Format attachments for sending to helpDeskService
  const formatAttachmentForSend = useCallback((files: AttachedFile[]) => {
    if (!files || files.length === 0) return null;
    if (files.length === 1) {
      return {
        data: files[0].data,
        name: files[0].name,
        type: files[0].type,
      };
    }
    return {
      data: JSON.stringify(files),
      name: `${files.length} dosya`,
      type: 'multi',
    };
  }, []);

  // Pick from Camera
  const handlePickCamera = useCallback(async () => {
    setAttachMenuVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const newFile: AttachedFile = {
          data: asset.base64 || '',
          name: 'photo_' + Date.now() + '.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
          url: asset.uri,
        };
        setAttachedFiles(prev => [...prev, newFile]);
      }
    } catch (err) {
      console.warn('[useHelpDeskAttachments] Camera picker error:', err);
    }
  }, []);

  // Pick from Gallery
  const handlePickGallery = useCallback(async () => {
    setAttachMenuVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newFiles: AttachedFile[] = res.assets.map((asset, idx) => ({
          data: asset.base64 || '',
          name: asset.fileName ? asset.fileName.replace(/\.[^.]+$/, '.jpg') : ('photo_' + (Date.now() + idx) + '.jpg'),
          type: 'image',
          mimeType: 'image/jpeg',
          url: asset.uri,
        }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.warn('[useHelpDeskAttachments] Gallery picker error:', err);
    }
  }, []);

  // Pick Document
  const handlePickDocument = useCallback(async () => {
    setAttachMenuVisible(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newDocs: AttachedFile[] = [];
        for (const doc of res.assets) {
          const base64Data = await ReactNativeBlobUtil.fs.readFile(doc.uri, 'base64');
          newDocs.push({
            data: base64Data,
            name: doc.name || 'document.pdf',
            type: 'document',
            mimeType: doc.mimeType || 'application/octet-stream',
          });
        }
        setAttachedFiles(prev => [...prev, ...newDocs]);
      }
    } catch (err) {
      console.warn('[useHelpDeskAttachments] Document picker error:', err);
    }
  }, []);

  const ensureBinaryFile = useCallback(async (dataOrUri: string, targetName: string): Promise<string> => {
    const cleanTargetName = targetName.replace(/[^a-zA-Z0-9._-]/g, '_') || `file_${Date.now()}`;
    const outPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${cleanTargetName}`;

    try {
      if (dataOrUri.startsWith('file://')) {
        const rawPath = dataOrUri.replace('file://', '');
        const exists = await ReactNativeBlobUtil.fs.exists(rawPath);
        if (!exists) return outPath;

        // Check if the file is an ASCII Base64 text file (legacy offload format)
        try {
          const header = await ReactNativeBlobUtil.fs.readFile(rawPath, 'utf8');
          const trimmed = (header || '').trim();
          const isBase64Text =
            trimmed.startsWith('/9j/') ||
            trimmed.startsWith('iVBORw') ||
            trimmed.startsWith('JVBERi') ||
            trimmed.startsWith('UEsDB') ||
            trimmed.startsWith('data:') ||
            /^[A-Za-z0-9+/=]{100,}/.test(trimmed.slice(0, 200));

          if (isBase64Text) {
            const cleanBase64 = trimmed.replace(/^data:[^;]+;base64,/, '').trim();
            await ReactNativeBlobUtil.fs.writeFile(outPath, cleanBase64, 'base64');
            return outPath;
          }
        } catch {
          // If reading as utf8 fails, it's already a native binary file
        }

        // Native binary: copy to CacheDir with proper extension so intent can open it cleanly
        if (rawPath !== outPath) {
          try {
            await ReactNativeBlobUtil.fs.cp(rawPath, outPath);
          } catch {
            return rawPath;
          }
        }
        return outPath;
      }

      if (dataOrUri.startsWith('http://') || dataOrUri.startsWith('https://')) {
        return dataOrUri;
      }

      // Direct Base64 string
      const cleanBase64 = dataOrUri.replace(/^data:[^;]+;base64,/, '').trim();
      await ReactNativeBlobUtil.fs.writeFile(outPath, cleanBase64, 'base64');
      return outPath;
    } catch (err) {
      console.warn('[useHelpDeskAttachments] ensureBinaryFile error:', err);
      return outPath;
    }
  }, []);

  const handleOpenDocument = useCallback(async (name: string, dataOrUri: string) => {
    try {
      const cleanName = name || 'document.pdf';
      const binaryPath = await ensureBinaryFile(dataOrUri, cleanName);
      const isPdf = cleanName.toLowerCase().endsWith('.pdf');

      // Native In-App PDF Rendering: Opens directly inside Sovereign ImagePreviewModal!
      if (Platform.OS === 'android' && isPdf && NativeModules.WhiteDeskNotificationModule?.renderPdfToImage) {
        try {
          const renderedImageUri = await NativeModules.WhiteDeskNotificationModule.renderPdfToImage(binaryPath);
          if (renderedImageUri) {
            setPreviewFileName(cleanName);
            setPreviewImageUri(renderedImageUri);
            return;
          }
        } catch (pdfErr) {
          console.warn('[useHelpDeskAttachments] Native PDF render error, fallback to share:', pdfErr);
        }
      }

      // Fallback for Office docs (docx, xlsx, etc.) or if PDF render fails
      const mime = getFileMimeType(cleanName, 'application/pdf');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(binaryPath, {
          mimeType: mime,
          dialogTitle: cleanName,
        });
      }
    } catch (err) {
      console.warn('[useHelpDeskAttachments] handleOpenDocument error:', err);
    }
  }, [ensureBinaryFile]);

  const handlePreviewImage = useCallback(async (dataOrUri: string, name?: string) => {
    try {
      if (!dataOrUri) return;
      const effectiveName = name || `image_${Date.now()}.jpg`;
      setPreviewFileName(effectiveName);

      if (dataOrUri.startsWith('http://') || dataOrUri.startsWith('https://')) {
        setPreviewImageUri(dataOrUri);
        return;
      }

      const binaryPath = await ensureBinaryFile(dataOrUri, effectiveName);
      const isPdf = effectiveName.toLowerCase().endsWith('.pdf');

      if (Platform.OS === 'android' && isPdf && NativeModules.WhiteDeskNotificationModule?.renderPdfToImage) {
        try {
          const renderedImageUri = await NativeModules.WhiteDeskNotificationModule.renderPdfToImage(binaryPath);
          if (renderedImageUri) {
            setPreviewImageUri(renderedImageUri);
            return;
          }
        } catch (pdfErr) {
          console.warn('[useHelpDeskAttachments] handlePreviewImage PDF render error:', pdfErr);
        }
      }

      setPreviewImageUri(`file://${binaryPath}`);
    } catch (err) {
      console.warn('[useHelpDeskAttachments] handlePreviewImage error:', err);
      setPreviewImageUri(dataOrUri);
    }
  }, [ensureBinaryFile]);

  return {
    attachedFiles,
    setAttachedFiles,
    attachedFile,
    setAttachedFile,
    handleRemoveAttachedFile,
    clearAttachments,
    attachMenuVisible,
    setAttachMenuVisible,
    formatAttachmentForSend,
    handlePickCamera,
    handlePickGallery,
    handlePickDocument,
    previewImageUri,
    setPreviewImageUri,
    previewFileName,
    setPreviewFileName,
    handleOpenDocument,
    handlePreviewImage,
  };
}
