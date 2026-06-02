/**
 * Agora — Deep Research Module Types
 * 
 * Multi-round search with cross-validation and structured report generation.
 */

export type ResearchSource = 'web' | 'scholar' | 'social';

export interface ResearchQuery {
  query: string;
  sources: ResearchSource[];
  maxRounds: number;
  crossValidate: boolean;
}

export interface Finding {
  source: string;
  url: string;
  title: string;
  snippet: string;
  relevance: number;  // 0-1
}

export interface ResearchRound {
  round: number;
  searchQueries: string[];
  findings: Finding[];
  newQuestions: string[];
}

export interface Source {
  url: string;
  title: string;
  type: ResearchSource;
  accessedAt: string;
  reliability: number;  // 0-1
}

export interface ResearchResult {
  id: string;
  query: string;
  rounds: ResearchRound[];
  synthesis: string;
  sources: Source[];
  confidence: number;  // 0-1
  savedToKnowledgeBase: boolean;
  createdAt: string;
}

export type ResearchEvent =
  | { type: 'search-start'; round: number; queries: string[] }
  | { type: 'search-result'; round: number; findings: Finding[] }
  | { type: 'round-complete'; round: number; newQuestions: string[] }
  | { type: 'synthesis-start' }
  | { type: 'synthesis-complete'; result: ResearchResult }
  | { type: 'saved-to-knowledge-base'; docId: string };

export interface ResearchSession {
  id: string;
  query: ResearchQuery;
  status: 'searching' | 'synthesizing' | 'completed' | 'failed' | 'cancelled';
  result?: ResearchResult;
  createdAt: string;
  updatedAt: string;
}
