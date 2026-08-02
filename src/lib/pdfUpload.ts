import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage } from './firebase';

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // matches storage.rules

export interface PdfFile {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

/** Sanitize a user filename for use in a Content-Disposition header — strips
 *  anything that could break the header or fall outside typical PDF names. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]/g, '').trim();
  return cleaned || 'report.pdf';
}

/**
 * Uploads a PDF to `impact_reports/{reportId}/{fileName}` and returns its
 * public download URL. `contentDisposition: attachment` is set at upload
 * time so the browser downloads the file instead of trying to preview it
 * inline — that's a storage object property, not something an <a download>
 * attribute can force reliably across browsers for a cross-origin URL.
 */
export function uploadReportPdf(
  reportId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<PdfFile> {
  const fileName = safeFileName(file.name);
  const path = `impact_reports/${reportId}/${fileName}`;
  const storageRef = ref(storage, path);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: 'application/pdf',
    contentDisposition: `attachment; filename="${fileName}"`,
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap: UploadTaskSnapshot) => {
        onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => {
        try {
          const fileUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ fileUrl, fileName, fileSize: file.size });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/** Best-effort delete — a report doc can still be removed even if the
 *  underlying file is already gone or Storage is unreachable. */
export async function deleteReportPdf(reportId: string, fileName: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `impact_reports/${reportId}/${fileName}`));
  } catch {
    /* ignore — the Firestore doc delete is what actually matters to the UI */
  }
}
