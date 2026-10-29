import DOMPurify from 'dompurify';

export interface EmailDraft {
  id?: string;
  subject: string;
  body: string;
  emailText: string;
  from?: string;
}

/** n8n stores this same markup in history, so live and restored drafts render alike. */
export function emailDraftFromMessage(markup: string): EmailDraft | null {
  if (!markup.includes('data-mof-email')) return null;
  const document = new DOMParser().parseFromString(DOMPurify.sanitize(markup), 'text/html');
  const card = document.querySelector('section[data-mof-email="1"]');
  const subject = card?.getAttribute('data-subject')?.trim();
  const emailText = card?.querySelector('pre')?.textContent?.trim();
  if (!subject || !emailText) return null;
  const firstBreak = emailText.indexOf('\n');
  const firstLine = firstBreak < 0 ? emailText : emailText.slice(0, firstBreak);
  const hasSubject = /^(?:subject|الموضوع)\s*[:：]/i.test(firstLine)
    && firstLine.replace(/^(?:subject|الموضوع)\s*[:：]\s*/i, '').trim() === subject;
  if (!hasSubject || firstBreak < 0) return null;
  const body = emailText.slice(firstBreak).trim();
  return body ? { subject, body, emailText } : null;
}
