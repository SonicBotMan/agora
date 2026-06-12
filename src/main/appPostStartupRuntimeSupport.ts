import { powerMonitor } from 'electron';

import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';

type ResumeLifecycleHost = {
  on: (event: 'resume', handler: () => void) => void;
};

export function registerResumeLifecycle(
  getOpenClawRuntimeAdapter: AppPostStartupLifecycleDeps['getOpenClawRuntimeAdapter'],
  lifecycleHost: ResumeLifecycleHost = powerMonitor,
): void {
  lifecycleHost.on('resume', () => {
    getOpenClawRuntimeAdapter()?.onSystemResume();
  });
}
