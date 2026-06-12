import { importLocalAgentConfigToModelSettings, syncDeepSeekTuiGlobalConfigFromAgoraModel, syncOpenCodeGlobalConfigFromAgoraModel } from './libs/externalAgentConfigSync';
import {
  getEngineNotReadyResponse,
  isExternalAgentProviderAppType,
  mergeCoworkSystemPrompt,
} from './mainBootstrapIpcRuntimeHelperSupport';
import { createMainIpcRuntimeImBuilderDeps } from './mainBootstrapIpcRuntimeImSupport';
import { createMainIpcRuntimeServiceBuilderDeps } from './mainBootstrapIpcRuntimeServiceSupport';
import { createMainIpcRuntimeSessionBuilderDeps } from './mainBootstrapIpcRuntimeSessionSupport';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcRuntimeBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeBuilderDeps(
  deps: MainBootstrapWiringDeps,
): MainIpcRuntimeBuilderDeps {
  return {
    ...createMainIpcRuntimeSessionBuilderDeps(deps, {
      getEngineNotReadyResponse,
      mergeCoworkSystemPrompt,
      importLocalAgentConfigToModelSettings,
      isExternalAgentProviderAppType,
    }),
    ...createMainIpcRuntimeImBuilderDeps(deps),
    ...createMainIpcRuntimeServiceBuilderDeps(deps),
    syncOpenCodeGlobalConfigFromAgoraModel,
    syncDeepSeekTuiGlobalConfigFromAgoraModel,
  };
}
