import type {
  HermesEngineSupport,
  HermesEngineSupportDeps,
} from './coworkEngineHermesSupport';
import type {
  OpenClawEngineSupport,
  OpenClawEngineSupportDeps,
} from './coworkEngineOpenClawSupport';

export type { SyncOpenClawConfigResult } from './coworkEngineOpenClawSupport';

export interface CoworkEngineRuntimeDeps
  extends OpenClawEngineSupportDeps,
    HermesEngineSupportDeps {}

export interface CoworkEngineRuntime
  extends OpenClawEngineSupport,
    HermesEngineSupport {}
