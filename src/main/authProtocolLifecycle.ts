import { randomBytes } from 'crypto';
import type { App, BrowserWindow } from 'electron';
import * as http from 'http';
import type { AddressInfo } from 'net';

export interface AuthProtocolLifecycleDeps {
  app: App;
  getMainWindow: () => BrowserWindow | null;
}

export interface AuthProtocolRuntime {
  ensureDesktopAuthCallbackUrl: () => Promise<string>;
  getPendingAuthCode: () => string | null;
  setPendingAuthCode: (code: string | null) => void;
  sendAuthCallback: (code: string) => void;
}

function registerOAuthProtocol(app: App): void {
  const scheme = 'agora';
  const appPath = app.getAppPath();
  const registered = process.defaultApp
    ? app.setAsDefaultProtocolClient(scheme, process.execPath, [appPath])
    : app.setAsDefaultProtocolClient(scheme);
  console.log(
    `[Auth] custom protocol ${registered ? 'registered' : 'registration failed'} for ${scheme}://`,
  );
}

export function registerAuthProtocolLifecycle(
  deps: AuthProtocolLifecycleDeps,
): AuthProtocolRuntime {
  const { app, getMainWindow } = deps;

  registerOAuthProtocol(app);

  let pendingAuthCode: string | null = null;
  let desktopAuthCallbackServer: http.Server | null = null;
  let desktopAuthCallbackUrl: string | null = null;

  const sendAuthCallback = (code: string): void => {
    pendingAuthCode = code;
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:callback', { code });
    }
  };

  const handleDeepLink = (url: string): void => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'auth' && parsed.pathname === '/callback') {
        const code = parsed.searchParams.get('code');
        if (code) {
          sendAuthCallback(code);
        }
      }
    } catch (error) {
      console.error('[Main] Failed to parse deep link:', error);
    }
  };

  const ensureDesktopAuthCallbackUrl = async (): Promise<string> => {
    if (desktopAuthCallbackUrl && desktopAuthCallbackServer?.listening) {
      return desktopAuthCallbackUrl;
    }

    const callbackToken = randomBytes(18).toString('base64url');
    desktopAuthCallbackServer = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        if (
          requestUrl.pathname !== '/auth/callback'
          || requestUrl.searchParams.get('token') !== callbackToken
        ) {
          response.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
          });
          response.end('Not found');
          return;
        }

        const code = requestUrl.searchParams.get('code');
        if (!code) {
          response.writeHead(400, {
            'Content-Type': 'text/plain; charset=utf-8',
          });
          response.end('Missing auth code');
          return;
        }

        sendAuthCallback(code);
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Agora 登录完成</title>
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#191917;background:#f6f3ea;">
    <h1>Agora 登录完成</h1>
    <p>可以回到 Agora 桌面端继续使用。</p>
    <script>window.close();</script>
  </body>
</html>`);
      } catch (error) {
        response.writeHead(500, {
          'Content-Type': 'text/plain; charset=utf-8',
        });
        response.end('OAuth callback failed');
        console.error('[Auth] local OAuth callback failed:', error);
      }
    });

    await new Promise<void>((resolve, reject) => {
      desktopAuthCallbackServer?.once('error', reject);
      desktopAuthCallbackServer?.listen(0, '127.0.0.1', resolve);
    });

    const address = desktopAuthCallbackServer.address() as AddressInfo;
    desktopAuthCallbackUrl =
      `http://127.0.0.1:${address.port}/auth/callback?token=${callbackToken}`;
    console.log('[Auth] local OAuth callback server started');
    return desktopAuthCallbackUrl;
  };

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    console.debug('[Main] second-instance event', {
      commandLine,
      workingDirectory,
    });

    const deepLink = commandLine.find((arg) => arg.startsWith('agora://'));
    if (deepLink) {
      handleDeepLink(deepLink);
    }

    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    if (!mainWindow.isFocused()) mainWindow.focus();
  });

  return {
    ensureDesktopAuthCallbackUrl,
    getPendingAuthCode: () => pendingAuthCode,
    setPendingAuthCode: (code) => {
      pendingAuthCode = code;
    },
    sendAuthCallback,
  };
}
