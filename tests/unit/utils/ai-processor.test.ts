import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeArticle,
  generateEmbedding,
  analyzeTrends,
  semanticSearch,
} from '../../../functions/utils/ai-processor';
import type { Env, Threat, AIAnalysis } from '../../../functions/types';
import {
  MOCK_THREAT_RANSOMWARE,
  MOCK_THREAT_APT,
  MOCK_THREAT_EMPTY_CONTENT,
  MOCK_ANALYSIS_RANSOMWARE,
  MOCK_AI_RESPONSE_BASELINE,
  MOCK_AI_RESPONSE_BASIC_INFO,
  MOCK_AI_RESPONSE_DETAILED_INFO,
  MOCK_AI_RESPONSE_INVALID,
  MOCK_AI_RESPONSE_MISSING_FIELDS,
  MOCK_EMBEDDING_RESPONSE,
  MOCK_EMBEDDING_RESPONSE_INVALID,
  MOCK_TREND_ANALYSIS_RESPONSE,
  MOCK_VECTORIZE_MATCHES,
  MOCK_VECTORIZE_EMPTY_MATCHES,
} from '../../fixtures/ai-processor';
import * as constants from '../../../functions/constants';

// Mock environment
function createMockEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {} as any,
    AI: {
      run: vi.fn().mockResolvedValue(MOCK_AI_RESPONSE_BASELINE),
    } as any,
    VECTORIZE_INDEX: {
      query: vi.fn().mockResolvedValue({ matches: MOCK_VECTORIZE_MATCHES }),
    } as any,
    CACHE: {} as any,
    ANALYTICS: {
      writeDataPoint: vi.fn(),
    } as any,
    THREAT_ARCHIVE: {} as any,
    ASSETS: {} as any,
    AI_GATEWAY_ID: 'test-gateway-id',
    ...overrides,
  };
}

describe('AI Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeArticle() - Orchestration', () => {
    it('should use baseline mode when MODE is "baseline"', async () => {
      const env = createMockEnv();

      // Mock the deployment config to use baseline mode
      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'baseline',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      expect(result).toBeTruthy();
      expect(result?.model_strategy).toBe('baseline');
      expect(env.AI.run).toHaveBeenCalledTimes(1);
    });

    it('should use trimodel mode when MODE is "trimodel"', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_BASIC_INFO) // 1B model
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_DETAILED_INFO), // 30B model
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'trimodel',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_APT);

      expect(result).toBeTruthy();
      expect(result?.model_strategy).toBe('trimodel');
      // Should call AI twice (parallel execution)
      expect(env.AI.run).toHaveBeenCalledTimes(2);
    });

    it('should use canary mode and randomly select model based on percentage', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_BASIC_INFO)
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_DETAILED_INFO),
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'canary',
        CANARY_PERCENT: 100, // Force trimodel selection
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_APT);

      expect(result).toBeTruthy();
      // With 100% canary, should use trimodel
      expect(result?.model_strategy).toBe('trimodel');
    });

    it('should run both models in shadow mode but return baseline result', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_BASELINE) // Baseline
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_BASIC_INFO) // Trimodel 1B
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_DETAILED_INFO), // Trimodel 30B
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'shadow',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: true,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      expect(result).toBeTruthy();
      expect(result?.model_strategy).toBe('baseline');
      // Should call AI 3 times (baseline + trimodel)
      expect(env.AI.run).toHaveBeenCalledTimes(3);
    });

    it('should return null when trimodel fails without exception', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockRejectedValueOnce(new Error('AI service error')) // 1B model fails
            .mockRejectedValueOnce(new Error('AI service error')), // 30B model fails
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'trimodel',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      // When trimodel fails (both models return null), the function returns null
      // No fallback happens because no exception was thrown from the mode handler
      expect(result).toBeNull();
      // Should call AI 2 times: 1B (fail) + 30B (fail)
      expect(env.AI.run).toHaveBeenCalledTimes(2);
    });

    it('should log analytics on failure', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockRejectedValueOnce(new Error('Complete failure'))  // Baseline fails
            .mockRejectedValueOnce(new Error('Fallback also fails')), // Fallback also fails
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'baseline',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      // When baseline fails, it logs 'baseline_analysis_failure'
      expect(env.ANALYTICS.writeDataPoint).toHaveBeenCalled();
      const calls = (env.ANALYTICS.writeDataPoint as any).mock.calls;
      expect(calls.some((call: any) => call[0].blobs.includes('baseline_analysis_failure'))).toBe(true);
    });
  });

  describe('generateEmbedding()', () => {
    it('should generate embeddings successfully', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      const result = await generateEmbedding(env, 'Test threat article content');

      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      expect(result?.length).toBe(1024);
    });

    it('should use correct embedding model based on deployment mode', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'trimodel',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      await generateEmbedding(env, 'Test content');

      expect(env.AI.run).toHaveBeenCalledWith(
        constants.AI_MODELS.EMBEDDINGS,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use fallback embedding model in baseline mode', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'baseline',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      await generateEmbedding(env, 'Test content');

      expect(env.AI.run).toHaveBeenCalledWith(
        constants.AI_MODELS.EMBEDDINGS_FALLBACK,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return null for invalid embedding response', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE_INVALID),
        } as any,
      });

      const result = await generateEmbedding(env, 'Test content');

      expect(result).toBeNull();
    });

    it('should return null on embedding generation error', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockRejectedValue(new Error('Embedding error')),
        } as any,
      });

      const result = await generateEmbedding(env, 'Test content');

      expect(result).toBeNull();
    });

    it('should truncate text for embedding model', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      const longText = 'A'.repeat(5000); // Very long text
      await generateEmbedding(env, longText);

      // Should truncate to ~2000 characters (allowing small margin for truncation logic)
      expect(env.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.any(String),
        }),
        expect.any(Object)
      );

      const callArgs = (env.AI.run as any).mock.calls[0][1];
      expect(callArgs.text.length).toBeLessThanOrEqual(2010); // Allow small margin
    });
  });

  describe('analyzeTrends()', () => {
    it('should generate trend analysis successfully', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_TREND_ANALYSIS_RESPONSE),
        } as any,
      });

      const threats = [MOCK_THREAT_RANSOMWARE, MOCK_THREAT_APT];
      const summaries = [
        { category: 'ransomware', severity: 'critical', tldr: 'Ransomware alert' },
        { category: 'apt', severity: 'high', tldr: 'APT campaign' },
      ];

      const result = await analyzeTrends(env, threats, summaries);

      expect(result).toBeTruthy();
      expect(result).toContain('threat landscape');
      expect(result.toLowerCase()).toContain('ransomware'); // Case-insensitive check
    });

    it('should use correct model for trend analysis based on deployment mode', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_TREND_ANALYSIS_RESPONSE),
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'trimodel',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      await analyzeTrends(env, [MOCK_THREAT_RANSOMWARE], [{ category: 'ransomware', severity: 'critical', tldr: 'test' }]);

      expect(env.AI.run).toHaveBeenCalledWith(
        constants.AI_MODELS.TEXT_GENERATION_LARGE,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return error message on failure', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockRejectedValue(new Error('Trend analysis failed')),
        } as any,
      });

      const result = await analyzeTrends(env, [], []);

      expect(result).toBe('Error generating trend analysis.');
    });
  });

  describe('semanticSearch()', () => {
    it('should perform semantic search successfully', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      const results = await semanticSearch(env, 'ransomware attacks', 10);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        id: 'threat-1',
        score: 0.95,
      });
      expect(env.VECTORIZE_INDEX.query).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          topK: 10,
          returnMetadata: true,
        })
      );
    });

    it('should return empty array when embedding generation fails', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE_INVALID),
        } as any,
      });

      const results = await semanticSearch(env, 'test query');

      expect(results).toEqual([]);
    });

    it('should return empty array on search error', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
        VECTORIZE_INDEX: {
          query: vi.fn().mockRejectedValue(new Error('Search failed')),
        } as any,
      });

      const results = await semanticSearch(env, 'test query');

      expect(results).toEqual([]);
    });

    it('should handle empty search results', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
        VECTORIZE_INDEX: {
          query: vi.fn().mockResolvedValue({ matches: MOCK_VECTORIZE_EMPTY_MATCHES }),
        } as any,
      });

      const results = await semanticSearch(env, 'nonexistent query');

      expect(results).toEqual([]);
    });

    it('should use default limit when not specified', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_EMBEDDING_RESPONSE),
        } as any,
      });

      await semanticSearch(env, 'test query');

      expect(env.VECTORIZE_INDEX.query).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          topK: 10, // Default limit
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty article content gracefully', async () => {
      const env = createMockEnv();

      const result = await analyzeArticle(env, MOCK_THREAT_EMPTY_CONTENT);

      // Should still attempt to analyze even with empty content
      expect(env.AI.run).toHaveBeenCalled();
    });

    it('should handle malformed AI responses', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_AI_RESPONSE_INVALID),
        } as any,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      expect(result).toBeNull();
    });

    it('should handle AI responses with missing required fields', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(MOCK_AI_RESPONSE_MISSING_FIELDS),
        } as any,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      expect(result).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should complete full baseline analysis workflow', async () => {
      const env = createMockEnv();

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'baseline',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_RANSOMWARE);

      expect(result).toBeTruthy();
      expect(result?.tldr).toBeTruthy();
      expect(result?.category).toBeTruthy();
      expect(result?.severity).toBeTruthy();
      expect(result?.model_strategy).toBe('baseline');
    });

    it('should complete full trimodel analysis workflow', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn()
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_BASIC_INFO)
            .mockResolvedValueOnce(MOCK_AI_RESPONSE_DETAILED_INFO),
        } as any,
      });

      vi.spyOn(constants, 'DEPLOYMENT_CONFIG', 'get').mockReturnValue({
        MODE: 'trimodel',
        CANARY_PERCENT: 0,
        VALIDATION_LOGGING: false,
      });

      const result = await analyzeArticle(env, MOCK_THREAT_APT);

      expect(result).toBeTruthy();
      expect(result?.tldr).toBeTruthy();
      expect(result?.category).toBe('apt');
      expect(result?.severity).toBe('high');
      expect(result?.key_points).toHaveLength(3);
      expect(result?.model_strategy).toBe('trimodel');
    });
  });
});
