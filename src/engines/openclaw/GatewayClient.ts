/**
 * GatewayClient facade for OpenClaw.
 *
 * Exposes the gateway client construction utilities from the implementation
 * layer. The OpenClaw adapter handles gateway communication internally;
 * this file provides a stable import path for external consumers that need
 * to interact with the OpenClaw gateway directly (e.g., health checks,
 * status probes).
 */

export {
  probeOpenClawGateway,
  summarizeOpenClawConfig,
} from '../../main/libs/openclawSystemRuntime';
