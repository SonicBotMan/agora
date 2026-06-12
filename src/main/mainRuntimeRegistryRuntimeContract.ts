import type { BrowserWindow } from 'electron';

import type {
  MainRuntimeRegistryCoworkRuntimeSupport,
} from './mainRuntimeRegistryCoworkRuntimeSupport';
import type {
  MainRuntimeRegistryIMRuntimeSupport,
} from './mainRuntimeRegistryIMRuntimeSupport';
import type { MainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryRuntimeSupportDeps {
  getWindows: () => BrowserWindow[];
  support: MainRuntimeRegistrySupport;
}

export interface MainRuntimeRegistryRuntimeSupport
  extends MainRuntimeRegistryCoworkRuntimeSupport,
    MainRuntimeRegistryIMRuntimeSupport {}
