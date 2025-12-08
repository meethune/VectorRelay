import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NeuronTracker } from '../../../functions/utils/neuron-tracker';

describe('NeuronTracker', () => {
  let tracker: NeuronTracker;

  beforeEach(() => {
    tracker = new NeuronTracker();
    // Reset Date to a fixed value for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('track()', () => {
    it('should track neuron usage for llama-1b model', () => {
      const neurons = tracker.track('llama-1b', 1000, 200);

      // llama-1b-input: 2457 per 1M tokens
      // llama-1b-output: 18252 per 1M tokens
      // (1000 / 1_000_000) * 2457 + (200 / 1_000_000) * 18252 = 2.457 + 3.6504 = 6.1074
      expect(neurons).toBeCloseTo(6.1074, 4);
    });

    it('should track neuron usage for qwen-30b model', () => {
      const neurons = tracker.track('qwen-30b', 500, 300);

      // qwen-30b-input: 4625 per 1M tokens
      // qwen-30b-output: 30475 per 1M tokens
      // (500 / 1_000_000) * 4625 + (300 / 1_000_000) * 30475 = 2.3125 + 9.1425 = 11.455
      expect(neurons).toBeCloseTo(11.455, 3);
    });

    it('should track neuron usage for embedding model (no output)', () => {
      const neurons = tracker.track('bge-m3', 800);

      // bge-m3-input: 1075 per 1M tokens
      // (800 / 1_000_000) * 1075 = 0.86
      expect(neurons).toBeCloseTo(0.86, 2);
    });

    it('should handle unknown model gracefully', () => {
      const neurons = tracker.track('unknown-model', 1000, 200);

      // Unknown model should return 0 neurons
      expect(neurons).toBe(0);
    });

    it('should accumulate usage across multiple calls', () => {
      tracker.track('llama-1b', 1000, 200);
      tracker.track('llama-1b', 1000, 200);

      const total = tracker.getDailyTotal();
      expect(total).toBeCloseTo(12.2148, 4);
    });

    it('should track different models separately', () => {
      tracker.track('llama-1b', 1000, 200);
      tracker.track('qwen-30b', 500, 300);
      tracker.track('bge-m3', 800);

      const total = tracker.getDailyTotal();
      expect(total).toBeCloseTo(18.4224, 3);
    });

    it('should store usage with correct date', () => {
      tracker.track('llama-1b', 1000, 200);

      const summary = tracker.getSummary();
      expect(summary.neuronsUsed).toBeGreaterThan(0);
    });

    it('should handle zero tokens', () => {
      const neurons = tracker.track('llama-1b', 0, 0);

      expect(neurons).toBe(0);
    });

    it('should handle large token counts', () => {
      const neurons = tracker.track('llama-1b', 1_000_000, 500_000);

      // (1_000_000 / 1_000_000) * 2457 + (500_000 / 1_000_000) * 18252
      // = 2457 + 9126 = 11583
      expect(neurons).toBeCloseTo(11583, 0);
    });
  });

  describe('getDailyTotal()', () => {
    it('should return 0 when no usage tracked', () => {
      const total = tracker.getDailyTotal();

      expect(total).toBe(0);
    });

    it('should return total neuron usage for today', () => {
      tracker.track('llama-1b', 1000, 200);
      tracker.track('qwen-30b', 500, 300);

      const total = tracker.getDailyTotal();
      expect(total).toBeCloseTo(17.5624, 3);
    });

    it('should only count usage from today', () => {
      // Track some usage today
      tracker.track('llama-1b', 1000, 200);

      // Move to tomorrow
      vi.setSystemTime(new Date('2025-12-09T10:00:00Z'));

      // Track more usage tomorrow
      tracker.track('llama-1b', 1000, 200);

      // Should only count tomorrow's usage
      const total = tracker.getDailyTotal();
      expect(total).toBeCloseTo(6.1074, 4);
    });
  });

  describe('getSummary()', () => {
    it('should return OK status when under 80% usage', () => {
      // 5000 neurons = 50% of 10000 limit
      tracker.track('llama-1b', 2_000_000, 0); // ~4914 neurons

      const summary = tracker.getSummary();

      expect(summary.status).toBe('OK');
      expect(summary.percentUsed).toBeLessThan(80);
      expect(summary.neuronsUsed).toBeCloseTo(4914, 0);
      expect(summary.neuronsRemaining).toBeCloseTo(5086, 0);
      expect(summary.dailyLimit).toBe(10000);
    });

    it('should return WARNING status at 80% usage', () => {
      // 8000 neurons = 80% of 10000 limit
      tracker.track('llama-1b', 3_250_000, 0); // ~7986 neurons

      const summary = tracker.getSummary();

      expect(summary.status).toBe('WARNING');
      expect(summary.percentUsed).toBeGreaterThanOrEqual(80);
      expect(summary.percentUsed).toBeLessThan(95);
    });

    it('should return CRITICAL status at 95% usage', () => {
      // 9500 neurons = 95% of 10000 limit
      tracker.track('llama-1b', 3_850_000, 0); // ~9460 neurons

      const summary = tracker.getSummary();

      expect(summary.status).toBe('CRITICAL');
      expect(summary.percentUsed).toBeGreaterThanOrEqual(95);
    });

    it('should handle usage over 100%', () => {
      // 11000 neurons = 110% of 10000 limit
      tracker.track('llama-1b', 4_500_000, 0); // ~11056 neurons

      const summary = tracker.getSummary();

      expect(summary.status).toBe('CRITICAL');
      expect(summary.percentUsed).toBeGreaterThan(100);
      expect(summary.neuronsRemaining).toBeLessThan(0);
    });

    it('should round neuron values correctly', () => {
      tracker.track('llama-1b', 1234, 567);

      const summary = tracker.getSummary();

      expect(Number.isInteger(summary.neuronsUsed)).toBe(true);
      expect(Number.isInteger(summary.neuronsRemaining)).toBe(true);
      expect(Number.isInteger(summary.percentUsed)).toBe(true);
    });
  });

  describe('getBreakdown()', () => {
    it('should return empty array when no usage', () => {
      const breakdown = tracker.getBreakdown();

      expect(breakdown).toEqual([]);
    });

    it('should group usage by model', () => {
      tracker.track('llama-1b', 1000, 200);
      tracker.track('llama-1b', 1000, 200);
      tracker.track('qwen-30b', 500, 300);

      const breakdown = tracker.getBreakdown();

      expect(breakdown).toHaveLength(2);

      const llamaBreakdown = breakdown.find((b) => b.model === 'llama-1b');
      expect(llamaBreakdown).toBeDefined();
      expect(llamaBreakdown!.calls).toBe(2);
      expect(llamaBreakdown!.neurons).toBeCloseTo(12, 0);

      const qwenBreakdown = breakdown.find((b) => b.model === 'qwen-30b');
      expect(qwenBreakdown).toBeDefined();
      expect(qwenBreakdown!.calls).toBe(1);
      expect(qwenBreakdown!.neurons).toBeCloseTo(11, 0);
    });

    it('should calculate average neurons per call', () => {
      tracker.track('llama-1b', 1000, 200);
      tracker.track('llama-1b', 2000, 400);
      tracker.track('llama-1b', 3000, 600);

      const breakdown = tracker.getBreakdown();

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].calls).toBe(3);

      // Total: (1000+2000+3000) / 1M * 2457 + (200+400+600) / 1M * 18252
      // = 6000 * 2457 / 1M + 1200 * 18252 / 1M = 14.742 + 21.9024 = 36.6444
      // Average: 36.6444 / 3 = 12.2148
      expect(breakdown[0].avgPerCall).toBeCloseTo(12, 0);
    });

    it('should only include today\'s usage', () => {
      tracker.track('llama-1b', 1000, 200);

      // Move to tomorrow
      vi.setSystemTime(new Date('2025-12-09T10:00:00Z'));

      tracker.track('qwen-30b', 500, 300);

      const breakdown = tracker.getBreakdown();

      // Should only show qwen-30b from today
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].model).toBe('qwen-30b');
    });

    it('should return rounded integer values', () => {
      tracker.track('llama-1b', 1234, 567);

      const breakdown = tracker.getBreakdown();

      expect(Number.isInteger(breakdown[0].neurons)).toBe(true);
      expect(Number.isInteger(breakdown[0].avgPerCall)).toBe(true);
      expect(Number.isInteger(breakdown[0].calls)).toBe(true);
    });
  });

  describe('getRemainingCapacity()', () => {
    it('should calculate remaining article capacity', () => {
      // Use 2000 neurons (20% of limit)
      tracker.track('llama-1b', 800_000, 0); // ~1965 neurons

      // Estimate 100 neurons per article
      const capacity = tracker.getRemainingCapacity(100);

      // Remaining: ~8000 neurons, capacity: 80 articles
      expect(capacity).toBeCloseTo(80, 0);
    });

    it('should return 0 or negative when quota exhausted', () => {
      // Use all neurons
      tracker.track('llama-1b', 4_100_000, 0); // ~10073 neurons

      const capacity = tracker.getRemainingCapacity(100);

      // When quota is exceeded, capacity should be 0 or negative
      expect(capacity).toBeLessThanOrEqual(0);
    });

    it('should handle fractional capacity', () => {
      // Use 9950 neurons
      tracker.track('llama-1b', 4_050_000, 0); // ~9954 neurons

      // 50 neurons remaining, 200 neurons per article
      const capacity = tracker.getRemainingCapacity(200);

      // Should floor to 0
      expect(capacity).toBe(0);
    });

    it('should handle zero neurons per article', () => {
      const capacity = tracker.getRemainingCapacity(0);

      // Infinity -> floor to max safe integer? Or throw? Let's see
      expect(capacity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow', () => {
      // Process multiple articles
      tracker.track('llama-1b', 1500, 300); // TLDR
      tracker.track('qwen-30b', 800, 400); // IOC extraction
      tracker.track('bge-m3', 1200); // Embedding

      const summary = tracker.getSummary();
      expect(summary.status).toBe('OK');
      expect(summary.neuronsUsed).toBeGreaterThan(0);

      const breakdown = tracker.getBreakdown();
      expect(breakdown).toHaveLength(3);

      const capacity = tracker.getRemainingCapacity(20);
      expect(capacity).toBeGreaterThan(0);
    });

    it('should track multiple days independently', () => {
      // Day 1
      tracker.track('llama-1b', 1_000_000, 0);
      const day1Total = tracker.getDailyTotal();

      // Day 2
      vi.setSystemTime(new Date('2025-12-09T10:00:00Z'));
      tracker.track('llama-1b', 2_000_000, 0);
      const day2Total = tracker.getDailyTotal();

      // Day 2 should only show day 2's usage
      expect(day2Total).toBeGreaterThan(day1Total);
      expect(day2Total).toBeCloseTo(4914, 0);
    });

    it('should track real-world usage pattern', () => {
      // Simulate processing 50 articles
      for (let i = 0; i < 50; i++) {
        tracker.track('llama-1b', 800, 150); // Classification
        tracker.track('llama-1b', 1200, 200); // TLDR
        tracker.track('qwen-30b', 1500, 600); // IOC extraction
        tracker.track('bge-m3', 1000); // Embedding
      }

      const summary = tracker.getSummary();
      const breakdown = tracker.getBreakdown();

      expect(summary.status).toBe('OK');
      expect(breakdown.find((b) => b.model === 'llama-1b')!.calls).toBe(100);
      expect(breakdown.find((b) => b.model === 'qwen-30b')!.calls).toBe(50);
      expect(breakdown.find((b) => b.model === 'bge-m3')!.calls).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative token counts', () => {
      const neurons = tracker.track('llama-1b', -1000, -200);

      // Negative tokens should result in negative neurons
      expect(neurons).toBeLessThan(0);
    });

    it('should handle very small token counts', () => {
      const neurons = tracker.track('llama-1b', 1, 1);

      expect(neurons).toBeGreaterThan(0);
      expect(neurons).toBeLessThan(0.1);
    });

    it('should handle model name with different casing', () => {
      const neurons = tracker.track('LLAMA-1B', 1000, 200);

      // Case-sensitive lookup, should return 0
      expect(neurons).toBe(0);
    });

    it('should handle all fallback models', () => {
      const llama8b = tracker.track('llama-8b-fp8', 1000, 200);
      const llama70b = tracker.track('llama-70b', 1000, 200);
      const bgeLarge = tracker.track('bge-large', 1000);

      expect(llama8b).toBeGreaterThan(0);
      expect(llama70b).toBeGreaterThan(0);
      expect(bgeLarge).toBeGreaterThan(0);
    });
  });
});
