import {
  registerImCoreHandlers,
} from '../main/ipc/imCoreHandlers';
import type { ImDeps } from '../main/ipc/imDeps';
import {
  registerImFeishuInstanceHandlers,
} from '../main/ipc/imFeishuInstanceHandlers';
import {
  registerImFeishuManagementHandlers,
} from '../main/ipc/imFeishuManagementHandlers';
import {
  registerImInstanceHandlers,
} from '../main/ipc/imInstanceHandlers';
import {
  registerImPairingHandlers,
} from '../main/ipc/imPairingHandlers';

/**
 * Top-level architecture facade for IM IPC wiring.
 *
 * The runtime implementation is split across several focused modules under
 * `src/main/ipc`. This facade keeps the documented `src/ipc/imHandlers.ts`
 * entry stable while composing those concrete registrars.
 */
export function registerImHandlers(deps: ImDeps): void {
  registerImCoreHandlers(deps);
  registerImFeishuManagementHandlers(deps);
  registerImFeishuInstanceHandlers(deps);
  registerImPairingHandlers(deps);
  registerImInstanceHandlers(deps);
}

export type { ImDeps };
