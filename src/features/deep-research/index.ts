/**
 * Deep Research feature — barrel exports.
 */

export { ReportGenerator } from './ReportGenerator';
export { ResearchEngine } from './ResearchEngine';
export type {
  ResearchDeliveryResult,
  ResearchSessionEvent,
  ResearchSessionEventType,
  ResearchSessionIMGateway,
  ResearchSessionOptions,
  ResearchSessionRecord,
} from './ResearchSession';
export { ResearchSession } from './ResearchSession';
export type { SearchResult,SearchSourceAdapter } from './sources/index';
export { ScholarSearchAdapter } from './sources/scholar';
export { SocialSearchAdapter } from './sources/social';
export { WebSearchAdapter } from './sources/web';
export type {
  ErrorEvent,
  Finding,
  ResearchEvent,
  ResearchQuery,
  ResearchResult,
  ResearchRound,
  ResearchSourceType,
  RoundCompleteEvent,
  SavedEvent,
  Source,
  SynthesisEvent,
} from './types';
