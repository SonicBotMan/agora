import type { IMGatewayManager } from './im';

export function createScheduledTaskIMGatewayManagerView(
  manager: IMGatewayManager,
) {
  const imStore = manager.getIMStore();
  return {
    getConfig: () =>
      manager.getConfig() as unknown as Record<string, unknown>,
    getIMStore: () => {
      if (!imStore) {
        return undefined;
      }
      return {
        getSessionMapping: (
          conversationId: string,
          platform: Parameters<typeof imStore.getSessionMapping>[1],
        ) => {
          const mapping = imStore.getSessionMapping(conversationId, platform);
          if (!mapping) {
            return undefined;
          }
          return {
            coworkSessionId: mapping.coworkSessionId,
          };
        },
        listSessionMappings: (
          platform: Parameters<typeof imStore.listSessionMappings>[0],
          agentId?: string,
        ) => {
          return imStore.listSessionMappings(platform, agentId).map(
            (mapping) => ({
              ...mapping,
              lastActiveAt: String(mapping.lastActiveAt),
            }),
          );
        },
      };
    },
    primeConversationReplyRoute: (
      platform: Parameters<typeof manager.primeConversationReplyRoute>[0],
      conversationId: string,
      coworkSessionId: string,
    ) =>
      manager.primeConversationReplyRoute(
        platform,
        conversationId,
        coworkSessionId,
      ),
  };
}
