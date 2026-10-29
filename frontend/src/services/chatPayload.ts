import type { N8nChatResponse } from './n8nChat';
import { decodeChatEnvelope } from './chatEnvelope';

export function parseWebhookBody(text: string): N8nChatResponse {
  const empty: N8nChatResponse = { output: '', intermediateSteps: [] };
  if (!text.trim()) return empty;

  try {
    let value: any = JSON.parse(text);
    for (let depth = 0; depth < 4; depth++) {
      if (Array.isArray(value)) value = value[0];
      else if (value && typeof value === 'object' && value.json !== undefined) value = value.json;
      else if (value && typeof value === 'object' && value.body !== undefined) value = value.body;
      else break;
    }
    if (typeof value === 'string') return { ...empty, output: value };
    return value && typeof value === 'object' ? { ...empty, ...decodeChatEnvelope(value) } : empty;
  } catch {
    // A gateway HTML page or malformed envelope is not an assistant reply.
    throw new Error('INVALID_CHAT_RESPONSE');
  }
}
