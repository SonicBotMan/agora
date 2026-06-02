/**
 * CoworkRuntime interface definition for the core layer.
 * Re-exports the existing CoworkRuntime interface from the agent engine layer without redefinition.
 */

export type { CoworkRuntime } from '../main/libs/agentEngine/types';
export type { CoworkRuntimeEvents } from '../main/libs/agentEngine/types';
export type { CoworkStartOptions } from '../main/libs/agentEngine/types';
export type { CoworkContinueOptions } from '../main/libs/agentEngine/types';
export type { PermissionRequest } from '../main/libs/agentEngine/types';
export type { CoworkImageAttachment } from '../main/libs/agentEngine/types';
export type { CoworkRuntimeMetric } from '../main/libs/agentEngine/types';
