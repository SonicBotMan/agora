import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getDefaultProviders,
  providerKeys,
  type ProvidersConfig,
  type ProviderType,
} from '../providerConfigUtils';
import { ModelTab,type ModelTabProps } from './ModelTab';

const createProviderMeta = () => Object.fromEntries(
  providerKeys.map((providerKey) => [
    providerKey,
    { label: providerKey, icon: null },
  ]),
) as ModelTabProps['providerMeta'];

const createBaseProps = (
  overrides: Partial<ModelTabProps> = {},
): ModelTabProps => ({
  visibleProviders: getDefaultProviders(),
  providers: getDefaultProviders(),
  providerMeta: createProviderMeta(),
  providerLinks: {},
  activeProvider: 'openai',
  showApiKey: false,
  setShowApiKey: () => undefined,
  setProviders: () => undefined,
  setError: () => undefined,
  setNoticeMessage: () => undefined,
  minimaxIsOAuthMode: true,
  minimaxOAuthPhase: { kind: 'idle' },
  copilotAuthStatus: 'idle',
  copilotUserCode: '',
  copilotVerificationUri: '',
  copilotGithubUser: '',
  copilotError: null,
  isBaseUrlLocked: false,
  onProviderChange: () => undefined,
  onAddCustomProvider: () => undefined,
  onDeleteCustomProvider: () => undefined,
  onToggleProviderEnabled: () => undefined,
  onProviderConfigChange: () => undefined,
  onSelectMiniMaxOAuth: () => undefined,
  onSelectMiniMaxApiKey: () => undefined,
  onMiniMaxSignIn: () => undefined,
  onCancelMiniMaxLogin: () => undefined,
  onMiniMaxSignOut: () => undefined,
  onCopilotSignIn: () => undefined,
  onCopilotCancelAuth: () => undefined,
  onCopilotSignOut: () => undefined,
  onAddModel: () => undefined,
  onEditModel: () => undefined,
  onDeleteModel: () => undefined,
  ...overrides,
});

describe('ModelTab', () => {
  it('renders custom provider display name and configured model list', () => {
    const providers = {
      ...getDefaultProviders(),
      custom_0: {
        enabled: true,
        apiKey: 'secret',
        baseUrl: 'https://models.acme.dev/v1',
        displayName: 'Acme Gateway',
        models: [
          { id: 'acme-chat', name: 'Acme Chat' },
        ],
      },
    } as ProvidersConfig;

    const markup = renderToStaticMarkup(createElement(ModelTab, createBaseProps({
      visibleProviders: providers,
      providers,
      activeProvider: 'custom_0' as ProviderType,
    })));

    expect(markup).toContain('Acme Gateway');
    expect(markup).toContain('acme-chat');
    expect(markup).toContain('https://models.acme.dev/v1');
  });

  it('renders coding-plan sections for supported providers', () => {
    const providers = {
      ...getDefaultProviders(),
      zhipu: {
        ...getDefaultProviders().zhipu,
        enabled: true,
        apiKey: 'secret',
        codingPlanEnabled: true,
      },
    } as ProvidersConfig;

    const markup = renderToStaticMarkup(createElement(ModelTab, createBaseProps({
      visibleProviders: providers,
      providers,
      activeProvider: 'zhipu',
      isBaseUrlLocked: true,
    })));

    expect(markup).toContain('GLM Coding Plan');
    expect(markup).toContain('peer-checked:bg-primary');
  });
});
