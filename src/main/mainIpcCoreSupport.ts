import type {
  AllHandlerDeps,
  AuthDeps,
  SessionDeps,
  ShellDeps,
  SkillDeps,
  StoreDeps,
} from './ipc';

type MainIpcDeferredAuthDeps = Omit<
  AuthDeps,
  | 'ensureDesktopAuthCallbackUrl'
  | 'getPendingAuthCode'
  | 'setPendingAuthCode'
  | 'sendAuthCallback'
>;

export type MainIpcCoreHandlerDeps = Omit<
  Pick<
    AllHandlerDeps,
    | 'getMainWindow'
    | 'getStore'
    | 'setStore'
    | 'deleteStoreKey'
    | 'onAppConfigChanged'
    | 'app'
    | 'shell'
    | 'permissions'
    | 'updates'
    | 'logs'
    | 'auth'
    | 'skills'
  >,
  'auth'
> & {
  auth: MainIpcDeferredAuthDeps;
};

export interface MainIpcCoreBuilderDeps {
  getMainWindow: AllHandlerDeps['getMainWindow'];
  getStore: SessionDeps['getStore'];
  onAppConfigChanged: NonNullable<StoreDeps['onAppConfigChanged']>;
  shellNormalizeShellPath: ShellDeps['normalizeShellPath'];
  getServerApiBaseUrl: AuthDeps['getServerApiBaseUrl'];
  clearServerModelMetadata: AuthDeps['clearServerModelMetadata'];
  updateServerModelMetadata: AuthDeps['updateServerModelMetadata'];
  t: AuthDeps['t'];
  getSkillManager: SkillDeps['getSkillManager'];
}

export function createMainIpcCoreHandlerDeps(
  deps: MainIpcCoreBuilderDeps,
  getStoreValue: AllHandlerDeps['getStore'],
): MainIpcCoreHandlerDeps {
  return {
    getMainWindow: deps.getMainWindow,
    getStore: getStoreValue,
    setStore: (key, value) => {
      deps.getStore().set(key, value as never);
    },
    deleteStoreKey: (key) => {
      deps.getStore().delete(key);
    },
    onAppConfigChanged: deps.onAppConfigChanged,
    app: { getStore: () => deps.getStore() },
    shell: { normalizeShellPath: deps.shellNormalizeShellPath },
    permissions: {},
    updates: { getStore: () => deps.getStore() },
    logs: {},
    auth: {
      getStore: () => deps.getStore(),
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
      clearServerModelMetadata: deps.clearServerModelMetadata,
      updateServerModelMetadata: deps.updateServerModelMetadata,
      t: deps.t,
    },
    skills: { getSkillManager: deps.getSkillManager },
  };
}
