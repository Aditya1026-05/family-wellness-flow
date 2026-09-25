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
      const scale = 3; // High-DPI 3x resolution for scanning
      const width = (svgElement.clientWidth || 200) * scale;
      const height = (svgElement.clientHeight || 200) * scale;
      const padding = 24 * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width + padding * 2;
      canvas.height = height + padding * 2;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Draw crisp white card background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding, width, height);

        DOMURL.revokeObjectURL(url);

        // Convert canvas to Blob
        const pngBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png');
        });

        const pngUrl = canvas.toDataURL('image/png');
        const isMobile = typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

        // 1. On Mobile with Web Share Files support (iOS / Android), open native Save to Photos
        if (pngBlob && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
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
            console.warn('Native file share failed, trying direct link/view:', err);
          }
        }

        // 2. On iOS Safari (where <a download> is blocked by WebKit policy):
        // Open clean popup/tab with the image so the user can tap and hold to Save to Photos
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
        if (isIOS) {
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Save QR Code</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                  <style>
                    body {
                      margin: 0; padding: 24px;
                      background: #0f172a; color: #f8fafc;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      display: flex; flex-direction: column; align-items: center; justify-content: center;
                      min-height: 85vh; text-align: center;
                    }
                    img {
                      max-width: 280px; width: 100%; height: auto;
                      border-radius: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.5);
                      margin-bottom: 24px;
                    }
                    h2 { margin: 0 0 8px 0; font-size: 18px; font-weight: 700; }
                    p { margin: 0; font-size: 14px; color: #94a3b8; }
                  </style>
                </head>
                <body>
                  <img src="${pngUrl}" alt="CareCircle QR Code" />
                  <h2>Tap and hold the QR code</h2>
                  <p>Select <strong>"Save to Photos"</strong> to keep it on your phone.</p>
                </body>
              </html>
            `);
            win.document.close();
            return true;
          }
        }

        // 3. Desktop / Android standard download
        const downloadLink = document.createElement('a');
        downloadLink.download = `${filename}.png`;
        downloadLink.href = pngUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          document.body.removeChild(downloadLink);
        }, 800);
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
