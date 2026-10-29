import { ignoreResizeObserverLoopError } from './utils/ignoreResizeObserverError';
import { WeaveAiChat } from './components/WeaveAiChat';

ignoreResizeObserverLoopError();
export type { Message, WeaveAiChatProps } from './components/WeaveAiChat';
export default WeaveAiChat; 