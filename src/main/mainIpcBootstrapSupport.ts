import { ipcMain } from 'electron';

type NetworkStatusIpcHost = Pick<
  typeof ipcMain,
  'removeAllListeners' | 'on'
>;

export function registerNetworkStatusChangeListener(
  onNetworkOnline: () => void,
  ipcHost: NetworkStatusIpcHost = ipcMain,
): void {
  ipcHost.removeAllListeners('network:status-change');
  ipcHost.on(
    'network:status-change',
    (_event, status: 'online' | 'offline') => {
      console.log(`[Main] Network status changed: ${status}`);

      if (status === 'online') {
        console.log('[Main] Network restored, reconnecting IM gateways...');
        onNetworkOnline();
      }
    },
  );
}
