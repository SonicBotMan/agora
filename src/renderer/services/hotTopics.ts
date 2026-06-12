import type {
  SourceConfig,
  TopicActionResult,
  TopicDigest,
  TopicItem,
  TopicMonitorEvent,
} from '../../features/hot-topics';

class HotTopicsService {
  async start(sources: SourceConfig[]): Promise<{
    active: boolean;
    sources: SourceConfig[];
  }> {
    try {
      return await window.electron.hotTopics.start(sources);
    } catch (error) {
      console.error('Failed to start hot topics monitor:', error);
      return {
        active: false,
        sources: [],
      };
    }
  }

  async stop(): Promise<boolean> {
    try {
      await window.electron.hotTopics.stop();
      return true;
    } catch (error) {
      console.error('Failed to stop hot topics monitor:', error);
      return false;
    }
  }

  async getStatus(): Promise<{
    active: boolean;
    sources: SourceConfig[];
  }> {
    try {
      return await window.electron.hotTopics.getStatus();
    } catch (error) {
      console.error('Failed to get hot topics monitor status:', error);
      return {
        active: false,
        sources: [],
      };
    }
  }

  async list(limit?: number): Promise<TopicItem[]> {
    try {
      return await window.electron.hotTopics.list(limit);
    } catch (error) {
      console.error('Failed to list hot topics:', error);
      return [];
    }
  }

  async get(topicId: string): Promise<TopicItem | null> {
    try {
      return await window.electron.hotTopics.get(topicId);
    } catch (error) {
      console.error('Failed to get hot topic:', error);
      return null;
    }
  }

  async getDigest(): Promise<TopicDigest | null> {
    try {
      return await window.electron.hotTopics.getDigest();
    } catch (error) {
      console.error('Failed to get hot topics digest:', error);
      return null;
    }
  }

  async startResearch(topicId: string): Promise<TopicActionResult | null> {
    try {
      return await window.electron.hotTopics.startResearch(topicId);
    } catch (error) {
      console.error('Failed to start hot topic research:', error);
      return null;
    }
  }

  async startWriting(topicId: string, style?: string): Promise<TopicActionResult | null> {
    try {
      return await window.electron.hotTopics.startWriting(topicId, style);
    } catch (error) {
      console.error('Failed to start hot topic writing:', error);
      return null;
    }
  }

  async pushToIM(topicId: string, channels: string[]): Promise<TopicActionResult | null> {
    try {
      return await window.electron.hotTopics.pushToIM(topicId, channels);
    } catch (error) {
      console.error('Failed to push hot topic to IM:', error);
      return null;
    }
  }

  async saveToKnowledge(topicId: string): Promise<TopicActionResult | null> {
    try {
      return await window.electron.hotTopics.saveToKnowledge(topicId);
    } catch (error) {
      console.error('Failed to save hot topic to knowledge base:', error);
      return null;
    }
  }

  onEvent(callback: (event: TopicMonitorEvent) => void): () => void {
    return window.electron.hotTopics.onEvent(callback);
  }
}

export const hotTopicsService = new HotTopicsService();
