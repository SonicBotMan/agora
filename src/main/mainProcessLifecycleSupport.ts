import type { WebContents } from 'electron';

import type {
  MainProcessApp,
  MainProcessLifecycleDeps,
} from './mainProcessEnvironmentContract';

type MainProcessSignalHost = Pick<NodeJS.Process, 'on'>;

type RenderProcessGoneDetails = {
  reason:
    | 'crashed'
    | 'killed'
    | 'oom'
    | 'launch-failed'
    | 'integrity-failure'
    | string;
};

type ChildProcessGoneDetails = {
  type: string;
  reason: string;
};

export function shouldReloadForRenderProcessGone(
  reason: RenderProcessGoneDetails['reason'],
): boolean {
  return (
    reason === 'crashed'
    || reason === 'killed'
    || reason === 'oom'
    || reason === 'launch-failed'
    || reason === 'integrity-failure'
  );
}

export function shouldReloadForChildProcessGone(
  reloadOnChildProcessGone: boolean,
  details: ChildProcessGoneDetails,
): boolean {
  return (
    reloadOnChildProcessGone
    && (details.type === 'GPU' || details.type === 'Utility')
  );
}

export function registerMainProcessLifecycleHandlers(
  app: Pick<MainProcessApp, 'configureHostResolver' | 'isReady' | 'on'>,
  deps: MainProcessLifecycleDeps,
  options: {
    reloadOnChildProcessGone: boolean;
    processApi?: MainProcessSignalHost;
  },
): void {
  const processApi = options.processApi ?? process;
  const configureHostResolver = (): void => {
    app.configureHostResolver({
      enableBuiltInResolver: true,
      secureDnsMode: 'off',
    });
  };

  if (app.isReady()) {
    configureHostResolver();
  } else {
    app.on('ready', configureHostResolver);
  }

  app.on(
    'render-process-gone',
    (_event, webContents: WebContents, details: RenderProcessGoneDetails) => {
      console.error('Render process gone:', details);
      if (shouldReloadForRenderProcessGone(details.reason)) {
        deps.scheduleReload(
          `render-process-gone (${details.reason})`,
          webContents,
        );
      }
    },
  );

  app.on('child-process-gone', (_event, details: ChildProcessGoneDetails) => {
    console.error('Child process gone:', details);
    if (
      shouldReloadForChildProcessGone(
        options.reloadOnChildProcessGone,
        details,
      )
    ) {
      deps.scheduleReload(
        `child-process-gone (${details.type}/${details.reason})`,
      );
    }
  });

  processApi.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  processApi.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
  });

  processApi.on('exit', (code) => {
    console.log(`[Main] Process exiting with code: ${code}`);
  });
}
