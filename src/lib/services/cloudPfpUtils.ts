export const CLOUD_ACCOUNTS_BASE = 'https://accounts.betterseqta.org';

export function getFullPfpUrl(pfpUrl: string | null | undefined): string | null {
  if (!pfpUrl) return null;
  if (pfpUrl.startsWith('http://') || pfpUrl.startsWith('https://')) {
    return pfpUrl;
  }
  if (pfpUrl.startsWith('/pfp/') || pfpUrl.startsWith('/api/files/public/') || pfpUrl.startsWith('/api/user/pfp/')) {
    return `${CLOUD_ACCOUNTS_BASE}${pfpUrl}`;
  }
  return pfpUrl;
}

export function pfpUrlWithHash(pfpUrl: string, hash: string | null | undefined): string {
  const full = getFullPfpUrl(pfpUrl);
  if (!full || !hash) return full ?? pfpUrl;
  const url = new URL(full);
  url.searchParams.set('v', hash);
  return url.toString();
}

/** Accounts-hosted avatar URLs that support hash caching (not /hist/). */
export function isAccountsHostedPfpUrl(pfpUrl: string): boolean {
  const full = getFullPfpUrl(pfpUrl) ?? pfpUrl;
  return (
    full.includes('accounts.betterseqta.org') &&
    full.includes('/api/user/pfp/') &&
    !full.includes('/hist/')
  );
}

export function extractAccountsPfpUserId(pfpUrl: string): string | null {
  const full = getFullPfpUrl(pfpUrl) ?? pfpUrl;
  const match = full.match(/\/api\/user\/pfp\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export async function downscaleForUpload(blob: Blob, maxEdge = 512): Promise<Blob> {
  if (!blob.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB');
  }

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to prepare image canvas');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      0.85,
    );
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
