/**
 * Frontend Development Station — barrel exports.
 */

export { DevServerManager } from './DevServerManager';
export type { DevServerManagerOptions, DevServerEvents } from './DevServerManager';

export { PreviewPanel } from './PreviewPanel';

export { CodeEditor } from './CodeEditor';

export { TerminalManager } from './TerminalManager';
export type { TerminalOutputCallback } from './TerminalManager';

export { TemplateManager } from './TemplateManager';

export { ComponentLibrary } from './ComponentLibrary';
export type { ComponentInfo, ComponentProp } from './ComponentLibrary';

export type {
  DevProject,
  ProjectTemplate,
  ProjectStatus,
  DevServerConfig,
  TemplateConfig,
  TerminalSession,
  EditorFile,
  PreviewState,
} from './types';
