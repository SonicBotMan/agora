import type {
  ResearchDeliveryResult,
  ResearchQuery,
  ResearchResult,
  ResearchSessionEvent,
  ResearchSessionRecord,
} from '../../features/deep-research';

class ResearchService {
  async start(query: ResearchQuery): Promise<ResearchSessionRecord | null> {
    try {
      return await window.electron.research.start(query);
    } catch (error) {
      console.error('Failed to start research session:', error);
      return null;
    }
  }

  async cancel(sessionId: string): Promise<boolean> {
    try {
      return await window.electron.research.cancel(sessionId);
    } catch (error) {
      console.error('Failed to cancel research session:', error);
      return false;
    }
  }

  async getStatus(sessionId: string): Promise<ResearchSessionRecord | null> {
    try {
      return await window.electron.research.getStatus(sessionId);
    } catch (error) {
      console.error('Failed to get research session status:', error);
      return null;
    }
  }

  async getResult(sessionId: string): Promise<ResearchResult | null> {
    try {
      return await window.electron.research.getResult(sessionId);
    } catch (error) {
      console.error('Failed to get research result:', error);
      return null;
    }
  }

  async list(): Promise<ResearchSessionRecord[]> {
    try {
      return await window.electron.research.list();
    } catch (error) {
      console.error('Failed to list research sessions:', error);
      return [];
    }
  }

  async getReport(sessionId: string): Promise<string | null> {
    try {
      return await window.electron.research.getReport(sessionId);
    } catch (error) {
      console.error('Failed to get research report:', error);
      return null;
    }
  }

  async pushToIM(
    sessionId: string,
    channels: string[],
  ): Promise<ResearchDeliveryResult | null> {
    try {
      return await window.electron.research.pushToIM(sessionId, channels);
    } catch (error) {
      console.error('Failed to deliver research report to IM:', error);
      return null;
    }
  }

  onEvent(callback: (event: ResearchSessionEvent) => void): () => void {
    return window.electron.research.onEvent(callback);
  }
}

export const researchService = new ResearchService();
