/**
 * Deep Research feature — barrel exports.
 */

export { ResearchEngine } from './ResearchEngine';
export { ResearchSession } from './ResearchSession';
export type { ResearchSessionRecord } from './ResearchSession';

export { ReportGenerator } from './ReportGenerator';

export type {
  ResearchQuery,
  ResearchResult,
  ResearchRound,
  Finding,
  Source,
  ResearchEvent,
  RoundCompleteEvent,
  SynthesisEvent,
  SavedEvent,
  ErrorEvent,
  ResearchSourceType,
} from './types';

export type { SearchSourceAdapter, SearchResult } from './sources/index';
export { WebSearchAdapter } from './sources/web';
export { ScholarSearchAdapter } from './sources/scholar';
export { SocialSearchAdapter } from './sources/social';
