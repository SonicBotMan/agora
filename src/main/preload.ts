import { contextBridge, ipcRenderer } from 'electron';

import { createElectronPreloadApi } from './preloadSupport';

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld(
  'electron',
  createElectronPreloadApi(ipcRenderer, {
    platform: process.platform,
    arch: process.arch,
  }),
);
