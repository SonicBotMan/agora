import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    id: 'ipc-renderer',
  },
}));

vi.mock('./preloadSupport', () => ({
  createElectronPreloadApi: vi.fn().mockReturnValue({ api: 'preload' }),
}));

describe('preload', () => {
  it('exposes the preload API through contextBridge', async () => {
    vi.resetModules();
    const { contextBridge, ipcRenderer } = await import('electron');
    const { createElectronPreloadApi } = await import('./preloadSupport');

    await import('./preload');

    expect(createElectronPreloadApi).toHaveBeenCalledWith(ipcRenderer, {
      platform: process.platform,
      arch: process.arch,
    });
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electron', {
      api: 'preload',
    });
  });
});
