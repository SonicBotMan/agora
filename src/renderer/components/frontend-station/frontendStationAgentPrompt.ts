export interface FrontendStationAgentPromptInput {
  projectName: string;
  projectPath: string;
  prompt: string;
  previewUrl?: string | null;
  selectedFilePath?: string | null;
}

export function buildFrontendStationAgentPrompt(
  input: FrontendStationAgentPromptInput,
): string {
  const sections = [
    'Frontend Station Context',
    `- Project: ${input.projectName}`,
    `- Working directory: ${input.projectPath}`,
  ];

  if (input.previewUrl) {
    sections.push(`- Preview URL: ${input.previewUrl}`);
  }

  if (input.selectedFilePath) {
    sections.push(`- Focused file: ${input.selectedFilePath}`);
  }

  sections.push('', 'Task:', input.prompt.trim());

  return sections.join('\n');
}

export function buildFrontendStationAgentSessionTitle(
  projectName: string,
  prompt: string,
): string {
  const firstLine = prompt
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 48);

  return firstLine
    ? `[Frontend] ${projectName}: ${firstLine}`
    : `[Frontend] ${projectName}`;
}
