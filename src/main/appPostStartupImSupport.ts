import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';

export function startEnabledIMGateways(
  deps: Pick<
    AppPostStartupLifecycleDeps,
    | 'getIMGatewayManager'
    | 'resolveFeishuIMAgentEngine'
    | 'hermesEngineValue'
    | 'startHermesIMSessionSyncPolling'
    | 'syncHermesIMSessionsToCowork'
  >,
): void {
  deps.getIMGatewayManager()
    .startAllEnabled()
    .then(() => {
      if (deps.resolveFeishuIMAgentEngine() === deps.hermesEngineValue) {
        deps.startHermesIMSessionSyncPolling();
        void deps.syncHermesIMSessionsToCowork('startup');
      }
    })
    .catch((error) => {
      console.error('[IM] Failed to auto-start enabled gateways:', error);
    });
}
