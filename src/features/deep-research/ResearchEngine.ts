/**
 * Core deep research engine.
 * Manages iterative research rounds, cross-validation, and synthesis via async generator.
 */

import { EventEmitter } from 'events';

import type {
  ResearchQuery,
  ResearchResult,
  ResearchRound,
  Finding,
  Source,
  ResearchEvent,
  ResearchSourceType,
} from './types';
import type { SearchSourceAdapter } from './sources/index';
import { WebSearchAdapter } from './sources/web';
import { ScholarSearchAdapter } from './sources/scholar';
import { SocialSearchAdapter } from './sources/social';

export class ResearchEngine extends EventEmitter {
  private adapters: Map<ResearchSourceType, SearchSourceAdapter>;

  constructor() {
    super();
    this.adapters = new Map();
    this.adapters.set('web', new WebSearchAdapter());
    this.adapters.set('scholar', new ScholarSearchAdapter());
    this.adapters.set('social', new SocialSearchAdapter());
  }

  /**
   * Run a full deep research cycle, yielding events as progress is made.
   */
  async *research(query: ResearchQuery): AsyncGenerator<ResearchEvent> {
    const rounds: ResearchRound[] = [];
    const allSources: Map<string, Source> = new Map();
    const allFindings: Finding[] = [];

    for (let i = 0; i < query.maxRounds; i++) {
      const roundResult = await this.searchRound(query, i + 1, rounds);

      // Deduplicate sources
      for (const finding of roundResult.findings) {
        if (!allSources.has(finding.source.url)) {
          allSources.set(finding.source.url, finding.source);
        }
      }
      allFindings.push(...roundResult.findings);
      rounds.push(roundResult);

      // Emit round-complete event
      yield {
        type: 'round-complete',
        round: roundResult.round,
        findings: roundResult.findings,
        newQuestions: roundResult.newQuestions,
      };

      // No more questions to pursue
      if (roundResult.newQuestions.length === 0) {
        break;
      }
    }

    // Optional cross-validation
    let confidence = 0.7;
    if (query.crossValidate && allFindings.length > 0) {
      confidence = await this.crossValidate(allFindings);
    }

    // Synthesize final result
    const synthesis = await this.synthesize(query.query, rounds);

    yield {
      type: 'synthesis',
      synthesis,
    };

    const result: ResearchResult = {
      query: query.query,
      rounds,
      synthesis,
      sources: Array.from(allSources.values()),
      confidence,
      savedToKnowledgeBase: false,
    };

    yield {
      type: 'saved',
      result,
    };
  }

  /**
   * Execute a single search round: run queries across selected sources.
   */
  private async searchRound(
    query: ResearchQuery,
    roundNum: number,
    previousRounds: ResearchRound[],
  ): Promise<ResearchRound> {
    // Generate search queries for this round
    const searchQueries = this.generateSearchQueries(query.query, roundNum, previousRounds);

    // Run searches in parallel across all requested sources
    const results = await Promise.all(
      query.sources.map(async (sourceType) => {
        const adapter = this.adapters.get(sourceType);
        if (!adapter) {
          return { findings: [], sourceMetadata: [] };
        }
        return adapter.search(query.query);
      }),
    );

    // Flatten findings
    const findings: Finding[] = results.flatMap((r) => r.findings);

    // Generate follow-up questions based on findings (simplified)
    const newQuestions = this.generateFollowUpQuestions(findings);

    return {
      round: roundNum,
      searchQueries,
      findings,
      newQuestions,
    };
  }

  /**
   * Cross-validate findings by checking for corroborating evidence across sources.
   * Returns a confidence score between 0 and 1.
   */
  private async crossValidate(findings: Finding[]): Promise<number> {
    if (findings.length === 0) {
      return 0;
    }

    // Simplified: confidence based on number of findings and source diversity
    const sourceTypes = new Set(findings.map((f) => f.source.type));
    const diversityFactor = Math.min(sourceTypes.size / 3, 1);
    const volumeFactor = Math.min(findings.length / 20, 1);

    return Math.round((diversityFactor * 0.6 + volumeFactor * 0.4) * 100) / 100;
  }

  /**
   * Synthesize findings across all rounds into a coherent summary.
   */
  private async synthesize(_query: string, _rounds: ResearchRound[]): Promise<string> {
    // TODO: Implement actual LLM-based synthesis
    const totalFindings = _rounds.reduce((sum, r) => sum + r.findings.length, 0);
    return `Synthesis of "${_query}": gathered ${totalFindings} finding(s) across ${_rounds.length} round(s).`;
  }

  private generateSearchQueries(
    baseQuery: string,
    roundNum: number,
    previousRounds: ResearchRound[],
  ): string[] {
    if (roundNum === 1) {
      return [baseQuery];
    }

    // Use new questions from the previous round as follow-up queries
    const lastRound = previousRounds[previousRounds.length - 1];
    if (lastRound && lastRound.newQuestions.length > 0) {
      return lastRound.newQuestions.slice(0, 3);
    }

    return [baseQuery];
  }

  private generateFollowUpQuestions(_findings: Finding[]): string[] {
    // TODO: Implement LLM-based question generation
    if (_findings.length === 0) {
      return [];
    }
    // Stub: return empty to stop rounds by default
    return [];
  }
}
