import type { BrowserWindow } from 'electron';
import { session, shell } from 'electron';

const WECOM_AUTH_HOSTNAMES = new Set([
  'work.weixin.qq.com',
  'open.work.weixin.qq.com',
  'wwcdn.weixin.qq.com',
]);

function isWecomAuthUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return WECOM_AUTH_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

export function configureContentSecurityPolicy(isDev: boolean): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Skip WeCom auth pages so their own CSP can load external scripts.
    if (isWecomAuthUrl(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const devPort = process.env.ELECTRON_START_URL?.match(/:(\d+)/)?.[1] || '5175';
    const cspDirectives = [
      "default-src 'self'",
      isDev
        ? `script-src 'self' 'unsafe-inline' http://localhost:${devPort} ws://localhost:${devPort}`
        : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: http: localfile:",
      'connect-src *',
      "font-src 'self' data:",
      "media-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'self'",
    ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': cspDirectives.join('; '),
      },
    });
  });
}

export function applyWecomAuthWindowPolicies(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isWecomAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 950,
          height: 640,
          title: '企业微信授权',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('did-create-window', (childWindow) => {
    childWindow.webContents.on('will-navigate', (event, navUrl) => {
      if (!isWecomAuthUrl(navUrl)) {
        event.preventDefault();
      }
    });
  });
}
