import type {
  OrchestratorEvent,
  TaskGraph,
  WorkflowTemplate,
} from '../../features/agent-orchestrator';

class OrchestratorService {
  async listTemplates(): Promise<WorkflowTemplate[]> {
    try {
      return await window.electron.orchestrator.listTemplates();
    } catch (error) {
      console.error('Failed to list orchestrator templates:', error);
      return [];
    }
  }

  async plan(goal: string, context?: string, templateId?: string): Promise<TaskGraph | null> {
    try {
      return await window.electron.orchestrator.plan(goal, context, templateId);
    } catch (error) {
      console.error('Failed to plan orchestrator graph:', error);
      return null;
    }
  }

  async execute(graphId: string): Promise<{
    graph: TaskGraph | null;
    summary: string;
  } | null> {
    try {
      return await window.electron.orchestrator.execute(graphId);
    } catch (error) {
      console.error('Failed to execute orchestrator graph:', error);
      return null;
    }
  }

  async cancel(graphId: string): Promise<boolean> {
    try {
      return await window.electron.orchestrator.cancel(graphId);
    } catch (error) {
      console.error('Failed to cancel orchestrator graph:', error);
      return false;
    }
  }

  async getStatus(graphId: string): Promise<TaskGraph | null> {
    try {
      return await window.electron.orchestrator.getStatus(graphId);
    } catch (error) {
      console.error('Failed to get orchestrator graph status:', error);
      return null;
    }
  }

  onEvent(callback: (event: OrchestratorEvent) => void): () => void {
    return window.electron.orchestrator.onEvent(callback);
  }
}

export const orchestratorService = new OrchestratorService();
