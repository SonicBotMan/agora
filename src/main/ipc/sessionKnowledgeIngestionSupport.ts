import type { ConversationMessage } from '../../features/knowledge-base';
import type { CoworkMessage, CoworkStore } from '../coworkStore';
import type { CoworkEngineRouter } from '../libs/agentEngine';
import type { SessionDeps } from './sessionDeps';

export type SessionKnowledgeIngestionDeps = Pick<
  SessionDeps,
  | 'getCoworkEngineRouter'
  | 'getCoworkStore'
  | 'getConversationIngestor'
>;

function isConversationRole(
  message: CoworkMessage,
): message is CoworkMessage & {
  type: ConversationMessage['role'];
} {
  return (
    (message.type === 'user'
      || message.type === 'assistant'
      || message.type === 'system')
    && message.content.trim().length > 0
  );
}

function toConversationMessages(
  messages: CoworkMessage[],
): ConversationMessage[] {
  return messages
    .filter(isConversationRole)
    .map((message) => ({
      role: message.type,
      content: message.content,
      timestamp: Number.isFinite(message.timestamp)
        ? new Date(message.timestamp).toISOString()
        : new Date().toISOString(),
    }));
}

async function ingestCompletedSession(
  sessionId: string,
  store: CoworkStore,
  ingestor: ReturnType<SessionKnowledgeIngestionDeps['getConversationIngestor']>,
): Promise<void> {
  const session = store.getSession(sessionId);
  if (!session) {
    return;
  }

  const messages = toConversationMessages(session.messages);
  if (messages.length === 0) {
    return;
  }

  await ingestor.ingest(sessionId, messages);
}

export function bindSessionKnowledgeIngestion(
  deps: SessionKnowledgeIngestionDeps,
  runtime: Pick<CoworkEngineRouter, 'on'> = deps.getCoworkEngineRouter(),
): void {
  const pendingBySession = new Map<string, Promise<void>>();

  runtime.on('complete', (sessionId: string) => {
    const previous = pendingBySession.get(sessionId) ?? Promise.resolve();
    let next: Promise<void>;
    next = previous
      .catch((): void => undefined)
      .then(async (): Promise<void> => {
        await ingestCompletedSession(
          sessionId,
          deps.getCoworkStore(),
          deps.getConversationIngestor(),
        );
      })
      .catch((error: unknown): void => {
        console.error(
          `[Knowledge] Failed to ingest completed conversation for session ${sessionId}:`,
          error,
        );
      })
      .finally((): void => {
        if (pendingBySession.get(sessionId) === next) {
          pendingBySession.delete(sessionId);
        }
      });

    pendingBySession.set(sessionId, next);
  });
}

export { toConversationMessages };
