import type { ChatAction } from './chatEnvelope';

/** File bytes and filename are supplied by n8n; the browser never builds MIME. */
export function emailDownloadFile(action: ChatAction, emailId: string) {
  const file = action.payload?.file;
  if (action.action !== 'email.download' || action.actionButtonType !== 'download'
      || !emailId || action.payload?.emailId !== emailId
      || !file || file.encoding !== 'base64' || file.mimetype !== 'message/rfc822'
      || typeof file.filename !== 'string' || !/\.eml$/i.test(file.filename)
      || /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(file.filename)
      || typeof file.base64 !== 'string' || !file.base64.length
      || file.base64.length > 16 * 1024 * 1024
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) {
    throw new Error('EMAIL_DOWNLOAD_INVALID');
  }
  return file as { filename: string; mimetype: string; encoding: string; base64: string };
}

export function downloadEmailDraft(action: ChatAction, emailId: string): void {
  const file = emailDownloadFile(action, emailId);
  const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimetype }));
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
