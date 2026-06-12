import { BrowserWindow, ipcMain } from 'electron';

import type {
  SourceConfig,
  TopicMonitor,
  TopicMonitorEvent,
} from '../../features/hot-topics';

export interface HotTopicsDeps {
  getTopicMonitor: () => TopicMonitor;
}

export function registerHotTopicsHandlers(deps: HotTopicsDeps): void {
  let topicMonitor: TopicMonitor | null = null;
  let eventsBound = false;

  const getTopicMonitor = (): TopicMonitor => {
    if (!topicMonitor) {
      topicMonitor = deps.getTopicMonitor();
    }

    if (!eventsBound) {
      const forwardEvent = (event: TopicMonitorEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (window.isDestroyed()) continue;
          window.webContents.send('hotTopics:event', event);
        }
      };

      topicMonitor.on('new-topic', forwardEvent);
      topicMonitor.on('digest-ready', forwardEvent);
      topicMonitor.on('error', forwardEvent);
      eventsBound = true;
    }

    return topicMonitor;
  };

  ipcMain.handle('hotTopics:start', async (_event, sources: SourceConfig[]) => {
    try {
      const monitor = getTopicMonitor();
      monitor.start(sources);
      return {
        success: true,
        active: monitor.isActive(),
        sources: monitor.getSources(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to start hot topics monitor',
      };
    }
  });

  ipcMain.handle('hotTopics:stop', async () => {
    try {
      const monitor = getTopicMonitor();
      monitor.stop();
      return {
        success: true,
        active: monitor.isActive(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to stop hot topics monitor',
      };
    }
  });

  ipcMain.handle('hotTopics:getStatus', async () => {
    try {
      const monitor = getTopicMonitor();
      return {
        success: true,
        active: monitor.isActive(),
        sources: monitor.getSources(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get hot topics monitor status',
      };
    }
  });

  ipcMain.handle('hotTopics:list', async (_event, limit?: number) => {
    try {
      return {
        success: true,
        topics: getTopicMonitor().listTopics(limit),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list hot topics',
      };
    }
  });

  ipcMain.handle('hotTopics:get', async (_event, topicId: string) => {
    try {
      return {
        success: true,
        topic: getTopicMonitor().getTopic(topicId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get hot topic',
      };
    }
  });

  ipcMain.handle('hotTopics:getDigest', async () => {
    try {
      return {
        success: true,
        digest: await getTopicMonitor().getTodayDigest(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get hot topics digest',
      };
    }
  });

  ipcMain.handle('hotTopics:startResearch', async (_event, topicId: string) => {
    try {
      return {
        success: true,
        result: await getTopicMonitor().startResearch(topicId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to start topic research',
      };
    }
  });

  ipcMain.handle(
    'hotTopics:startWriting',
    async (_event, topicId: string, style?: string) => {
      try {
        return {
          success: true,
          result: await getTopicMonitor().startWriting(topicId, style),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to start topic writing',
        };
      }
    },
  );

  ipcMain.handle(
    'hotTopics:pushToIM',
    async (_event, topicId: string, channels: string[]) => {
      try {
        return {
          success: true,
          result: await getTopicMonitor().pushToIM(topicId, channels),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to push topic to IM',
        };
      }
    },
  );

  ipcMain.handle('hotTopics:saveToKnowledge', async (_event, topicId: string) => {
    try {
      return {
        success: true,
        result: await getTopicMonitor().saveToKnowledge(topicId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to save topic to knowledge base',
      };
    }
  });
}
