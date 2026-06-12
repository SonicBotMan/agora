import { describe, expect, it } from 'vitest';

import { IMChatHandler } from '../main/im/imChatHandler';
import { IMCoworkHandler } from '../main/im/imCoworkHandler';
import {
  buildDingTalkSendParamsFromRoute,
  extractOpenClawDeliveryRoute,
} from '../main/im/imDeliveryRoute';
import { IMGatewayManager } from '../main/im/imGatewayManager';
import {
  analyzeIMReply,
  DEFAULT_IM_EMPTY_REPLY,
} from '../main/im/imReplyGuard';
import { IMStore } from '../main/im/imStore';
import { NativeFeishuGateway } from '../main/im/nativeFeishuGateway';
import {
  DEFAULT_FEISHU_OPENCLAW_CONFIG,
} from '../main/im/types';
import {
  analyzeIMReply as facadeAnalyzeIMReply,
  buildDingTalkSendParamsFromRoute as facadeBuildDingTalkSendParamsFromRoute,
  DEFAULT_FEISHU_OPENCLAW_CONFIG as facadeDefaultFeishuConfig,
  DEFAULT_IM_EMPTY_REPLY as facadeDefaultEmptyReply,
  extractOpenClawDeliveryRoute as facadeExtractOpenClawDeliveryRoute,
  ImChatHandler,
  ImCoworkHandler,
  ImGatewayManager as FacadeImGatewayManager,
  ImStore as FacadeImStore,
  NativeFeishuGateway as FacadeNativeFeishuGateway,
} from './index';

describe('im facade exports', () => {
  it('re-exports the documented IM entry points from the main implementation', () => {
    expect(ImChatHandler).toBe(IMChatHandler);
    expect(ImCoworkHandler).toBe(IMCoworkHandler);
    expect(FacadeImGatewayManager).toBe(IMGatewayManager);
    expect(FacadeImStore).toBe(IMStore);
    expect(FacadeNativeFeishuGateway).toBe(NativeFeishuGateway);
  });

  it('re-exports IM helper functions and feishu defaults without renaming behavior', () => {
    expect(facadeAnalyzeIMReply).toBe(analyzeIMReply);
    expect(facadeBuildDingTalkSendParamsFromRoute).toBe(
      buildDingTalkSendParamsFromRoute,
    );
    expect(facadeExtractOpenClawDeliveryRoute).toBe(extractOpenClawDeliveryRoute);
    expect(facadeDefaultEmptyReply).toBe(DEFAULT_IM_EMPTY_REPLY);
    expect(facadeDefaultFeishuConfig).toBe(DEFAULT_FEISHU_OPENCLAW_CONFIG);
  });
});
