import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust clipboard copy function that works across desktop and mobile
 * (including iOS Safari and Android Chrome on HTTP LAN / non-secure contexts).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API (available on HTTPS or localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to mobile fallback
    }
  }

  // 2. Mobile-compatible DOM copy (iOS Safari & Android Chrome)
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      // Do NOT set readonly or disabled as iOS WebKit forbids copying from them
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('spellcheck', 'false');

      // Place in visible viewport area so WebKit doesn't cull selection, but keep visually subtle
      el.style.position = 'fixed';
      el.style.top = '10px';
      el.style.left = '10px';
      el.style.width = '2em';
      el.style.height = '2em';
      el.style.padding = '0';
      el.style.border = 'none';
      el.style.outline = 'none';
      el.style.boxShadow = 'none';
      el.style.background = 'transparent';
      el.style.opacity = '0.01'; // iOS WebKit ignores opacity: 0
      el.style.zIndex = '99999';
      el.style.fontSize = '16px'; // Prevent iOS viewport zoom

      document.body.appendChild(el);

      // iOS Safari specific selection range
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        el.setSelectionRange(0, text.length);
      } else {
        el.focus();
        el.select();
      }

      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (cmdErr) {
        console.warn('execCommand copy threw:', cmdErr);
      }

      document.body.removeChild(el);

      if (success) {
        return true;
      }
    } catch (err) {
      console.warn('DOM copy fallback failed:', err);
    }
  }

  // 3. Fallback: Prompt user with selectable input if browser security blocks copy
  if (typeof window !== 'undefined') {
    try {
      window.prompt('Copy code to clipboard (Press Copy):', text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Downloads or saves an SVG element as a crisp PNG image.
 * On mobile devices (iOS / Android), uses Web Share File sharing (Save to Photos)
 * or opens the image view so users can long-press to save directly to camera roll.
 */
/**
 * Downloads or saves a QR code element (Canvas or SVG) as a crisp PNG image.
 * Works on Desktop (direct download), Android (direct download), and iOS.
 */
export async function downloadSvgAsPng(
  elementOrSelector: HTMLElement | SVGElement | string,
  filename: string = 'carecircle-invite-qr'
): Promise<boolean> {
  if (!elementOrSelector) return false;

  const targetEl = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;

  if (!targetEl) return false;

  let canvas: HTMLCanvasElement | null = null;

  // Case 1: Target is already a canvas
  if (targetEl instanceof HTMLCanvasElement) {
    canvas = targetEl;
  } else if (targetEl.querySelector('canvas')) {
    canvas = targetEl.querySelector('canvas');
  }

  // Case 2: Target is an SVG or contains an SVG
  if (!canvas) {
    const svg = (targetEl instanceof SVGElement ? targetEl : targetEl.querySelector('svg')) as SVGElement | null;
    if (svg) {
      try {
        const svgClone = svg.cloneNode(true) as SVGElement;
        // Fix XML namespace so new Image() parses correctly in browser
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        const loaded = await new Promise<boolean>((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = (e) => {
            console.warn('SVG img load failed:', e);
            resolve(false);
          };
          img.src = url;
        });

        if (loaded) {
          const scale = 3;
          const width = (svg.clientWidth || 200) * scale;
          const height = (svg.clientHeight || 200) * scale;
          const padding = 24 * scale;

          canvas = document.createElement('canvas');
          canvas.width = width + padding * 2;
          canvas.height = height + padding * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding, padding, width, height);
          }
        }
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('SVG to canvas conversion failed:', err);
      }
    }
  }

  if (!canvas) {
    console.error('No canvas or SVG found to download');
    return false;
  }

  try {
    // Convert to PNG Blob
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas!.toBlob((b) => resolve(b), 'image/png');
    });

    if (!pngBlob) return false;

    const isMobile = typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

    // 1. Try mobile Web Share Files (iOS "Save Image" to Photos / Android Share)
    if (isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([pngBlob], `${filename}.png`, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'CareCircle Invite QR',
            files: [file],
          });
          return true;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return false;
      }
    }

    // 2. Direct download via Blob ObjectURL (Works on Desktop Chrome, Safari, Firefox, Edge, Android)
    const blobUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}.png`;
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 2000);

    return true;
  } catch (err) {
    console.error('Download QR error:', err);
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
    text: isHttpUrl ? `${text}\n${url}` : text,
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
