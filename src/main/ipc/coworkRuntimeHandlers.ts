import { ipcMain } from 'electron';

import { CoworkIpcChannel, RuntimeCallSource, RuntimeCallStatus } from '../../shared/cowork/constants';
import type { RuntimeMetricsFilters } from '../../shared/cowork/runtimeMetrics';
import type { SessionDeps } from './sessionDeps';

const normalizeRuntimeMetricsFilters = (input: unknown): RuntimeMetricsFilters => {
  const filters: RuntimeMetricsFilters = {};
  if (!input || typeof input !== 'object') return filters;

  const record = input as Record<string, unknown>;
  if (typeof record.providerKey === 'string' && record.providerKey.trim()) {
    filters.providerKey = record.providerKey.trim();
  }
  if (typeof record.status === 'string') {
    if ((Object.values(RuntimeCallStatus) as string[]).includes(record.status)) {
      filters.status = record.status as RuntimeCallStatus;
    }
  }
  if (typeof record.source === 'string') {
    if (Object.values(RuntimeCallSource).includes(record.source as RuntimeCallSource)) {
      filters.source = record.source as RuntimeCallSource;
    }
  }
  if (typeof record.sessionId === 'string' && record.sessionId.trim()) {
    filters.sessionId = record.sessionId.trim();
  }

  const limit = Number(record.limit);
  const offset = Number(record.offset);
  if (Number.isFinite(limit)) filters.limit = limit;
  if (Number.isFinite(offset)) filters.offset = offset;
  return filters;
};

export type CoworkRuntimeDeps = Pick<
  SessionDeps,
  | 'getCoworkEngineRouter'
  | 'getCoworkPermissionManager'
  | 'getRuntimeTelemetryStore'
  | 'getMergedExternalAgentEnvironmentSnapshot'
>;

export function registerCoworkRuntimeHandlers(deps: CoworkRuntimeDeps): void {
  const {
    getCoworkEngineRouter,
    getCoworkPermissionManager,
    getRuntimeTelemetryStore,
    getMergedExternalAgentEnvironmentSnapshot,
  } = deps;

  ipcMain.handle('cowork:permission:respond', async (_event, options: {
    requestId: string;
    result: import('@anthropic-ai/claude-agent-sdk').PermissionResult;
  }) => {
    try {
      getCoworkEngineRouter().respondToPermission(options.requestId, options.result);
      const behavior = (options.result as { behavior?: string } | null)?.behavior;
      if (behavior === 'allow') {
        getCoworkPermissionManager().approvePermission(
          options.requestId,
          options.result,
        );
      } else if (behavior === 'deny') {
        getCoworkPermissionManager().denyPermission(
          options.requestId,
          options.result,
        );
      } else {
        getCoworkPermissionManager().dismissPermission(options.requestId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to respond to permission',
      };
    }
  });

  ipcMain.handle('cowork:agentEngines:list', async () => {
    try {
      return {
        success: true,
        snapshot: getMergedExternalAgentEnvironmentSnapshot(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read agent engine status',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsSummary, async (_event, input: unknown) => {
    try {
      const filters = normalizeRuntimeMetricsFilters(input);
      return { success: true, summary: getRuntimeTelemetryStore().getSummary(filters) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime metrics summary',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsCalls, async (_event, input: unknown) => {
    try {
      const filters = normalizeRuntimeMetricsFilters(input);
      return { success: true, ...getRuntimeTelemetryStore().listCalls(filters) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime calls',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsDetail, async (_event, input: { callId?: unknown }) => {
    try {
      if (typeof input?.callId !== 'string' || !input.callId.trim()) {
        return { success: false, error: 'Invalid runtime call id.' };
      }
      return { success: true, ...getRuntimeTelemetryStore().getDetail(input.callId.trim()) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime call detail',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.StudioAssetsEnsure, async () => {
    const { ensureCoworkStudioAssets } = require('../libs/coworkStudioAssets');
    return ensureCoworkStudioAssets();
  });
}
