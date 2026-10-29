import { getAccessToken, refreshAuthSession } from './authSession';
import { getProposalEvaluateWebhookUrl, getProposalReportWebhookUrl } from '../constants/chatConstants';
import { parseWebhookBody } from './chatPayload';
import type { N8nChatResponse } from './n8nChat';

export const PROPOSAL_MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
export const PROPOSAL_ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.csv,.txt';

export interface ProposalReason {
  claim: string;
  sourceFile: string;
  excerpt: string;
  page?: number;
}

export interface ProposalCriterionScore {
  criterion: string;
  weight: number;
  score: number;
  weightedScore: number;
  evidence: string[];
  gaps: string[];
}

export interface ProposalRanking {
  vendorName: string;
  rank: number;
  totalScore: number;
  rating: string;
  reasons: string[];
  gaps: string[];
  criteria: ProposalCriterionScore[];
}

export interface ProposalRecommendation {
  evaluationId: string;
  bestProposal: string | null;
  summary?: string;
  methodology?: string;
  ranking: ProposalRanking[];
  reasons: ProposalReason[];
  gaps: string[];
}

export interface ProposalUpload {
  file: File;
}

export interface ProposalEvaluationInput {
  ideaText: string;
  ideaFile: File | null;
  proposals: File[];
  sessionId: string;
  socketId: string | null;
  clientMessageId: string;
  serviceId: number;
  language: 'en' | 'ar';
  baseUrl?: string;
}

const allowedFile = (file: File) => /\.(pdf|docx|pptx|png|jpe?g|csv|txt)$/i.test(file.name);

function vendorLabel(file: File, index: number): string {
  return file.name.replace(/\.[^.]+$/, '') || `Proposal ${index + 1}`;
}

export function validateProposalInput(input: Pick<ProposalEvaluationInput, 'ideaText' | 'ideaFile' | 'proposals'>): string | null {
  if (Boolean(input.ideaText.trim()) === Boolean(input.ideaFile)) return 'IDEA_REQUIRED';
  if (input.proposals.length < 2) return 'PROPOSALS_REQUIRED';
  const files = [...(input.ideaFile ? [input.ideaFile] : []), ...input.proposals];
  if (files.some((file) => !allowedFile(file))) return 'FILE_TYPE_INVALID';
  if (files.reduce((size, file) => size + file.size, 0) > PROPOSAL_MAX_UPLOAD_BYTES) return 'UPLOAD_TOO_LARGE';
  return null;
}

async function request(url: string, body: BodyInit, json: boolean, timeoutMs = 300_000): Promise<Response> {
  await refreshAuthSession(false);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const perform = () => fetch(url, {
    method: 'POST',
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Token: getAccessToken(),
    },
    body,
    signal: controller.signal,
  });
  try {
    let response = await perform();
    if (response.status === 401 && await refreshAuthSession(true)) response = await perform();
    if (!response.ok) throw new Error(`PROPOSAL_HTTP_${response.status}`);
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function evaluateProposal(input: ProposalEvaluationInput): Promise<N8nChatResponse> {
  const validation = validateProposalInput(input);
  if (validation) throw new Error(validation);
  const form = new FormData();
  form.set('action', 'evaluate');
  form.set('sessionId', input.sessionId);
  form.set('socketId', input.socketId || '');
  form.set('clientMessageId', input.clientMessageId);
  form.set('serviceId', String(input.serviceId));
  form.set('language', input.language);
  form.set('ideaText', input.ideaText.trim());
  if (input.ideaFile) form.set('ideaFile', input.ideaFile, input.ideaFile.name);
  form.set('vendors', JSON.stringify(input.proposals.map((file, index) => ({
    vendorName: vendorLabel(file, index), fileKey: `proposal_${index}`,
  }))));
  input.proposals.forEach((file, index) => form.set(`proposal_${index}`, file, file.name));
  const response = await request(getProposalEvaluateWebhookUrl(input.baseUrl), form, false);
  return parseWebhookBody(await response.text());
}

export async function restoreProposalEvaluations(sessionId: string, baseUrl?: string): Promise<Array<{
  aiMessageId: string;
  responsePayload?: N8nChatResponse;
  recommendation: ProposalRecommendation;
}>> {
  const response = await request(getProposalEvaluateWebhookUrl(baseUrl), JSON.stringify({ action: 'restore', sessionId }), true, 30_000);
  const body = await response.json() as { evaluations?: Array<{ aiMessageId: string; responsePayload?: N8nChatResponse; recommendation: ProposalRecommendation }> };
  return Array.isArray(body.evaluations) ? body.evaluations : [];
}

export async function downloadProposalReport(evaluationId: string, language: 'en' | 'ar', baseUrl?: string): Promise<void> {
  const response = await request(getProposalReportWebhookUrl(baseUrl), JSON.stringify({ evaluationId, language, format: 'pdf' }), true);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
  const type = response.headers.get('content-type') || '';
  if (!blob.size || type.includes('application/json')) throw new Error('PROPOSAL_REPORT_INVALID');
  const fallback = type.includes('pdf') ? 'proposal-evaluation.pdf' : 'proposal-evaluation.html';
  const filename = match ? decodeURIComponent(match[1].replace(/\"/g, '')) : fallback;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
