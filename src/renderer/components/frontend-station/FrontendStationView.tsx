import '@xterm/xterm/css/xterm.css';

import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import Editor, { loader } from '@monaco-editor/react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import type {
  DevProject,
  EditorFile,
  FrontendStationEvent,
  PreviewState,
  ProjectFileNode,
  ProjectTemplate,
  TemplateConfig,
  TerminalSession,
} from '../../../features/frontend-station';
import { coworkService } from '../../services/cowork';
import { frontendStationService } from '../../services/frontendStation';
import { i18nService } from '../../services/i18n';
import type { RootState } from '../../store';
import { joinPathSegments, sanitizePathSegment } from '../../utils/path';
import ComposeIcon from '../icons/ComposeIcon';
import FolderOpenIcon from '../icons/FolderOpenIcon';
import LinkIcon from '../icons/LinkIcon';
import PlusCircleIcon from '../icons/PlusCircleIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ThemedSelect from '../ui/ThemedSelect';
import WindowTitleBar from '../window/WindowTitleBar';
import {
  buildFrontendStationAgentPrompt,
  buildFrontendStationAgentSessionTitle,
} from './frontendStationAgentPrompt';

loader.config({ monaco });

interface FrontendStationViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  onShowCoworkSession?: (options?: {
    sessionId?: string | null;
    draft?: string;
    focusInput?: boolean;
    resetSession?: boolean;
  }) => void;
  updateBadge?: React.ReactNode;
}

type WorkspacePanel = 'preview' | 'terminal';

const showToast = (message: string): void => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getStatusLabel = (status: DevProject['status']): string => {
  switch (status) {
    case 'running':
      return i18nService.t('frontendStationStatusRunning');
    case 'starting':
      return i18nService.t('frontendStationStatusStarting');
    case 'error':
      return i18nService.t('frontendStationStatusError');
    default:
      return i18nService.t('frontendStationStatusStopped');
  }
};

const getCoworkStatusLabel = (
  status: 'idle' | 'running' | 'completed' | 'error' | null,
): string => {
  switch (status) {
    case 'running':
      return i18nService.t('coworkStatusRunning');
    case 'completed':
      return i18nService.t('coworkStatusCompleted');
    case 'error':
      return i18nService.t('coworkStatusError');
    case 'idle':
      return i18nService.t('coworkStatusIdle');
    default:
      return i18nService.t('frontendStationAgentNoSession');
  }
};

const getEventLabel = (event: FrontendStationEvent | null): string => {
  if (!event) {
    return '-';
  }

  switch (event.type) {
    case 'project-created':
      return `${i18nService.t('frontendStationCreateSuccess')} · ${event.project.name}`;
    case 'server-ready':
      return `${i18nService.t('frontendStationServerReady')} · ${event.url}`;
    case 'server-stopped':
      return i18nService.t('frontendStationServerStopped');
    case 'server-error':
      return `${i18nService.t('frontendStationServerError')} · ${event.error}`;
    case 'terminal-exit':
      return `${i18nService.t('frontendStationTerminalExited')} · ${event.exitCode ?? 0}`;
    default:
      return '-';
  }
};

const getEventProjectId = (event: FrontendStationEvent): string => {
  if (event.type === 'project-created') {
    return event.project.id;
  }

  return event.projectId;
};

const flattenFileNodes = (nodes: ProjectFileNode[]): ProjectFileNode[] => {
  const result: ProjectFileNode[] = [];

  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenFileNodes(node.children));
    }
  }

  return result;
};

const pickDefaultFile = (nodes: ProjectFileNode[]): ProjectFileNode | null => {
  const flattened = flattenFileNodes(nodes).filter((node) => node.type === 'file');
  const preferredNames = ['src/App.tsx', 'src/main.tsx', 'src/App.vue', 'package.json', 'README.md'];

  for (const preferredName of preferredNames) {
    const matched = flattened.find((node) => node.relativePath === preferredName);
    if (matched) {
      return matched;
    }
  }

  return flattened[0] ?? null;
};

const FrontendStationView: React.FC<FrontendStationViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  onShowCoworkSession,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const terminalFitAddonRef = useRef<FitAddon | null>(null);
  const terminalSessionRef = useRef<TerminalSession | null>(null);
  const linkedAgentSessionStatusRef = useRef<string | null>(null);
  const coworkSessions = useSelector((state: RootState) => state.cowork.sessions);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [projects, setProjects] = useState<DevProject[]>([]);
  const [previews, setPreviews] = useState<PreviewState[]>([]);
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>('blank');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<ProjectFileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<EditorFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [terminalSession, setTerminalSession] = useState<TerminalSession | null>(null);
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isSubmittingAgentPrompt, setIsSubmittingAgentPrompt] = useState(false);
  const [linkedAgentSessionIds, setLinkedAgentSessionIds] = useState<Record<string, string>>({});
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<WorkspacePanel>('preview');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [actionProjectId, setActionProjectId] = useState<string | null>(null);
  const [previewReloadToken, setPreviewReloadToken] = useState(0);
  const [lastEvent, setLastEvent] = useState<FrontendStationEvent | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedPreview = useMemo(
    () => previews.find((preview) => preview.projectId === selectedProjectId) ?? null,
    [previews, selectedProjectId],
  );
  const linkedAgentSessionId = useMemo(
    () => (selectedProjectId ? linkedAgentSessionIds[selectedProjectId] ?? null : null),
    [linkedAgentSessionIds, selectedProjectId],
  );
  const linkedAgentSession = useMemo(
    () => (
      linkedAgentSessionId
        ? coworkSessions.find((session) => session.id === linkedAgentSessionId) ?? null
        : null
    ),
    [coworkSessions, linkedAgentSessionId],
  );
  const templateOptions = useMemo(
    () => templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
    [templates],
  );
  const selectedFileDirty = Boolean(
    selectedFile && editorContent !== selectedFile.content,
  );
  const canContinueAgentSession = Boolean(
    linkedAgentSession && linkedAgentSession.status !== 'error',
  );

  const syncOpenFile = useCallback((file: EditorFile) => {
    setSelectedFile(file);
    setEditorContent(file.content);
  }, []);

  const loadProjects = useCallback(async () => {
    const nextProjects = await frontendStationService.getProjects();
    setProjects(nextProjects);
    setSelectedProjectId((current) => {
      if (current && nextProjects.some((project) => project.id === current)) {
        return current;
      }
      return nextProjects[0]?.id ?? null;
    });
  }, []);

  const loadPreviews = useCallback(async () => {
    setPreviews(await frontendStationService.getPreviews());
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setInlineError(null);

    try {
      const [nextTemplates] = await Promise.all([
        frontendStationService.listTemplates(),
        loadProjects(),
        loadPreviews(),
      ]);
      setTemplates(nextTemplates);
      if (nextTemplates.length > 0) {
        setSelectedTemplate((current) =>
          nextTemplates.some((template) => template.id === current)
            ? current
            : nextTemplates[0].id,
        );
      }
    } catch (error) {
      console.error('Failed to load frontend station data:', error);
      setInlineError(i18nService.t('frontendStationLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadPreviews, loadProjects]);

  const destroyTerminalSession = useCallback(async (sessionId: string | null | undefined) => {
    if (!sessionId) {
      return;
    }

    try {
      await frontendStationService.destroyTerminalSession(sessionId);
    } catch (error) {
      console.error('Failed to destroy frontend station terminal session:', error);
    }
  }, []);

  const resetWorkspaceState = useCallback(() => {
    setFileTree([]);
    setSelectedFile(null);
    setEditorContent('');
    setTerminalSession(null);
    setTerminalBuffer('');
    terminalSessionRef.current = null;
  }, []);

  const loadWorkspaceForProject = useCallback(async (project: DevProject | null) => {
    if (!project) {
      resetWorkspaceState();
      return;
    }

    try {
      setInlineError(null);
      const nextFileTree = await frontendStationService.getFileTree(project.id);
      setFileTree(nextFileTree);

      const defaultFile = pickDefaultFile(nextFileTree);
      if (defaultFile) {
        const openedFile = await frontendStationService.openFile(project.id, defaultFile.path);
        if (openedFile) {
          syncOpenFile(openedFile);
        } else {
          setSelectedFile(null);
          setEditorContent('');
        }
      } else {
        setSelectedFile(null);
        setEditorContent('');
      }

      const session = await frontendStationService.createTerminalSession(project.id);
      terminalSessionRef.current = session;
      setTerminalSession(session);
      if (session) {
        const buffer = await frontendStationService.getTerminalBuffer(session.sessionId);
        setTerminalBuffer(buffer);
        terminalInstanceRef.current?.clear();
        terminalInstanceRef.current?.write(buffer);
      } else {
        setTerminalBuffer('');
      }
    } catch (error) {
      console.error('Failed to load frontend station workspace:', error);
      showToast(i18nService.t('frontendStationWorkspaceLoadFailed'));
      setInlineError(i18nService.t('frontendStationWorkspaceLoadFailed'));
      resetWorkspaceState();
    }
  }, [resetWorkspaceState, syncOpenFile]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    terminalSessionRef.current = terminalSession;
  }, [terminalSession]);

  useEffect(() => {
    return () => {
      void destroyTerminalSession(terminalSessionRef.current?.sessionId);
    };
  }, [destroyTerminalSession]);

  useEffect(() => {
    let cancelled = false;
    const currentProject = selectedProject;
    const previousSessionId = terminalSessionRef.current?.sessionId ?? null;

    const run = async () => {
      await destroyTerminalSession(previousSessionId);

      if (cancelled) {
        return;
      }

      resetWorkspaceState();
      setLastEvent(null);

      if (!currentProject) {
        return;
      }

      try {
        await loadWorkspaceForProject(currentProject);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('Failed to switch frontend station project:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [destroyTerminalSession, loadWorkspaceForProject, resetWorkspaceState, selectedProjectId]);

  useEffect(() => {
    const dispose = frontendStationService.onEvent((event) => {
      const eventProjectId = getEventProjectId(event);
      const isSelectedProjectEvent = !selectedProjectId || eventProjectId === selectedProjectId;

      if (event.type !== 'terminal-output' && isSelectedProjectEvent) {
        setLastEvent(event);
      }

      if (event.type === 'server-error') {
        showToast(`${i18nService.t('frontendStationServerError')}: ${event.error}`);
      } else if (event.type === 'server-ready') {
        showToast(i18nService.t('frontendStationServerReady'));
      } else if (event.type === 'server-stopped') {
        showToast(i18nService.t('frontendStationServerStopped'));
      } else if (event.type === 'terminal-exit') {
        showToast(i18nService.t('frontendStationTerminalExited'));
        if (event.sessionId === terminalSession?.sessionId) {
          setTerminalSession((current) => (
            current && current.sessionId === event.sessionId
              ? {
                  ...current,
                  status: 'exited',
                  exitCode: event.exitCode,
                }
              : current
          ));
        }
      } else if (event.type === 'terminal-output') {
        if (event.sessionId === terminalSession?.sessionId) {
          setTerminalBuffer((current) => `${current}${event.data}`);
          terminalInstanceRef.current?.write(event.data);
        }
      }

      if (
        event.type === 'project-created'
        || event.type === 'server-ready'
        || event.type === 'server-stopped'
        || event.type === 'server-error'
      ) {
        void loadProjects();
        void loadPreviews();
      }
    });

    return dispose;
  }, [loadPreviews, loadProjects, selectedProjectId, terminalSession?.sessionId]);

  useEffect(() => {
    if (
      !terminalContainerRef.current
      || !terminalSession
      || activeWorkspacePanel !== 'terminal'
    ) {
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const terminal = new Terminal({
      convertEol: true,
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: isDark
        ? {
            background: '#0f172a',
            foreground: '#e2e8f0',
          }
        : {
            background: '#ffffff',
            foreground: '#0f172a',
          },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainerRef.current);
    terminalInstanceRef.current = terminal;
    terminalFitAddonRef.current = fitAddon;
    fitAddon.fit();
    terminal.write(terminalBuffer);

    const syncSize = () => {
      fitAddon.fit();
      void frontendStationService.resizeTerminal({
        sessionId: terminalSession.sessionId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    syncSize();

    const resizeObserver = new ResizeObserver(() => {
      syncSize();
    });

    resizeObserver.observe(terminalContainerRef.current);
    terminal.focus();

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalInstanceRef.current = null;
      terminalFitAddonRef.current = null;
    };
  }, [activeWorkspacePanel, terminalSession]);

  const handleBrowseWorkspace = useCallback(async () => {
    const result = await window.electron.dialog.selectDirectory();
    if (!result.success || !result.path) {
      return;
    }

    setWorkspaceDir(result.path);
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!workspaceDir.trim()) {
      showToast(i18nService.t('frontendStationChooseDirectoryFirst'));
      return;
    }

    if (!projectName.trim()) {
      showToast(i18nService.t('frontendStationEnterProjectName'));
      return;
    }

    const projectDirectoryName = sanitizePathSegment(projectName) || projectName.trim();
    const projectPath = joinPathSegments(workspaceDir, projectDirectoryName);

    setIsCreating(true);
    setInlineError(null);

    try {
      const project = await frontendStationService.createProject({
        name: projectName.trim(),
        template: selectedTemplate,
        path: projectPath,
      });

      if (!project) {
        showToast(i18nService.t('frontendStationCreateFailed'));
        return;
      }

      setProjectName('');
      await loadProjects();
      setSelectedProjectId(project.id);
      await loadPreviews();
      showToast(i18nService.t('frontendStationCreateSuccess'));
    } catch (error) {
      console.error('Failed to create frontend station project:', error);
      showToast(i18nService.t('frontendStationCreateFailed'));
    } finally {
      setIsCreating(false);
    }
  }, [loadPreviews, loadProjects, projectName, selectedTemplate, workspaceDir]);

  const handleStartServer = useCallback(async (projectId: string) => {
    setActionProjectId(projectId);

    try {
      const result = await frontendStationService.startServer(projectId);
      if (!result?.project) {
        showToast(i18nService.t('frontendStationStartFailed'));
        return;
      }

      await loadProjects();
      await loadPreviews();
    } catch (error) {
      console.error('Failed to start frontend station server:', error);
      showToast(i18nService.t('frontendStationStartFailed'));
    } finally {
      setActionProjectId(null);
    }
  }, [loadPreviews, loadProjects]);

  const handleStopServer = useCallback(async (projectId: string) => {
    setActionProjectId(projectId);

    try {
      const project = await frontendStationService.stopServer(projectId);
      if (!project) {
        showToast(i18nService.t('frontendStationStopFailed'));
        return;
      }

      await loadProjects();
      await loadPreviews();
    } catch (error) {
      console.error('Failed to stop frontend station server:', error);
      showToast(i18nService.t('frontendStationStopFailed'));
    } finally {
      setActionProjectId(null);
    }
  }, [loadPreviews, loadProjects]);

  const handleRestartServer = useCallback(async (projectId: string) => {
    setActionProjectId(projectId);

    try {
      const result = await frontendStationService.restartServer(projectId);
      if (!result?.project) {
        showToast(i18nService.t('frontendStationRestartFailed'));
        return;
      }

      await loadProjects();
      await loadPreviews();
    } catch (error) {
      console.error('Failed to restart frontend station server:', error);
      showToast(i18nService.t('frontendStationRestartFailed'));
    } finally {
      setActionProjectId(null);
    }
  }, [loadPreviews, loadProjects]);

  const handleRefresh = useCallback(async () => {
    await loadProjects();
    await loadPreviews();
    if (selectedProject) {
      try {
        const nextFileTree = await frontendStationService.getFileTree(selectedProject.id);
        setFileTree(nextFileTree);

        if (!selectedFile) {
          const defaultFile = pickDefaultFile(nextFileTree);
          if (defaultFile) {
            const openedFile = await frontendStationService.openFile(
              selectedProject.id,
              defaultFile.path,
            );
            if (openedFile) {
              syncOpenFile(openedFile);
            }
          }
        }

        if (terminalSession) {
          const buffer = await frontendStationService.getTerminalBuffer(terminalSession.sessionId);
          setTerminalBuffer(buffer);
          terminalInstanceRef.current?.clear();
          terminalInstanceRef.current?.write(buffer);
        }
      } catch (error) {
        console.error('Failed to refresh frontend station workspace:', error);
        showToast(i18nService.t('frontendStationWorkspaceLoadFailed'));
      }
    }
    setPreviewReloadToken((value) => value + 1);
  }, [
    loadPreviews,
    loadProjects,
    selectedFile,
    selectedProject,
    syncOpenFile,
    terminalSession,
  ]);

  const ensureProjectPreview = useCallback(async () => {
    if (
      !selectedProject
      || selectedProject.status === 'running'
      || selectedProject.status === 'starting'
    ) {
      return;
    }

    try {
      await frontendStationService.startServer(selectedProject.id);
      await loadProjects();
      await loadPreviews();
    } catch (error) {
      console.error('Failed to auto-start project preview before cowork task:', error);
      showToast(i18nService.t('frontendStationStartFailed'));
    }
  }, [loadPreviews, loadProjects, selectedProject]);

  const buildAgentPrompt = useCallback((prompt: string) => {
    if (!selectedProject) {
      return prompt.trim();
    }

    return buildFrontendStationAgentPrompt({
      projectName: selectedProject.name,
      projectPath: selectedProject.path,
      previewUrl: selectedPreview?.url ?? null,
      selectedFilePath: selectedFile?.relativePath ?? selectedFile?.path ?? null,
      prompt,
    });
  }, [selectedFile?.path, selectedFile?.relativePath, selectedPreview?.url, selectedProject]);

  const syncCoworkWorkspace = useCallback(async () => {
    if (!selectedProject) {
      return false;
    }

    const synced = await coworkService.updateConfig({
      workingDirectory: selectedProject.path,
    });

    if (!synced) {
      showToast(i18nService.t('frontendStationAgentWorkspaceSyncFailed'));
    }

    return synced;
  }, [selectedProject]);

  const handleSubmitAgentPrompt = useCallback(async () => {
    if (!selectedProject) {
      return;
    }

    const trimmedPrompt = agentPrompt.trim();
    if (!trimmedPrompt) {
      showToast(i18nService.t('frontendStationAgentNeedsPrompt'));
      return;
    }

    setIsSubmittingAgentPrompt(true);
    setInlineError(null);

    try {
      await ensureProjectPreview();
      await syncCoworkWorkspace();

      const contextualPrompt = buildAgentPrompt(trimmedPrompt);
      if (canContinueAgentSession && linkedAgentSessionId) {
        const continued = await coworkService.continueSession({
          sessionId: linkedAgentSessionId,
          prompt: contextualPrompt,
        });
        if (!continued) {
          showToast(i18nService.t('frontendStationAgentContinueFailed'));
          return;
        }

        setAgentPrompt('');
        showToast(i18nService.t('frontendStationAgentTaskContinued'));
        return;
      }

      const result = await coworkService.startSession({
        prompt: contextualPrompt,
        cwd: selectedProject.path,
        title: buildFrontendStationAgentSessionTitle(
          selectedProject.name,
          trimmedPrompt,
        ),
      });

      if (!result.session) {
        showToast(i18nService.t('frontendStationAgentRunFailed'));
        return;
      }

      setLinkedAgentSessionIds((current) => ({
        ...current,
        [selectedProject.id]: result.session!.id,
      }));
      setAgentPrompt('');
      showToast(i18nService.t('frontendStationAgentTaskStarted'));
    } catch (error) {
      console.error('Failed to launch frontend station cowork task:', error);
      showToast(i18nService.t('frontendStationAgentRunFailed'));
    } finally {
      setIsSubmittingAgentPrompt(false);
    }
  }, [
    agentPrompt,
    buildAgentPrompt,
    canContinueAgentSession,
    ensureProjectPreview,
    linkedAgentSessionId,
    selectedProject,
    syncCoworkWorkspace,
  ]);

  const handleOpenCoworkChat = useCallback(async () => {
    if (!selectedProject || !onShowCoworkSession) {
      return;
    }

    await syncCoworkWorkspace();

    if (linkedAgentSessionId) {
      onShowCoworkSession({
        sessionId: linkedAgentSessionId,
      });
      return;
    }

    onShowCoworkSession({
      draft: agentPrompt.trim() ? buildAgentPrompt(agentPrompt) : '',
      focusInput: true,
      resetSession: true,
    });
  }, [
    agentPrompt,
    buildAgentPrompt,
    linkedAgentSessionId,
    onShowCoworkSession,
    selectedProject,
    syncCoworkWorkspace,
  ]);

  useEffect(() => {
    const nextStatus = linkedAgentSession?.status ?? null;
    const previousStatus = linkedAgentSessionStatusRef.current;

    if (
      previousStatus === 'running'
      && (nextStatus === 'completed' || nextStatus === 'error')
    ) {
      void handleRefresh();
    }

    linkedAgentSessionStatusRef.current = nextStatus;
  }, [handleRefresh, linkedAgentSession?.status]);

  const handleOpenProjectFolder = useCallback(async () => {
    if (!selectedProject) {
      return;
    }

    await window.electron.shell.openPath(selectedProject.path);
  }, [selectedProject]);

  const handleOpenPreview = useCallback(async () => {
    if (!selectedPreview?.url) {
      showToast(i18nService.t('frontendStationPreviewUnavailable'));
      return;
    }

    await window.electron.shell.openExternal(selectedPreview.url);
  }, [selectedPreview]);

  const handleOpenFile = useCallback(async (node: ProjectFileNode) => {
    if (!selectedProject || node.type !== 'file') {
      return;
    }

    const file = await frontendStationService.openFile(selectedProject.id, node.path);
    if (!file) {
      showToast(i18nService.t('frontendStationOpenFileFailed'));
      return;
    }

    syncOpenFile(file);
  }, [selectedProject, syncOpenFile]);

  const handleSaveFile = useCallback(async () => {
    if (!selectedProject || !selectedFile) {
      return;
    }

    setIsSavingFile(true);

    try {
      const savedFile = await frontendStationService.saveFile({
        projectId: selectedProject.id,
        filePath: selectedFile.path,
        content: editorContent,
      });

      if (!savedFile) {
        showToast(i18nService.t('frontendStationSaveFileFailed'));
        return;
      }

      syncOpenFile(savedFile);
      showToast(i18nService.t('frontendStationSaveFileSuccess'));
    } catch (error) {
      console.error('Failed to save frontend station file:', error);
      showToast(i18nService.t('frontendStationSaveFileFailed'));
    } finally {
      setIsSavingFile(false);
    }
  }, [editorContent, selectedFile, selectedProject, syncOpenFile]);

  const handleSendTerminalInput = useCallback(async () => {
    if (!terminalSession || terminalSession.status !== 'running' || !terminalInput.trim()) {
      return;
    }

    const command = terminalInput;
    setTerminalInput('');
    await frontendStationService.writeTerminal(terminalSession.sessionId, `${command}\n`);
  }, [terminalInput, terminalSession]);

  const handleClearTerminal = useCallback(() => {
    setTerminalBuffer('');
    terminalInstanceRef.current?.clear();
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="draggable flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
        <div className="flex h-8 items-center space-x-3">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          <h1 className="text-lg font-semibold text-foreground">
            {i18nService.t('frontendStationTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-[340px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-border bg-surface/60 p-4 [scrollbar-gutter:stable]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('createProject')}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('frontendStationDescription')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('frontendStationWorkspace')}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={workspaceDir}
                    placeholder={i18nService.t('noFolderSelected')}
                    className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseWorkspace}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                  >
                    <FolderOpenIcon className="h-4 w-4" />
                    {i18nService.t('browse')}
                  </button>
                </div>
                <p className="mt-1 text-xs text-secondary">
                  {i18nService.t('frontendStationWorkspaceHint')}
                </p>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('projectNameLabel')}
                </div>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder={i18nService.t('frontendStationProjectNamePlaceholder')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>

              <ThemedSelect
                id="frontend-station-template"
                value={selectedTemplate}
                onChange={(value) => setSelectedTemplate(value as ProjectTemplate)}
                options={templateOptions}
                label={i18nService.t('frontendStationTemplateLabel')}
              />

              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={isCreating}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <PlusCircleIcon className="h-4 w-4" />
                {isCreating ? i18nService.t('saving') : i18nService.t('createProject')}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('frontendStationProjectListTitle')}
              </h2>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {i18nService.t('frontendStationRefresh')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('loading')}
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('frontendStationNoProjects')}
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected = project.id === selectedProjectId;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {project.name}
                          </div>
                          <div className="mt-1 truncate text-xs text-secondary">
                            {project.template}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                          project.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : project.status === 'starting'
                              ? 'bg-amber-500/10 text-amber-600'
                              : project.status === 'error'
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-surface-raised text-secondary'
                        }`}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                      <div className="mt-2 truncate text-xs text-secondary">
                        {project.path}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
            <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-4 px-5 py-4">
              {inlineError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {inlineError}
                </div>
              )}

              {!selectedProject ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 text-center text-sm text-secondary">
                  {i18nService.t('frontendStationSelectProject')}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-foreground">
                          {selectedProject.name}
                        </h2>
                        <div className="mt-1 text-sm text-secondary">
                          {selectedProject.template}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {selectedProject.status === 'running' ? (
                          <button
                            type="button"
                            onClick={() => void handleStopServer(selectedProject.id)}
                            disabled={actionProjectId === selectedProject.id}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                          >
                            <StopIcon className="h-4 w-4" />
                            {i18nService.t('stop')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleStartServer(selectedProject.id)}
                            disabled={actionProjectId === selectedProject.id}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                          >
                            <PlayIcon className="h-4 w-4" />
                            {selectedProject.status === 'starting'
                              ? i18nService.t('starting')
                              : i18nService.t('start')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRestartServer(selectedProject.id)}
                          disabled={actionProjectId === selectedProject.id}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          {i18nService.t('frontendStationRefresh')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenProjectFolder()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                        >
                          <FolderOpenIcon className="h-4 w-4" />
                          {i18nService.t('frontendStationOpenProjectFolder')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview()}
                          disabled={!selectedPreview?.url}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                        >
                          <LinkIcon className="h-4 w-4" />
                          {i18nService.t('frontendStationOpenPreview')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs font-medium text-secondary">
                          {i18nService.t('frontendStationCreatedAt')}
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {formatTimestamp(selectedProject.createdAt)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs font-medium text-secondary">
                          {i18nService.t('frontendStationPathLabel')}
                        </div>
                        <div className="mt-1 break-all text-sm text-foreground">
                          {selectedProject.path}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs font-medium text-secondary">
                          {i18nService.t('frontendStationLastEvent')}
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {getEventLabel(lastEvent)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ChatBubbleLeftRightIcon className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">
                            {i18nService.t('frontendStationAgentTitle')}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-secondary">
                          {i18nService.t('frontendStationAgentDescription')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleOpenCoworkChat()}
                        disabled={!onShowCoworkSession}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        {i18nService.t('frontendStationAgentOpenChat')}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-3">
                        <textarea
                          value={agentPrompt}
                          onChange={(event) => setAgentPrompt(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                              event.preventDefault();
                              void handleSubmitAgentPrompt();
                            }
                          }}
                          placeholder={i18nService.t('frontendStationAgentPromptPlaceholder')}
                          className="min-h-[112px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-secondary">
                            {selectedFile?.relativePath
                              ? `${i18nService.t('frontendStationAgentFocusedFileLabel')}: ${selectedFile.relativePath}`
                              : `${i18nService.t('frontendStationPathLabel')}: ${selectedProject.path}`}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSubmitAgentPrompt()}
                            disabled={isSubmittingAgentPrompt}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                          >
                            <PaperAirplaneIcon className="h-4 w-4" />
                            {isSubmittingAgentPrompt
                              ? i18nService.t('saving')
                              : canContinueAgentSession
                                ? i18nService.t('frontendStationAgentContinue')
                                : i18nService.t('frontendStationAgentRun')}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs font-medium text-secondary">
                          {i18nService.t('frontendStationAgentSessionLabel')}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">
                          {linkedAgentSession?.title ?? i18nService.t('frontendStationAgentNoSession')}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                          <span className="text-secondary">
                            {i18nService.t('frontendStationAgentStatusLabel')}
                          </span>
                          <span className={`rounded-full px-2 py-1 font-medium ${
                            linkedAgentSession?.status === 'running'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : linkedAgentSession?.status === 'completed'
                                ? 'bg-primary/10 text-primary'
                                : linkedAgentSession?.status === 'error'
                                  ? 'bg-red-500/10 text-red-600'
                                  : 'bg-surface-raised text-secondary'
                          }`}>
                            {getCoworkStatusLabel(linkedAgentSession?.status ?? null)}
                          </span>
                        </div>

                        {selectedPreview?.url && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-secondary">
                              {i18nService.t('frontendStationAgentPreviewUrlLabel')}
                            </div>
                            <div className="mt-1 break-all text-xs text-foreground">
                              {selectedPreview.url}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid flex-1 min-h-[640px] grid-cols-[260px_minmax(0,1fr)] gap-4">
                    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-surface overflow-hidden">
                      <div className="border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          {i18nService.t('frontendStationFilesTitle')}
                        </h3>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                        {fileTree.length === 0 ? (
                          <div className="px-2 py-3 text-sm text-secondary">
                            {i18nService.t('frontendStationFilesEmpty')}
                          </div>
                        ) : (
                          <FileTree
                            nodes={fileTree}
                            selectedFilePath={selectedFile?.path ?? null}
                            onOpenFile={handleOpenFile}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid min-h-0 gap-4 grid-rows-[minmax(0,1fr)_320px]">
                      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-surface overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {selectedFile?.relativePath ?? selectedFile?.path ?? i18nService.t('frontendStationEditorTitle')}
                            </h3>
                            <div className="mt-1 text-xs text-secondary">
                              {selectedFile?.language ?? i18nService.t('frontendStationEditorEmpty')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSaveFile()}
                            disabled={!selectedFile || !selectedFileDirty || isSavingFile}
                            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                          >
                            {isSavingFile
                              ? i18nService.t('saving')
                              : i18nService.t('frontendStationSaveFile')}
                          </button>
                        </div>

                        {selectedFile ? (
                          <div className="min-h-0 flex-1">
                            <Editor
                              path={selectedFile.path}
                              language={selectedFile.language}
                              value={editorContent}
                              onChange={(value) => setEditorContent(value ?? '')}
                              theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                automaticLayout: true,
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                tabSize: 2,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-secondary">
                            {i18nService.t('frontendStationEditorEmpty')}
                          </div>
                        )}
                      </div>

                      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-surface overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveWorkspacePanel('preview')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                activeWorkspacePanel === 'preview'
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                              }`}
                            >
                              {i18nService.t('frontendStationPreviewTitle')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveWorkspacePanel('terminal')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                activeWorkspacePanel === 'terminal'
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                              }`}
                            >
                              {i18nService.t('frontendStationTerminalTitle')}
                            </button>
                          </div>
                          {activeWorkspacePanel === 'preview' ? (
                            <button
                              type="button"
                              onClick={() => setPreviewReloadToken((value) => value + 1)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                            >
                              <ArrowPathIcon className="h-3.5 w-3.5" />
                              {i18nService.t('frontendStationRefresh')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleClearTerminal}
                              className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                            >
                              {i18nService.t('clear')}
                            </button>
                          )}
                        </div>

                        {activeWorkspacePanel === 'preview' ? (
                          selectedPreview?.url ? (
                            <iframe
                              key={`${selectedPreview.url}-${previewReloadToken}`}
                              src={selectedPreview.url}
                              title={`${selectedProject.name}-preview`}
                              className="h-full min-h-[260px] w-full bg-white"
                            />
                          ) : (
                            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-secondary">
                              {i18nService.t('frontendStationPreviewEmpty')}
                            </div>
                          )
                        ) : (
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div ref={terminalContainerRef} className="min-h-0 flex-1 bg-black" />
                            <div className="border-t border-border bg-background p-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={terminalInput}
                                  onChange={(event) => setTerminalInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      void handleSendTerminalInput();
                                    }
                                  }}
                                  placeholder={i18nService.t('frontendStationTerminalPlaceholder')}
                                  className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSendTerminalInput()}
                                  disabled={!terminalSession || terminalSession.status !== 'running'}
                                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                                >
                                  {i18nService.t('send')}
                                </button>
                              </div>
                              {terminalSession?.status === 'exited' && (
                                <div className="mt-2 text-xs text-secondary">
                                  {`${i18nService.t('frontendStationTerminalExited')} (${terminalSession.exitCode ?? 0})`}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FileTree: React.FC<{
  nodes: ProjectFileNode[];
  selectedFilePath: string | null;
  depth?: number;
  onOpenFile: (node: ProjectFileNode) => void;
}> = ({ nodes, selectedFilePath, depth = 0, onOpenFile }) => {
  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const isSelected = node.type === 'file' && node.path === selectedFilePath;
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => {
                if (node.type === 'file') {
                  onOpenFile(node);
                }
              }}
              className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                isSelected
                  ? 'bg-primary/10 text-primary'
                  : node.type === 'file'
                    ? 'text-secondary hover:bg-surface-raised hover:text-foreground'
                    : 'text-foreground'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <span className="truncate">
                {node.type === 'directory' ? `${node.name}/` : node.name}
              </span>
            </button>
            {node.children && node.children.length > 0 && (
              <FileTree
                nodes={node.children}
                selectedFilePath={selectedFilePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FrontendStationView;
