import type { App, BrowserWindow } from 'electron';

import type { TopicActionIMGateway } from '../features/hot-topics';
import { type SyncOpenClawConfigResult } from './coworkEngineRuntime';
import type { CoworkEngineRouter } from './libs/agentEngine';
import type { MainRuntimeRegistryServiceSupport } from './mainRuntimeRegistryServiceSupport';
import type { MainRuntimeRegistrySnapshotSupport } from './mainRuntimeRegistrySnapshotSupport';
import type { MainRuntimeRegistryStoreSupport } from './mainRuntimeRegistryStoreSupport';

export interface MainRuntimeRegistrySupportDeps {
  app: App;
  getWindows: () => BrowserWindow[];
  getCoworkEngineRouter: () => CoworkEngineRouter;
  getIMGatewayManager?: () => TopicActionIMGateway | null;
  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
}

export interface MainRuntimeRegistrySupport
  extends MainRuntimeRegistryStoreSupport,
    MainRuntimeRegistrySnapshotSupport,
    MainRuntimeRegistryServiceSupport {}
