import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateMultiSignalSimilarity,
  fetchCandidateThreats,
} from '../../../functions/utils/similarity';
import type { Env } from '../../../functions/types';
import {
  MOCK_THREAT_RANSOMWARE_1,
  MOCK_THREAT_RANSOMWARE_2,
  MOCK_THREAT_APT,
  MOCK_THREAT_ZERO_DAY,
  MOCK_THREAT_SAME_SOURCE,
  MOCK_THREAT_NO_IOCS,
  MOCK_SEMANTIC_SCORES,
  SIMILARITY_WEIGHTS,
} from '../../fixtures/similarity';

describe('Similarity Utils', () => {
  describe('calculateMultiSignalSimilarity()', () => {
    it('should calculate high similarity for related ransomware threats', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toHaveLength(1);
      expect(scores[0].threatId).toBe('threat-ransomware-2');
      expect(scores[0].overallScore).toBeGreaterThan(0.65); // High similarity expected
    });

    it('should calculate low similarity for unrelated threats', () => {
      const candidates = [MOCK_THREAT_APT];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toHaveLength(1);
      expect(scores[0].overallScore).toBeLessThan(0.3); // Low similarity expected
    });

    it('should skip self when calculating similarity', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_1, MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toHaveLength(1); // Only RANSOMWARE_2, not self
      expect(scores[0].threatId).toBe('threat-ransomware-2');
    });

    it('should sort results by overall score descending', () => {
      const candidates = [
        MOCK_THREAT_ZERO_DAY,
        MOCK_THREAT_RANSOMWARE_2,
        MOCK_THREAT_APT,
      ];

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toHaveLength(3);
      // Should be sorted highest to lowest
      expect(scores[0].overallScore).toBeGreaterThanOrEqual(scores[1].overallScore);
      expect(scores[1].overallScore).toBeGreaterThanOrEqual(scores[2].overallScore);
    });

    it('should include breakdown of all 5 signals', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].breakdown).toHaveProperty('semantic');
      expect(scores[0].breakdown).toHaveProperty('content');
      expect(scores[0].breakdown).toHaveProperty('ioc');
      expect(scores[0].breakdown).toHaveProperty('temporal');
      expect(scores[0].breakdown).toHaveProperty('source');
    });

    it('should include threat metadata', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].metadata.title).toBe(MOCK_THREAT_RANSOMWARE_2.title);
      expect(scores[0].metadata.category).toBe(MOCK_THREAT_RANSOMWARE_2.category);
      expect(scores[0].metadata.severity).toBe(MOCK_THREAT_RANSOMWARE_2.severity);
      expect(scores[0].metadata.published_at).toBe(MOCK_THREAT_RANSOMWARE_2.published_at);
    });

    it('should use semantic scores from provided map', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].breakdown.semantic).toBe(0.92); // From MOCK_SEMANTIC_SCORES
    });

    it('should use 0 for missing semantic scores', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const emptyScores = new Map<string, number>();

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        emptyScores
      );

      expect(scores[0].breakdown.semantic).toBe(0);
    });

    it('should calculate correct weights (sum to 1.0)', () => {
      // Test that weights are correct
      const sum =
        SIMILARITY_WEIGHTS.SEMANTIC +
        SIMILARITY_WEIGHTS.CONTENT +
        SIMILARITY_WEIGHTS.IOC +
        SIMILARITY_WEIGHTS.TEMPORAL +
        SIMILARITY_WEIGHTS.SOURCE;

      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should calculate IOC similarity for shared indicators', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      // RANSOMWARE_2 shares IPs, domains, and CVEs with RANSOMWARE_1
      expect(scores[0].breakdown.ioc).toBeGreaterThan(0);
    });

    it('should give 0 IOC score when no IOCs overlap', () => {
      const candidates = [MOCK_THREAT_NO_IOCS];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].breakdown.ioc).toBe(0);
    });

    it('should calculate temporal proximity correctly', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2]; // 1 day later
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      // 1 day = within a week = 0.8 temporal score
      expect(scores[0].breakdown.temporal).toBe(0.8);
    });

    it('should penalize same source', () => {
      const candidates = [MOCK_THREAT_SAME_SOURCE];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      // Same source = 0.0 source diversity
      expect(scores[0].breakdown.source).toBe(0.0);
    });

    it('should reward different source', () => {
      const candidates = [MOCK_THREAT_RANSOMWARE_2];
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      // Different source = 1.0 source diversity
      expect(scores[0].breakdown.source).toBe(1.0);
    });

    it('should handle empty candidates list', () => {
      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        [],
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toEqual([]);
    });

    it('should handle multiple candidates correctly', () => {
      const candidates = [
        MOCK_THREAT_RANSOMWARE_2,
        MOCK_THREAT_APT,
        MOCK_THREAT_ZERO_DAY,
        MOCK_THREAT_NO_IOCS,
      ];

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        candidates,
        MOCK_SEMANTIC_SCORES
      );

      expect(scores).toHaveLength(4);
      // Verify all have required fields
      scores.forEach(score => {
        expect(score.threatId).toBeTruthy();
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(score.overallScore).toBeLessThanOrEqual(1);
        expect(score.breakdown).toBeTruthy();
        expect(score.metadata).toBeTruthy();
      });
    });
  });

  describe('Signal Calculations', () => {
    describe('Content Similarity', () => {
      it('should detect high content overlap', () => {
        // RANSOMWARE_1 and RANSOMWARE_2 share many words
        const candidates = [MOCK_THREAT_RANSOMWARE_2];
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          candidates,
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.content).toBeGreaterThanOrEqual(0.25);
      });

      it('should detect low content overlap for different topics', () => {
        const candidates = [MOCK_THREAT_ZERO_DAY];
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          candidates,
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.content).toBeLessThan(0.2);
      });
    });

    describe('IOC Similarity', () => {
      it('should weight CVEs highest', () => {
        // RANSOMWARE_2 shares same CVE
        const candidates = [MOCK_THREAT_RANSOMWARE_2];
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          candidates,
          MOCK_SEMANTIC_SCORES
        );

        // CVE weight is 0.40 in the algorithm, so high CVE overlap should contribute significantly
        expect(scores[0].breakdown.ioc).toBeGreaterThan(0.3);
      });

      it('should handle threats with no IOCs', () => {
        const candidates = [MOCK_THREAT_NO_IOCS];
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          candidates,
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.ioc).toBe(0);
      });
    });

    describe('Temporal Proximity', () => {
      it('should give max score for same day', () => {
        const sameDayThreat = {
          ...MOCK_THREAT_RANSOMWARE_2,
          published_at: MOCK_THREAT_RANSOMWARE_1.published_at,
        };

        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [sameDayThreat],
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.temporal).toBe(1.0);
      });

      it('should give 0.8 for within a week', () => {
        const weekThreat = {
          ...MOCK_THREAT_RANSOMWARE_2,
          published_at: MOCK_THREAT_RANSOMWARE_1.published_at + 86400 * 3, // 3 days
        };

        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [weekThreat],
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.temporal).toBe(0.8);
      });

      it('should give 0.5 for within a month', () => {
        const monthThreat = {
          ...MOCK_THREAT_RANSOMWARE_2,
          published_at: MOCK_THREAT_RANSOMWARE_1.published_at + 86400 * 15, // 15 days
        };

        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [monthThreat],
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.temporal).toBe(0.5);
      });

      it('should give 0.2 for within 3 months', () => {
        const threeMonthThreat = {
          ...MOCK_THREAT_RANSOMWARE_2,
          published_at: MOCK_THREAT_RANSOMWARE_1.published_at + 86400 * 60, // 60 days
        };

        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [threeMonthThreat],
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.temporal).toBe(0.2);
      });

      it('should give 0.0 for older than 3 months', () => {
        // ZERO_DAY is 100 days later
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [MOCK_THREAT_ZERO_DAY],
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.temporal).toBe(0.0);
      });
    });

    describe('Source Diversity', () => {
      it('should reward different sources', () => {
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [MOCK_THREAT_RANSOMWARE_2], // Different source
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.source).toBe(1.0);
      });

      it('should penalize same source', () => {
        const scores = calculateMultiSignalSimilarity(
          MOCK_THREAT_RANSOMWARE_1,
          [MOCK_THREAT_SAME_SOURCE], // Same source
          MOCK_SEMANTIC_SCORES
        );

        expect(scores[0].breakdown.source).toBe(0.0);
      });
    });
  });

  describe('fetchCandidateThreats()', () => {
    function createMockEnv(dbResults: any[] = []): Env {
      return {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: dbResults,
                success: true,
              }),
            }),
          }),
        } as any,
        AI: {} as any,
        VECTORIZE_INDEX: {} as any,
        CACHE: {} as any,
        ANALYTICS: {} as any,
        THREAT_ARCHIVE: {} as any,
        ASSETS: {} as any,
        AI_GATEWAY_ID: 'test-gateway-id',
      } as any;
    }

    it('should fetch candidates in same category', async () => {
      const mockThreats = [
        {
          id: 'threat-2',
          title: 'Test Threat',
          content: 'Content',
          source: 'Source A',
          published_at: BASE_TIMESTAMP + 86400,
          tldr: 'TLDR',
          category: 'ransomware',
          severity: 'high',
        },
      ];

      const env = createMockEnv(mockThreats);

      const candidates = await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('threat-2');
      expect(candidates[0].category).toBe('ransomware');
    });

    it('should return empty array when no results', async () => {
      const env = createMockEnv([]);

      const candidates = await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1);

      expect(candidates).toEqual([]);
    });

    it('should query with correct parameters', async () => {
      const env = createMockEnv([]);

      await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1, 25);

      expect(env.DB.prepare).toHaveBeenCalled();

      // Verify bind was called with correct parameters
      const prepareResult = (env.DB.prepare as any).mock.results[0].value;
      expect(prepareResult.bind).toHaveBeenCalledWith(
        'ransomware', // category
        expect.any(Number), // threeMonthsAgo
        'threat-ransomware-1', // id to exclude
        25 // limit
      );
    });

    it('should default to limit of 50', async () => {
      const env = createMockEnv([]);

      await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1);

      const prepareResult = (env.DB.prepare as any).mock.results[0].value;
      const bindCall = (prepareResult.bind as any).mock.calls[0];
      expect(bindCall[3]).toBe(50); // Default limit
    });

    it('should initialize empty IOCs when no IOC data', async () => {
      const mockThreats = [
        {
          id: 'threat-2',
          title: 'Test',
          content: 'Content',
          source: 'Source',
          published_at: BASE_TIMESTAMP,
          tldr: 'TLDR',
          category: 'ransomware',
          severity: 'high',
        },
      ];

      const env = createMockEnv(mockThreats);

      const candidates = await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1);

      expect(candidates[0].iocs).toEqual({
        ips: [],
        domains: [],
        cves: [],
        hashes: [],
        urls: [],
        emails: [],
      });
    });

    it('should handle threats with invalid IDs (security check)', async () => {
      const mockThreats = [
        {
          id: 'valid-id-123',
          title: 'Valid',
          content: 'Content',
          source: 'Source',
          published_at: BASE_TIMESTAMP,
          tldr: 'TLDR',
          category: 'ransomware',
          severity: 'high',
        },
        {
          id: 'invalid--id', // Contains special chars
          title: 'Invalid',
          content: 'Content',
          source: 'Source',
          published_at: BASE_TIMESTAMP,
          tldr: 'TLDR',
          category: 'ransomware',
          severity: 'high',
        },
      ];

      const env = createMockEnv(mockThreats);

      const candidates = await fetchCandidateThreats(env, MOCK_THREAT_RANSOMWARE_1);

      // Should filter out invalid ID
      expect(candidates).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle threats with empty content', () => {
      const emptyThreat = {
        ...MOCK_THREAT_RANSOMWARE_2,
        content: '',
      };

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        [emptyThreat],
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].breakdown.content).toBeGreaterThanOrEqual(0);
    });

    it('should handle threats with very long content', () => {
      const longThreat = {
        ...MOCK_THREAT_RANSOMWARE_2,
        content: 'A'.repeat(100000),
      };

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        [longThreat],
        MOCK_SEMANTIC_SCORES
      );

      expect(scores[0].overallScore).toBeGreaterThanOrEqual(0);
      expect(scores[0].overallScore).toBeLessThanOrEqual(1);
    });

    it('should handle all scores being zero', () => {
      const veryDifferentThreat = {
        ...MOCK_THREAT_ZERO_DAY,
        source: MOCK_THREAT_RANSOMWARE_1.source, // Same source to force 0 source score
      };

      const emptySemanticScores = new Map<string, number>([
        ['threat-zero-day-1', 0],
      ]);

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        [veryDifferentThreat],
        emptySemanticScores
      );

      expect(scores[0].overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle perfect similarity (theoretical)', () => {
      // Create identical threat with different ID
      const identicalThreat = {
        ...MOCK_THREAT_RANSOMWARE_1,
        id: 'different-id',
      };

      const perfectScores = new Map<string, number>([
        ['different-id', 1.0],
      ]);

      const scores = calculateMultiSignalSimilarity(
        MOCK_THREAT_RANSOMWARE_1,
        [identicalThreat],
        perfectScores
      );

      // Perfect semantic, content, IOC, temporal, but 0 source (same source)
      expect(scores[0].overallScore).toBeGreaterThan(0.9);
    });
  });
});

// Base timestamp for temporal tests
const BASE_TIMESTAMP = 1733672000;
