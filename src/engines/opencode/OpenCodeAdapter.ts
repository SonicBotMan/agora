import { ExternalCliRuntimeAdapter } from '../../main/libs/agentEngine/externalCliRuntimeAdapter';

/**
 * Top-level architecture facade for the default OpenCode engine.
 *
 * The real implementation lives under `src/main/libs/agentEngine`, but the
 * architecture rewrite keeps this documented path stable for imports.
 */
export class OpenCodeAdapter extends ExternalCliRuntimeAdapter {}
