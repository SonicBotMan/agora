import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';

export function resolveColdStartAuthCode(
  processArgs: string[],
): string | null {
  const coldStartDeepLink = processArgs.find((arg) => arg.startsWith('agora://'));
  if (!coldStartDeepLink) {
    return null;
  }

  try {
    const parsed = new URL(coldStartDeepLink);
    if (parsed.hostname === 'auth' && parsed.pathname === '/callback') {
      return parsed.searchParams.get('code');
    }
  } catch (error) {
    console.error('[Main] Failed to parse cold-start deep link:', error);
  }

  return null;
}

export function applyColdStartDeepLink(
  processArgs: string[],
  setPendingAuthCode: AppPostStartupLifecycleDeps['setPendingAuthCode'],
): void {
  const code = resolveColdStartAuthCode(processArgs);
  if (code) {
    setPendingAuthCode(code);
  }
}
