import { describe, expect, it } from 'vitest';

import {
  buildFrontendStationAgentPrompt,
  buildFrontendStationAgentSessionTitle,
} from './frontendStationAgentPrompt';

describe('frontendStationAgentPrompt', () => {
  it('builds an agent prompt with project, preview, and focused file context', () => {
    expect(buildFrontendStationAgentPrompt({
      projectName: 'marketing-site',
      projectPath: '/tmp/agora/marketing-site',
      previewUrl: 'http://127.0.0.1:5173',
      selectedFilePath: 'src/App.tsx',
      prompt: 'Create a pricing page',
    })).toBe([
      'Frontend Station Context',
      '- Project: marketing-site',
      '- Working directory: /tmp/agora/marketing-site',
      '- Preview URL: http://127.0.0.1:5173',
      '- Focused file: src/App.tsx',
      '',
      'Task:',
      'Create a pricing page',
    ].join('\n'));
  });

  it('omits optional context lines and trims the user task', () => {
    expect(buildFrontendStationAgentPrompt({
      projectName: 'landing-page',
      projectPath: '/tmp/agora/landing-page',
      prompt: '  Fix the header spacing  ',
    })).toBe([
      'Frontend Station Context',
      '- Project: landing-page',
      '- Working directory: /tmp/agora/landing-page',
      '',
      'Task:',
      'Fix the header spacing',
    ].join('\n'));
  });

  it('builds a stable session title from the project name and first prompt line', () => {
    expect(buildFrontendStationAgentSessionTitle(
      'design-system',
      'Implement a settings modal\nwith keyboard shortcuts',
    )).toBe('[Frontend] design-system: Implement a settings modal');
  });
});
