/**
 * Agora — Session / Cowork IPC Handlers
 *
 * Session IPC registration entrypoint.
 * Turn routing and lifecycle handlers live in domain files.
 */

import type { SessionDeps } from './sessionDeps';
import { bindSessionKnowledgeIngestion } from './sessionKnowledgeIngestionSupport';
import { registerSessionLifecycleHandlers } from './sessionLifecycleHandlers';
import { registerSessionTurnHandlers } from './sessionTurnHandlers';

export function registerSessionHandlers(deps: SessionDeps): void {
  bindSessionKnowledgeIngestion(deps);
  registerSessionTurnHandlers(deps);
  registerSessionLifecycleHandlers(deps);
}
