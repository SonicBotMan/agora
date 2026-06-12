/**
 * Type definitions for the Deep Research engine.
 */

export type ResearchSourceType = 'web' | 'scholar' | 'social';

export interface ResearchQuery {
  query: string;
  sources: ResearchSourceType[];
  maxRounds: number;
  crossValidate?: boolean;
}

export interface Source {
  url: string;
  title: string;
  type: ResearchSourceType;
  retrievedAt: string;
}

export interface Finding {
  source: Source;
  title: string;
  snippet: string;
  url: string;
  relevanceScore: number;
}

export interface ResearchRound {
  round: number;
  searchQueries: string[];
  findings: Finding[];
  newQuestions: string[];
}

export interface ResearchResult {
  query: string;
  rounds: ResearchRound[];
  findings: Finding[];
  synthesis: string;
  sources: Source[];
  confidence: number; // 0-1
  savedToKnowledgeBase: boolean;
}

export interface RoundCompleteEvent {
  type: 'round-complete';
  round: number;
  findings: Finding[];
  newQuestions: string[];
}

export interface SynthesisEvent {
  type: 'synthesis';
  synthesis: string;
}

export interface SavedEvent {
  type: 'saved';
  result: ResearchResult;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export type ResearchEvent =
  | RoundCompleteEvent
  | SynthesisEvent
  | SavedEvent
  | ErrorEvent;
