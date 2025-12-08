import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Threat, AIAnalysis } from '../../functions/types';

// Mock AI processor
vi.mock('../../functions/utils/ai-processor', () => ({
  analyzeArticle: vi.fn(),
  generateEmbedding: vi.fn(),
}));

import { analyzeArticle, generateEmbedding } from '../../functions/utils/ai-processor';

describe('Integration: AI Processing Workflow', () => {
  function createMockEnv(): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {
        insert: vi.fn().mockResolvedValue({}),
      } as any,
      CACHE: {} as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
    } as any;
  }

  const mockThreat: Threat = {
    id: 'threat-test-123',
    source: 'Test Blog',
    title: 'Critical APT Campaign Discovered',
    url: 'https://example.com/apt-campaign',
    content: 'Detailed analysis of a sophisticated APT campaign targeting financial institutions...',
    published_at: 1704110400,
    fetched_at: 1704110400,
    raw_data: '{}',
  };

  const mockAnalysis: AIAnalysis = {
    tldr: 'APT group targets financial sector with sophisticated malware',
    key_points: [
      'New APT campaign discovered',
      'Targets financial institutions',
      'Uses zero-day exploits',
    ],
    category: 'apt',
    severity: 'critical',
    affected_sectors: ['Finance', 'Banking'],
    threat_actors: ['APT29', 'Cozy Bear'],
    iocs: {
      ips: ['192.168.1.100', '10.0.0.50'],
      domains: ['malicious-site.com', 'evil-domain.net'],
      cves: ['CVE-2024-1234'],
      hashes: ['abc123def456'],
      urls: ['https://evil.com/payload'],
      emails: ['phishing@evil.com'],
    },
    model_strategy: 'tri-model',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AI Analysis Processing', () => {
    it('should complete full AI processing workflow', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      await processArticleWithAI(env, mockThreat);

      // Verify AI analysis was called
      expect(analyzeArticle).toHaveBeenCalledWith(
        env,
        mockThreat,
        undefined // tracker optional
      );

      // Verify summary was stored
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO summaries')
      );
      expect(env.DB.bind).toHaveBeenCalledWith(
        mockThreat.id,
        mockAnalysis.tldr,
        JSON.stringify(mockAnalysis.key_points),
        mockAnalysis.category,
        mockAnalysis.severity,
        JSON.stringify(mockAnalysis.affected_sectors),
        JSON.stringify(mockAnalysis.threat_actors),
        0.85, // confidence score
        'tri-model',
        expect.any(Number) // timestamp
      );

      // Verify IOCs were stored (6 types)
      const iocInsertCalls = (env.DB.prepare as any).mock.calls.filter(
        (call: any[]) => call[0].includes('INSERT INTO iocs')
      );
      expect(iocInsertCalls.length).toBeGreaterThan(0);

      // Verify embedding was generated and inserted
      expect(generateEmbedding).toHaveBeenCalled();
      expect(env.VECTORIZE_INDEX.insert).toHaveBeenCalledWith([
        {
          id: mockThreat.id,
          values: expect.any(Array),
          metadata: {
            title: mockThreat.title,
            category: mockAnalysis.category,
            severity: mockAnalysis.severity,
            published_at: mockThreat.published_at,
          },
        },
      ]);
    });

    it('should store all IOC types correctly', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      await processArticleWithAI(env, mockThreat);

      // Check each IOC type was stored
      const iocBindCalls = (env.DB.bind as any).mock.calls.filter(
        (call: any[]) => call[0] === mockThreat.id && (call[1] === 'ip' || call[1] === 'domain' ||
          call[1] === 'cve' || call[1] === 'hash' || call[1] === 'url' || call[1] === 'email')
      );

      const expectedIOCCount =
        mockAnalysis.iocs.ips.length +
        mockAnalysis.iocs.domains.length +
        mockAnalysis.iocs.cves.length +
        mockAnalysis.iocs.hashes.length +
        mockAnalysis.iocs.urls.length +
        mockAnalysis.iocs.emails.length;

      expect(iocBindCalls.length).toBe(expectedIOCCount);
    });

    it('should handle AI analysis failure gracefully', async () => {
      (analyzeArticle as any).mockResolvedValue(null);

      const env = createMockEnv();
      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      await processArticleWithAI(env, mockThreat);

      // Verify empty summary was stored to mark as processed
      expect(env.DB.bind).toHaveBeenCalledWith(
        mockThreat.id,
        'AI analysis unavailable',
        JSON.stringify([]),
        'other',
        'info',
        0.0,
        null, // no model strategy
        expect.any(Number)
      );

      // Should not generate embedding
      expect(generateEmbedding).not.toHaveBeenCalled();
      expect(env.VECTORIZE_INDEX.insert).not.toHaveBeenCalled();
    });

    it('should skip duplicate IOCs silently', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      (env.DB.run as any)
        .mockResolvedValueOnce({ success: true }) // summary insert
        .mockRejectedValueOnce(new Error('UNIQUE constraint failed: iocs.ioc_value')) // first IOC duplicate
        .mockResolvedValue({ success: true }); // rest succeed

      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      // Should not throw
      await expect(processArticleWithAI(env, mockThreat)).resolves.not.toThrow();
    });

    it('should generate embedding from threat content and analysis', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      await processArticleWithAI(env, mockThreat);

      // Verify embedding text includes title, TLDR, and key points
      expect(generateEmbedding).toHaveBeenCalledWith(
        env,
        expect.stringContaining(mockThreat.title),
        undefined // tracker optional
      );

      const embeddingText = (generateEmbedding as any).mock.calls[0][1];
      expect(embeddingText).toContain(mockThreat.title);
      expect(embeddingText).toContain(mockAnalysis.tldr);
      expect(embeddingText).toContain(mockAnalysis.key_points[0]);
    });

    it('should handle embedding generation failure', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(null);

      const env = createMockEnv();
      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      // Should not throw, should complete without vector insertion
      await expect(processArticleWithAI(env, mockThreat)).resolves.not.toThrow();

      expect(env.VECTORIZE_INDEX.insert).not.toHaveBeenCalled();
    });
  });

  describe('Batch AI Processing', () => {
    it('should process pending threats in batch', async () => {
      const pendingThreats = [
        { ...mockThreat, id: 'threat-1' },
        { ...mockThreat, id: 'threat-2' },
        { ...mockThreat, id: 'threat-3' },
      ];

      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      (env.DB.all as any).mockResolvedValue({ results: pendingThreats });

      const { processAIPendingThreats } = await import('./helpers/ai-helpers');

      const processed = await processAIPendingThreats(env, 10);

      expect(processed).toBe(3);
      expect(analyzeArticle).toHaveBeenCalledTimes(3);
    });

    it('should limit to MAX_AI_PROCESSING_PER_RUN', async () => {
      const env = createMockEnv();

      const { processAIPendingThreats } = await import('./helpers/ai-helpers');

      await processAIPendingThreats(env, 10);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?')
      );
      expect(env.DB.bind).toHaveBeenCalledWith(10);
    });

    it('should continue processing after individual failures', async () => {
      const pendingThreats = [
        { ...mockThreat, id: 'threat-1' },
        { ...mockThreat, id: 'threat-2' },
        { ...mockThreat, id: 'threat-3' },
      ];

      (analyzeArticle as any)
        .mockResolvedValueOnce(mockAnalysis)
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValueOnce(mockAnalysis);

      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      (env.DB.all as any).mockResolvedValue({ results: pendingThreats });

      const { processAIPendingThreats } = await import('./helpers/ai-helpers');

      const processed = await processAIPendingThreats(env, 10);

      // Should process 2 out of 3 (middle one failed)
      expect(processed).toBe(2);
    });

    it('should handle empty pending queue', async () => {
      const env = createMockEnv();
      (env.DB.all as any).mockResolvedValue({ results: [] });

      const { processAIPendingThreats } = await import('./helpers/ai-helpers');

      const processed = await processAIPendingThreats(env, 10);

      expect(processed).toBe(0);
      expect(analyzeArticle).not.toHaveBeenCalled();
    });
  });

  describe('Neuron Tracking', () => {
    it('should track neuron usage when tracker provided', async () => {
      (analyzeArticle as any).mockResolvedValue(mockAnalysis);
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.1));

      const env = createMockEnv();
      const mockTracker = {
        trackInference: vi.fn(),
        getSummary: vi.fn(),
        getBreakdown: vi.fn(),
      };

      const { processArticleWithAI } = await import('./helpers/ai-helpers');

      await processArticleWithAI(env, mockThreat, mockTracker as any);

      expect(analyzeArticle).toHaveBeenCalledWith(env, mockThreat, mockTracker);
      expect(generateEmbedding).toHaveBeenCalledWith(
        env,
        expect.any(String),
        mockTracker
      );
    });
  });
});
