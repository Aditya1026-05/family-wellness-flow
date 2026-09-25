import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust clipboard copy function that works across secure (HTTPS/localhost)
 * and insecure (HTTP on LAN/mobile) contexts, with textarea fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API first (available in secure contexts: HTTPS/localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method if modern API was blocked or rejected
    }
  }

  // 2. Fallback to textarea + execCommand('copy') for LAN/HTTP / older mobile browsers
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999); // Mobile compatibility

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      return false;
    }
  }

  return false;
}

/**
 * Downloads an SVG element as a crisp PNG image.
 * Falls back to SVG download if canvas rendering is unsupported.
 */
export async function downloadSvgAsPng(
  svgElement: SVGElement,
  filename: string = 'carecircle-invite-qr'
): Promise<boolean> {
  if (!svgElement) return false;

  try {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);

    const img = new Image();

    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

    if (loaded) {
      const scale = 2; // High-DPI crisp export
      const width = (svgElement.clientWidth || 200) * scale;
      const height = (svgElement.clientHeight || 200) * scale;
      const padding = 20 * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width + padding * 2;
      canvas.height = height + padding * 2;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Draw crisp rounded white card background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding, width, height);

        DOMURL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${filename}.png`;
        downloadLink.href = pngUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          document.body.removeChild(downloadLink);
        }, 600);
        return true;
      }
    }

    DOMURL.revokeObjectURL(url);
  } catch (err) {
    console.warn('Canvas export failed, falling back to direct SVG download:', err);
  }

  // Fallback to direct SVG file download
  try {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
    return true;
  } catch (err) {
    console.error('Download QR failed:', err);
    return false;
  }
}

/**
 * Shares invite details via Web Share API if supported and valid,
 * otherwise safely copies invite message to clipboard.
 */
export async function shareOrCopyInvite(options: {
  title: string;
  text: string;
  url?: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  const { title, text, url } = options;

  // Determine valid HTTP/HTTPS url (navigator.share throws TypeError if given carecircle://)
  const isHttpUrl = url && (url.startsWith('http://') || url.startsWith('https://'));
  const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const validUrl = isHttpUrl ? url : fallbackUrl;

  const shareData: ShareData = {
    title,
    text,
    ...(validUrl && { url: validUrl }),
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare === 'function') {
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return 'shared';
        }
      } else {
        await navigator.share(shareData);
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'failed';
      }
      console.warn('navigator.share failed, copying to clipboard:', err);
    }
  }

  // Fallback: Copy to clipboard
  const fullMessage = url ? `${text}\n${url}` : text;
  const copied = await copyToClipboard(fullMessage);
  return copied ? 'copied' : 'failed';
}
