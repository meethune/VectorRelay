// AI Processing Utilities using Workers AI
import type { Env, AIAnalysis, Threat } from '../types';

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
    const maxContentLength = 12000;
    const truncatedContent =
      article.content.length > maxContentLength
        ? article.content.substring(0, maxContentLength) + '...'
        : article.content;

    const userPrompt = `Title: ${article.title}\n\nContent: ${truncatedContent}\n\nSource: ${article.source}`;

    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent output
      max_tokens: 1024,
    });

    // Parse the response - handle new Workers AI response format
    let analysis: AIAnalysis;

    if (typeof response === 'object' && 'response' in response) {
      // New format: { response: { tldr, key_points, ... }, tool_calls: [], usage: {} }
      if (typeof response.response === 'object') {
        // Response is already parsed JSON
        analysis = response.response as AIAnalysis;
      } else {
        // Response is a JSON string
        const jsonMatch = (response.response as string).match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('No JSON found in AI response:', response.response);
          return null;
        }
        analysis = JSON.parse(jsonMatch[0]);
      }
    } else if (typeof response === 'string') {
      // Legacy format: just a string
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in AI response:', response);
        return null;
      }
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      console.error('Unexpected AI response format:', response);
      return null;
    }

    // Validate the analysis
    if (!analysis.tldr || !analysis.category || !analysis.severity) {
      console.error('Invalid analysis structure:', analysis);
      return null;
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing article:', error);
    return null;
  }
}

export async function generateEmbedding(env: Env, text: string): Promise<number[] | null> {
  try {
    // Truncate text for embedding model (max ~512 tokens)
    const maxLength = 2000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const response = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text: truncatedText,
    });

    if (response && 'data' in response && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0] as number[];
    }

    console.error('Invalid embedding response:', response);
    return null;
  } catch (error) {
    console.error('Error generating embedding:', error);
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

    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
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

    if (typeof response === 'object' && 'response' in response) {
      return response.response as string;
    } else if (typeof response === 'string') {
      return response;
    }

    return 'Unable to generate trend analysis.';
  } catch (error) {
    console.error('Error analyzing trends:', error);
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
    console.error('Error in semantic search:', error);
    return [];
  }
}
