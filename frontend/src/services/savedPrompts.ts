import { authFetch } from './authSession';
import { backendActions, type ChatAction } from './chatEnvelope';

export interface PromptCursor { id: string; updatedAt: string }
export interface SavedPrompt {
  id: string; title: string; content: string; createdAt: string; updatedAt: string;
  actionButtons: { buttons: ChatAction[] };
}
export interface SavedPromptsReply {
  success: true;
  prompts?: SavedPrompt[];
  prompt?: SavedPrompt;
  deleted?: boolean;
  nextCursor?: PromptCursor | null;
  actionButtons: { buttons: ChatAction[] };
}
export class SavedPromptsError extends Error {
  constructor(readonly status: number) { super('SAVED_PROMPTS_UNAVAILABLE'); }
}
export async function requestSavedPrompts(baseUrl: string, request: {
  action: 'list' | 'save' | 'delete'; language: 'en' | 'ar';
  title?: string; content?: string; id?: string; cursor?: PromptCursor; search?: string;
}, signal?: AbortSignal): Promise<SavedPromptsReply> {
  const response = await authFetch(baseUrl.replace(/\/$/,'')+'/user/prompts', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(request).replace(/[<>&]/g,char=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026'}[char]!)),signal,
  });
  if (!response.ok) throw new SavedPromptsError(response.status);
  const value = await response.json();
  if (value?.success !== true) throw new SavedPromptsError(503);
  const normalize = (prompt: SavedPrompt): SavedPrompt => {
    if (!prompt || typeof prompt.id !== 'string' || typeof prompt.title !== 'string' || typeof prompt.content !== 'string') {
      throw new SavedPromptsError(503);
    }
    return {...prompt,actionButtons:{buttons:backendActions(prompt.actionButtons?.buttons)}};
  };
  return {...value,actionButtons:{buttons:backendActions(value.actionButtons?.buttons)},
    ...(value.prompts ? {prompts:value.prompts.map(normalize)} : {}),
    ...(value.prompt ? {prompt:normalize(value.prompt)} : {})};
}

/** Reuse is an edit, never a send. Preserve an existing unsent draft. */
export function insertSavedPrompt(draft: string, content: string): string {
  const combined = draft.trim() ? draft + (draft.endsWith('\n')?'':'\n') + content : content;
  if (combined.length > 12000) throw new Error('PROMPT_TOO_LONG');
  return combined;
}
