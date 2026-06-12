/**
 * OpenClaw engine specific types.
 *
 * Re-exports OpenClaw-specific status and configuration types from the
 * implementation layer so consumers can import from the stable engines
 * directory without reaching into src/main/libs.
 */

export type {
  OpenClawEnginePhase,
  OpenClawEngineStatus,
  OpenClawGatewayConnectionInfo,
  OpenClawGatewayMode,
} from '../../main/libs/openclawEngineManager';
export type {
  OpenClawGatewayProbeSummary,
} from '../../main/libs/openclawSystemRuntime';

/** Connection info exposed to the adapter layer for gateway communication. */
export interface OpenClawGatewayConfig {
  gatewayUrl: string;
  gatewayPort: number;
  scopes: string[];
}
