import {
  CoworkAgentEngine as CoworkAgentEngineValue,
  isOpenClawCoworkAgentEngine,
} from '../shared/cowork/constants';
import {
  FeishuEngineKey,
  FeishuManagementMode,
  FeishuRuntimeOwnership,
  isFeishuEngineKey,
  isFeishuManagementMode,
} from '../shared/im/constants';
import type {
  FeishuIMAgentEngine,
  IMGatewayFeishuSupport,
  IMGatewayFeishuSupportDeps,
} from './imGatewayRuntimeContract';

export function createIMGatewayFeishuSupport(
  deps: IMGatewayFeishuSupportDeps,
): IMGatewayFeishuSupport {
  const resolveFeishuIMAgentEngine = (): FeishuIMAgentEngine | null => {
    const engine = deps.resolveCoworkAgentEngine();
    if (
      engine === CoworkAgentEngineValue.OpenClaw
      || engine === CoworkAgentEngineValue.Hermes
      || engine === CoworkAgentEngineValue.ClaudeCode
      || engine === CoworkAgentEngineValue.Codex
    ) {
      return engine;
    }
    return null;
  };

  const resolveFeishuEngineKey = () => {
    const engine = resolveFeishuIMAgentEngine();
    if (engine === CoworkAgentEngineValue.Hermes) return FeishuEngineKey.Hermes;
    if (engine === CoworkAgentEngineValue.ClaudeCode) {
      return FeishuEngineKey.ClaudeCode;
    }
    if (engine === CoworkAgentEngineValue.Codex) return FeishuEngineKey.Codex;
    return FeishuEngineKey.OpenClaw;
  };

  const normalizeFeishuEngineKey = (value: unknown) =>
    isFeishuEngineKey(value) ? value : resolveFeishuEngineKey();

  const getFeishuManagementMode = () => {
    try {
      const mode = deps.getIMGatewayManager().getIMStore().getFeishuManagementMode();
      return isFeishuManagementMode(mode)
        ? mode
        : FeishuManagementMode.LocalOpenClaw;
    } catch {
      return FeishuManagementMode.LocalOpenClaw;
    }
  };

  const getFeishuRuntimeOwnership = (engineKey: typeof FeishuEngineKey[keyof typeof FeishuEngineKey]) => {
    try {
      return deps.getIMGatewayManager().getIMStore().getFeishuRuntimeOwnership(
        engineKey,
      );
    } catch {
      if (engineKey === FeishuEngineKey.OpenClaw) {
        return FeishuRuntimeOwnership.LocalRuntime;
      }
      return FeishuRuntimeOwnership.AgoraManaged;
    }
  };

  const isFeishuEngineManagedByAgora = (
    engineKey: typeof FeishuEngineKey[keyof typeof FeishuEngineKey],
  ) => getFeishuRuntimeOwnership(engineKey) === FeishuRuntimeOwnership.AgoraManaged;

  const ensureCoworkReady = async (): Promise<void> => {
    const engine = deps.resolveCoworkAgentEngine();
    if (isOpenClawCoworkAgentEngine(engine)) {
      const status = await deps.ensureOpenClawRunningForCowork();
      if (status.phase !== 'running') {
        throw new Error(
          status.message || 'AI engine is initializing. Please try again in a moment.',
        );
      }
      return;
    }
    if (engine !== CoworkAgentEngineValue.Hermes) {
      return;
    }
    const status = await deps.ensureHermesRunningForCowork();
    if (status.phase !== 'running') {
      throw new Error(
        status.message || 'AI engine is initializing. Please try again in a moment.',
      );
    }
  };

  return {
    resolveFeishuIMAgentEngine,
    resolveFeishuEngineKey,
    normalizeFeishuEngineKey,
    getFeishuManagementMode,
    getFeishuRuntimeOwnership,
    isFeishuEngineManagedByAgora,
    ensureCoworkReady,
  };
}
