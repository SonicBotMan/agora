import { PlatformRegistry } from '../shared/platform';
import type { IMGatewayManagerOptions } from './im';
import type { IMGatewayScheduledTaskDeps } from './imGatewayRuntimeContract';
import {
  buildManagedSessionKey,
  DEFAULT_MANAGED_AGENT_ID,
} from './libs/openclawChannelSessionSync';

type ScheduledTaskMessage = Parameters<
  NonNullable<IMGatewayManagerOptions['createScheduledTask']>
>[0]['message'];

function buildScheduledTaskDeliveryTarget(
  message: ScheduledTaskMessage,
): {
  channelName: string | null;
  hasChannel: boolean;
  deliveryTo: string | undefined;
} {
  const channelName = PlatformRegistry.channelOf(message.platform);
  const hasChannel = Boolean(channelName && message.conversationId);
  let deliveryTo = message.conversationId;
  if (hasChannel && deliveryTo) {
    const colonIdx = deliveryTo.indexOf(':');
    if (colonIdx > 0) {
      deliveryTo = deliveryTo.slice(colonIdx + 1);
    }
  }
  return {
    channelName: channelName ?? null,
    hasChannel,
    deliveryTo,
  };
}

export function createIMGatewayScheduledTaskHandler(
  deps: IMGatewayScheduledTaskDeps,
): NonNullable<IMGatewayManagerOptions['createScheduledTask']> {
  return async (params) => {
    const { sessionId, message, request } = params;
    const { channelName, hasChannel, deliveryTo } =
      buildScheduledTaskDeliveryTarget(message);
    const task = await deps.getCronJobService().addJob({
      name: request.taskName,
      description: '',
      enabled: true,
      schedule: {
        kind: 'at',
        at: request.scheduleAt,
      },
      sessionTarget: hasChannel ? 'isolated' : 'main',
      wakeMode: 'now',
      payload: hasChannel
        ? { kind: 'agentTurn', message: request.payloadText }
        : { kind: 'systemEvent', text: request.payloadText },
      delivery: {
        mode: hasChannel ? 'announce' : 'none',
        ...(channelName ? { channel: channelName } : {}),
        ...(hasChannel
          ? { to: deliveryTo }
          : message.conversationId
            ? { to: message.conversationId }
            : {}),
      },
      agentId: DEFAULT_MANAGED_AGENT_ID,
      ...(hasChannel
        ? {}
        : {
            sessionKey: buildManagedSessionKey(
              sessionId,
              DEFAULT_MANAGED_AGENT_ID,
            ),
          }),
    });
    return {
      id: task.id,
      name: task.name,
      agentId: task.agentId,
      sessionKey: task.sessionKey,
      payloadText:
        task.payload.kind === 'systemEvent'
          ? task.payload.text
          : task.payload.kind === 'agentTurn'
            ? task.payload.message
            : '',
      scheduleAt:
        task.schedule.kind === 'at' ? task.schedule.at : request.scheduleAt,
    };
  };
}
