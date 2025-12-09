/**
 * NeuronTracker - Real-time neuron usage monitoring for Workers AI
 *
 * Tracks neuron consumption to ensure we stay within the free tier limit (10,000 neurons/day).
 * Provides early warnings at 80% and critical alerts at 95% usage.
 *
 * Usage:
 * ```typescript
 * const tracker = new NeuronTracker();
 * const neurons = tracker.track('mistral-24b', 1000, 200);
 * const summary = tracker.getSummary();
 * if (summary.status !== 'OK') {
 *   console.warn(`Neuron usage: ${summary.percentUsed}%`);
 * }
 * ```
 */

export interface NeuronUsage {
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  neurons: number;
}

/**
 * Neuron costs per million tokens for Workers AI models
 *
 * Source: https://developers.cloudflare.com/workers-ai/platform/pricing/
 * Updated: December 2025
 *
 * Format: neurons per 1M tokens (input/output)
 */
const NEURON_COSTS = {
  // Mistral-Small-3.1 24B (current production - classification, TLDR)
  'mistral-24b-input': 31876,
  'mistral-24b-output': 50488,

  // Llama 3.2 1B (DEPRECATED - no longer used)
  'llama-1b-input': 2457,
  'llama-1b-output': 18252,

  // Llama 3.1 8B fp8-fast (fallback small model)
  'llama-8b-fp8-input': 4119,
  'llama-8b-fp8-output': 34868,

  // Llama 3.3 70B fp8-fast (fallback large model)
  'llama-70b-input': 26668,
  'llama-70b-output': 204805,

  // Qwen3 30B (large model - IOC extraction, key points)
  'qwen-30b-input': 4625,
  'qwen-30b-output': 30475,

  // BGE-M3 (embeddings)
  'bge-m3-input': 1075,

  // BGE-Large (fallback embeddings)
  'bge-large-input': 18252,
} as const;

export class NeuronTracker {
  private usage: NeuronUsage[] = [];
  private dailyLimit = 10000; // Free tier limit

  /**
   * Track neuron usage for an AI model inference
   *
   * @param model - Model identifier (e.g., 'mistral-24b', 'qwen-30b', 'bge-m3')
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens (0 for embedding models)
   * @returns Neurons consumed by this inference
   */
  track(model: string, inputTokens: number, outputTokens: number = 0): number {
    const date = new Date().toISOString().split('T')[0];

    // Calculate neurons based on token counts
    const inputKey = `${model}-input` as keyof typeof NEURON_COSTS;
    const outputKey = `${model}-output` as keyof typeof NEURON_COSTS;

    const inputNeurons = (inputTokens / 1_000_000) * (NEURON_COSTS[inputKey] || 0);
    const outputNeurons = (outputTokens / 1_000_000) * (NEURON_COSTS[outputKey] || 0);

    const neurons = inputNeurons + outputNeurons;

    this.usage.push({
      date,
      model,
      inputTokens,
      outputTokens,
      neurons,
    });

    return neurons;
  }

  /**
   * Get total neuron usage for today
   *
   * @returns Total neurons consumed today
   */
  getDailyTotal(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.usage
      .filter((u) => u.date === today)
      .reduce((sum, u) => sum + u.neurons, 0);
  }

  /**
   * Get summary of neuron usage with status indicator
   *
   * @returns Usage summary with status (OK/WARNING/CRITICAL)
   */
  getSummary() {
    const total = this.getDailyTotal();
    const percent = Math.round((total / this.dailyLimit) * 100);

    let status: 'OK' | 'WARNING' | 'CRITICAL';
    if (percent >= 95) {
      status = 'CRITICAL';
    } else if (percent >= 80) {
      status = 'WARNING';
    } else {
      status = 'OK';
    }

    return {
      neuronsUsed: Math.round(total),
      neuronsRemaining: Math.round(this.dailyLimit - total),
      percentUsed: percent,
      dailyLimit: this.dailyLimit,
      status,
    };
  }

  /**
   * Get detailed breakdown by model
   *
   * @returns Array of model usage with totals
   */
  getBreakdown() {
    const today = new Date().toISOString().split('T')[0];
    const modelMap = new Map<string, { neurons: number; calls: number }>();

    this.usage
      .filter((u) => u.date === today)
      .forEach((u) => {
        const existing = modelMap.get(u.model) || { neurons: 0, calls: 0 };
        modelMap.set(u.model, {
          neurons: existing.neurons + u.neurons,
          calls: existing.calls + 1,
        });
      });

    return Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      neurons: Math.round(data.neurons),
      calls: data.calls,
      avgPerCall: Math.round(data.neurons / data.calls),
    }));
  }

  /**
   * Estimate remaining capacity (how many more articles can be processed)
   *
   * @param neuronsPerArticle - Average neurons consumed per article
   * @returns Estimated remaining article capacity
   */
  getRemainingCapacity(neuronsPerArticle: number): number {
    const summary = this.getSummary();
    return Math.floor(summary.neuronsRemaining / neuronsPerArticle);
  }
}
