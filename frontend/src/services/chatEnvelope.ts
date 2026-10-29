export interface ChatCitation {
  id: string;
  label: string;
  sourceType: 'uploaded-document' | 'shared-document' | 'knowledge-base' | 'web';
  documentId: string | null;
  url: string | null;
  page: number | null;
  quote: string | null;
}

/** Public response: identical outer/session fields for every use case. */
export interface ChatResponse {
  output: string;
  sessionDetails: {
    messageId: string | null;
    sessionId: string;
    userMessageId: string | null;
    aiMessageId: string | null;
    weaveChatid: number | null;
    chatLock: boolean;
  };
  actionButtons: { buttons: ChatAction[] };
}

/** Backend-owned actions. An absent/empty list never enables a feature control. */
export interface ChatAction {
  id?: string;
  label: string;
  actionButtonType: string;
  action?: string;
  payload?: Record<string, any>;
  mimetype?: string;
  /** Pre-rollout responses only. */
  mimeType?: string;
  singleUpload?: boolean;
  file_id?: string;
}

const supportedActions = new Set([
  'chat.sendMessage', 'chat.uploadFiles', 'meeting.download', 'proposal.evaluate',
  'proposal.download', 'proposal.newEvaluation', 'translation.open', 'translation.download',
  'presentation.open', 'presentation.export', 'email.copy', 'email.download', 'message.copy',
  'chart.setType', 'chart.open', 'reference.open', 'translation.openTab', 'presentation.openTab',
  'prompt.save', 'prompt.use', 'prompt.delete', 'prompt.more',
  'presentation.downloadHtml', 'presentation.reload', 'presentation.edit', 'presentation.save', 'presentation.regenerateSlide', 'presentation.regenerateDeck',
]);

export function backendActions(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.map(button => {
    // A plain `copy` button is already an explicit backend instruction. It
    // copies this answer and needs no result identifier or extra payload.
    if (button && (button.action === 'message.copy' ||
        (!button.action && button.actionButtonType === 'copy'))) {
      return { ...button, action: 'message.copy', payload: button.payload ?? {} };
    }
    return button;
  }).filter((button): button is ChatAction => {
    if (!button || typeof button.label !== 'string' || !button.label.trim()) return false;
    if (button.action && !supportedActions.has(button.action)) return false;
    if (button.action && (!button.payload || typeof button.payload !== 'object' || Array.isArray(button.payload))) return false;
    const type = button.actionButtonType;
    if (button.action) {
      const expected = ['chat.sendMessage','prompt.use'].includes(button.action) ? 'prompt'
        : button.action === 'chat.uploadFiles' ? 'upload'
        : ['meeting.download','proposal.download','translation.download','presentation.export','email.download'].includes(button.action) ? 'download'
        : ['translation.open','translation.openTab','presentation.open','presentation.openTab','chart.open','prompt.more'].includes(button.action) ? 'view'
        : ['email.copy','message.copy'].includes(button.action) ? 'copy'
        : button.action === 'reference.open' ? 'reference'
        : button.action === 'chart.setType' ? 'chartType' : 'execute';
      if (type !== expected) return false;
    }
    if (button.action === 'reference.open') {
      const p = button.payload;
      if (type !== 'reference' || !/^[0-9a-f-]{36}$/i.test(String(p.documentId || ''))
          || !Number.isInteger(p.page) || p.page < 1
          || !new RegExp('^/(?:inquiry|chat)-document/' + p.documentId + '\\?').test(String(p.href || ''))) return false;
    }
    if (button.action === 'chart.setType' && (type !== 'chartType' || ![1,12,13].includes(button.payload.chartType))) return false;
    if (!button.action && !['prompt', 'upload', 'download'].includes(button.actionButtonType)) return false;
    if (button.id && seen.has(button.id)) return false;
    if (button.id) seen.add(button.id);
    return true;
  });
}

export const hasBackendAction = (actions: ChatAction[] | undefined, action: string): boolean =>
  !!actions?.some(button => button.action === action);

/** Map backend action data into local viewer state; never manufacture actions.
 * Extra fields below exist only in memory, not in the public response contract.
 * The old v1 envelope is accepted during the coordinated rollout.
 */
export function decodeChatEnvelope(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const buttons = backendActions(value.actionButtons?.buttons);
  if (value.schemaVersion === '1.0') {
    if (!['accepted', 'progress', 'message', 'error'].includes(value.eventType)
        || typeof value.output !== 'string' || !value.sessionDetails || !value.content
        || typeof value.sessionDetails.chatLock !== 'boolean') throw new Error('INVALID_CHAT_RESPONSE');
    const chart = value.content.chart;
    return { ...value, actionButtons: { buttons: value.eventType === 'message' ? buttons : [] },
      ...value.content, translation: value.eventType === 'message' ? value.content.translation : null,
      sessionDetails: { ...value.sessionDetails, ...(chart ? {chartDisplay:true, chartType:chart.chartType,
        altType:buttons.filter(b => b.action === 'chart.setType').map(b => Number(b.payload?.chartType)), chartData:chart.chartData} : {}) } };
  }
  // History responsePayload contains actions only; message/session metadata
  // lives on its enclosing row. Decode typed action data there as well.
  if (value.sessionDetails && (typeof value.output !== 'string' || typeof value.sessionDetails.chatLock !== 'boolean')) throw new Error('INVALID_CHAT_RESPONSE');
  const result = (action: string, slot: string, id: string, resultId: string) => {
    const p = buttons.find(b => b.action === action)?.payload;
    return p?.[slot] && p[id] === p[slot][resultId] ? p[slot] : null;
  };
  const locked = value.sessionDetails?.chatLock === true;
  const translation = result('translation.open', 'translation', 'jobId', 'jobId');
  const chart = result('chart.open', 'chart', 'chartId', 'id');
  const presentation = result('presentation.open', 'presentation', 'deckId', 'deckId');
  const emailDraft = result('email.copy', 'emailDraft', 'emailId', 'id') || result('email.download', 'emailDraft', 'emailId', 'id');
  const recommendation = result('proposal.download', 'recommendation', 'evaluationId', 'evaluationId');
  const citations = buttons.filter(b => b.action === 'reference.open').map(b => {
    const p = b.payload!;
    return p.citation?.documentId === p.documentId && p.citation?.page === p.page && p.citation?.url === p.href
      ? p.citation : {id:b.id, label:p.title || b.label, documentId:p.documentId, page:p.page, url:p.href};
  });
  return { ...value,
    eventType: locked ? translation?.status === 'accepted' ? 'accepted' : 'progress' : 'message',
    actionButtons: {buttons:locked ? [] : buttons},
    emailDraft: locked ? null : emailDraft || value.emailDraft,
    recommendation: locked ? null : recommendation || value.recommendation,
    presentation: locked ? null : presentation || value.presentation,
    presentationHtml: locked ? '' : buttons.find(b => b.action === 'presentation.open')?.payload?.presentationHtml || value.presentationHtml || '',
    translation: translation || value.translation,
    citations,
    ...(value.sessionDetails ? { sessionDetails: { ...value.sessionDetails, ...(chart && !locked ? {
      chartDisplay:true, chartType:chart.chartType,
      altType:buttons.filter(b => b.action === 'chart.setType' && b.payload?.chartId === chart.id).map(b => Number(b.payload?.chartType)),
      chartData:chart.chartData,
    } : {}) } } : {}),
  };
}
