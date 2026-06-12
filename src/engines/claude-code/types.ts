/**
 * Claude Code engine specific types.
 *
 * Re-exports Claude Code runner event types and SDK module types from the
 * implementation layer so consumers can import from the stable engines
 * directory.
 */

export type {
  ClaudeSdkModule,
} from '../../main/libs/claudeSdk';
export type {
  CoworkRunnerEvents,
} from '../../main/libs/coworkRunner';
