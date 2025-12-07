// AI Processing Utilities using Workers AI
import type { Env, AIAnalysis, Threat } from '../types';
import { AI_MODELS } from '../constants';
import { logError } from './logger';
import { truncateText } from './text';
import { parseAIResponse, parseAITextResponse, validateAIResponse } from './ai-response-parser';

const SYSTEM_PROMPT = `You are a cybersecurity analyst. Analyze threat intelligence articles and extract key information.

Output ONLY valid JSON in this exact format:
{
  "tldr": "One sentence summary of the threat",
  "key_points": ["point 1", "point 2", "point 3"],
  "category": "ransomware|apt|vulnerability|phishing|malware|data_breach|ddos|supply_chain|insider_threat|other",
  "severity": "critical|high|medium|low|info",
  "affected_sectors": ["sector1", "sector2"],
  "threat_actors": ["actor1", "actor2"],
  "iocs": {
    "ips": ["1.2.3.4"],
    "domains": ["example.com"],
    "cves": ["CVE-2024-1234"],
    "hashes": ["abc123"],
    "urls": ["https://malicious.com"],
    "emails": ["attacker@evil.com"]
  }
}

If no IOCs found, use empty arrays. Be conservative with severity ratings.`;

export async function analyzeArticle(env: Env, article: Threat): Promise<AIAnalysis | null> {
  try {
    // Truncate content to fit model context (roughly 4000 tokens)
    const truncatedContent = truncateText(article.content, 12000);

    const userPrompt = `Title: ${article.title}\n\nContent: ${truncatedContent}\n\nSource: ${article.source}`;

    const response = await env.AI.run(AI_MODELS.TEXT_GENERATION, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent output
      max_tokens: 1024,
    });

    // Parse the response using unified parser
    const analysis = parseAIResponse<AIAnalysis>(response);

    // Validate the analysis has required fields
    if (!analysis || !validateAIResponse(analysis, ['tldr', 'category', 'severity'])) {
      return null;
    }

    return analysis;
  } catch (error) {
    logError('Error analyzing article', error, {
      threatId: article.id,
      threatTitle: article.title,
    });
    return null;
  }
}

export async function generateEmbedding(env: Env, text: string): Promise<number[] | null> {
  try {
    // Truncate text for embedding model (max ~512 tokens)
    const truncatedText = truncateText(text, 2000);

    const response = await env.AI.run(AI_MODELS.EMBEDDINGS, {
      text: truncatedText,
    });

    if (response && 'data' in response && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0] as number[];
    }

    logError('Invalid embedding response', new Error('Unexpected format'), { response });
    return null;
  } catch (error) {
    logError('Error generating embedding', error, {
      textLength: text.length,
    });
    return null;
  }
}

export async function analyzeTrends(env: Env, threats: Threat[], summaries: any[]): Promise<string> {
  try {
    // Create a summary of the week's threats
    const threatSummary = summaries
      .map((s, i) => {
        const threat = threats[i];
        return `- [${s.severity.toUpperCase()}] ${s.category}: ${threat.title} (${s.tldr})`;
      })
      .join('\n');

    const trendPrompt = `Analyze this week's threat intelligence and identify:
1. Emerging trends and patterns
2. Notable campaigns or threat actors
3. Industry sectors most targeted
4. Recommended defensive actions

Threats this week:
${threatSummary}

Provide a concise analysis (3-5 paragraphs).`;

    const response = await env.AI.run(AI_MODELS.TEXT_GENERATION, {
      messages: [
        {
          role: 'system',
          content: 'You are a senior cybersecurity analyst. Provide strategic threat intelligence analysis.',
        },
        { role: 'user', content: trendPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return parseAITextResponse(response, 'Unable to generate trend analysis.');
  } catch (error) {
    logError('Error analyzing trends', error, {
      threatCount: threats.length,
      summaryCount: summaries.length,
    });
    return 'Error generating trend analysis.';
  }
}

export async function semanticSearch(
  env: Env,
  query: string,
  limit: number = 10
): Promise<{ id: string; score: number }[]> {
  try {
    // Generate embedding for search query
    const embedding = await generateEmbedding(env, query);
    if (!embedding) {
      return [];
    }

    // Search vectorize index
    const results = await env.VECTORIZE_INDEX.query(embedding, {
      topK: limit,
      returnMetadata: true,
    });

    return results.matches.map((match: VectorizeMatch) => ({
      id: match.id,
      score: match.score,
    }));
  } catch (error) {
    logError('Error in semantic search', error, {
      query,
      limit,
    });
    return [];
  }
}
