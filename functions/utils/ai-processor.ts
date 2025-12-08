// AI Processing Utilities using Workers AI - Tri-Model Strategy
import type { Env, AIAnalysis, Threat } from '../types';
import { AI_MODELS, DEPLOYMENT_CONFIG } from '../constants';
import { logError } from './logger';
import { truncateText } from './text';
import { parseAIResponse, parseAITextResponse, validateAIResponse } from './ai-response-parser';
import { NeuronTracker } from './neuron-tracker';

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Main article analysis function - orchestrates tri-model strategy
 *
 * Deployment modes:
 * - baseline: Use Llama 70B only (original approach)
 * - shadow: Run tri-model + baseline, use baseline result (for validation)
 * - canary: Use tri-model for X% of articles, baseline for rest
 * - trimodel: Full tri-model deployment
 *
 * @param env - Cloudflare environment bindings
 * @param article - Threat article to analyze
 * @param tracker - Optional NeuronTracker instance for monitoring usage
 */
export async function analyzeArticle(
  env: Env,
  article: Threat,
  tracker?: NeuronTracker
): Promise<AIAnalysis | null> {
  try {
    const mode = DEPLOYMENT_CONFIG.MODE;

    // Shadow mode: Run both and compare
    if (mode === 'shadow') {
      const [baselineResult, trimodelResult] = await Promise.all([
        analyzeArticleBaseline(env, article, tracker),
        analyzeArticleTriModel(env, article, tracker),
      ]);

      // Log comparison for validation
      if (DEPLOYMENT_CONFIG.VALIDATION_LOGGING && baselineResult && trimodelResult) {
        logModelComparison(article.id, baselineResult, trimodelResult);
      }

      // Return baseline result (no user impact)
      return baselineResult;
    }

    // Canary mode: Randomly use tri-model based on percentage
    if (mode === 'canary') {
      const useTriModel = Math.random() * 100 < DEPLOYMENT_CONFIG.CANARY_PERCENT;
      if (useTriModel) {
        console.log(`[Canary] Using tri-model for ${article.id}`);
        return await analyzeArticleTriModel(env, article, tracker);
      } else {
        return await analyzeArticleBaseline(env, article, tracker);
      }
    }

    // Tri-model mode: Full deployment
    if (mode === 'trimodel') {
      return await analyzeArticleTriModel(env, article, tracker);
    }

    // Baseline mode (default fallback)
    return await analyzeArticleBaseline(env, article, tracker);
  } catch (error) {
    logError('Error in analyzeArticle orchestration', error, {
      threatId: article.id,
      title: article.title,
      source: article.source,
      contentLength: article.content?.length || 0,
      mode: DEPLOYMENT_CONFIG.MODE,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Track analysis failures in Analytics Engine
    try {
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          blobs: ['ai_analysis_failure', article.source, DEPLOYMENT_CONFIG.MODE],
          doubles: [1],
          indexes: [article.id],
        });
      }
    } catch (analyticsError) {
      // Ignore analytics errors to avoid cascading failures
      console.error('Failed to log analytics for AI failure:', analyticsError);
    }

    // Fallback to baseline on error
    return await analyzeArticleBaseline(env, article);
  }
}

/**
 * Baseline approach: Single Llama 70B model for all tasks
 * This is the original proven implementation
 */
async function analyzeArticleBaseline(
  env: Env,
  article: Threat,
  tracker?: NeuronTracker
): Promise<AIAnalysis | null> {
  try {
    const truncatedContent = truncateText(article.content, 12000);

    const BASELINE_PROMPT = `You are a cybersecurity analyst. Analyze threat intelligence articles and extract key information.

Output ONLY valid JSON in this exact format:
{
  "tldr": "One sentence summary of the threat",
  "key_points": ["point 1", "point 2", "point 3"],
  "category": "ransomware|apt|vulnerability|phishing|malware|data_breach|ddos|supply_chain|insider_threat|cloud_security|web_security|zero_day|cryptojacking|iot_security|disinformation|policy|other",
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

CATEGORY CLASSIFICATION RULES (choose the PRIMARY threat type):
- "zero_day": Zero-day vulnerabilities being actively exploited (CRITICAL - use this for 0-days)
- "ransomware": Encryption-based extortion, file/system lockers, ransom demands
- "apt": Nation-state attacks, targeted espionage campaigns, advanced persistent threats
- "phishing": Social engineering, credential theft, email scams, fake login pages, BEC attacks
- "malware": Trojans, viruses, worms, backdoors, loaders, droppers, stealers, RATs
- "data_breach": Data leaks, database exposures, stolen credentials, breached records
- "vulnerability": CVEs, exploits, patch information, PoC code (NOT zero-days - use "zero_day" for those)
- "web_security": Web app vulnerabilities (XSS, SQLi, RCE, CSRF, path traversal, file upload)
- "cloud_security": Cloud platform attacks (AWS, Azure, GCP, Kubernetes, container escapes)
- "cryptojacking": Cryptocurrency mining malware, unauthorized crypto mining
- "iot_security": IoT device attacks, embedded systems, smart home vulnerabilities
- "ddos": Denial of service attacks, botnet attacks, amplification attacks
- "supply_chain": Third-party compromises, software supply chain attacks, dependency hijacking
- "insider_threat": Malicious insiders, credential abuse, privilege misuse
- "disinformation": Fake news campaigns, influence operations, propaganda, election interference
- "policy": Legal/regulatory updates, compliance news, security standards (NOT threats)
- "other": ONLY for security tool announcements, conference news, or truly unclassifiable content

CLASSIFICATION EXAMPLES:
✓ "Zero-day in Chrome actively exploited by APT" → "zero_day" (NOT vulnerability)
✓ "WordPress RCE vulnerability with available patch" → "web_security"
✓ "Phishers abuse Cloudflare Pages for banking scams" → "phishing"
✓ "New Qakbot malware campaign targets healthcare" → "malware"
✓ "LockBit ransomware gang leaks victim data" → "ransomware"
✓ "China-linked APT group targets telecom sector" → "apt"
✓ "23andMe data breach exposes 6.9M users" → "data_breach"
✓ "Mirai botnet launches 2.5 Tbps DDoS attack" → "ddos"
✓ "Supply chain attack via compromised NPM package" → "supply_chain"
✓ "SQL injection flaw in enterprise CRM system" → "web_security"
✓ "AWS S3 bucket misconfiguration exposes data" → "cloud_security"
✓ "Cryptominer targets Kubernetes clusters" → "cryptojacking"
✓ "Smart TV firmware contains backdoor" → "iot_security"
✓ "Russian influence campaign targets US election" → "disinformation"
✓ "EU passes new data privacy regulation" → "policy"
✓ "New security conference announced in Dubai" → "other"
✓ "AI prompt injection attacks on ChatGPT" → "web_security" (prompt injection is web vuln)

SEVERITY GUIDELINES:
- critical: Active widespread exploitation, 0-day being exploited, major data breach, ransomware outbreak
- high: Serious vulnerabilities with PoC, targeted attacks, significant risk
- medium: Moderate risk, patches available, limited exploitation
- low: Minor issues, theoretical risks, low impact
- info: Informational updates, awareness, no immediate threat

If no IOCs found, use empty arrays. Use "other" category sparingly (<10% of cases).`;

    const userPrompt = `Title: ${article.title}\n\nContent: ${truncatedContent}\n\nSource: ${article.source}`;

    // Estimate token usage for tracking
    const inputTokens = estimateTokens(BASELINE_PROMPT + userPrompt);
    const maxOutputTokens = 1024;

    const response = await env.AI.run(
      AI_MODELS.TEXT_GENERATION_LARGE_FALLBACK,
      {
        messages: [
          { role: 'system', content: BASELINE_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: maxOutputTokens,
      },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
        },
      }
    );

    // Track neuron usage (llama-70b model)
    if (tracker) {
      // Use conservative estimate: assume full output token usage
      const neurons = tracker.track('llama-70b', inputTokens, maxOutputTokens);
      console.log(`[Baseline] Neurons used: ~${Math.round(neurons)} (70B model)`);
    }

    const analysis = parseAIResponse<AIAnalysis>(response);

    if (!analysis || !validateAIResponse(analysis, ['tldr', 'category', 'severity'])) {
      return null;
    }

    // Tag with model strategy for tracking
    analysis.model_strategy = 'baseline';

    return analysis;
  } catch (error) {
    logError('Error in baseline analysis', error, {
      threatId: article.id,
      title: article.title,
      source: article.source,
      contentLength: article.content?.length || 0,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      model: AI_MODELS.TEXT_GENERATION_LARGE_FALLBACK,
    });

    // Track baseline analysis failures
    try {
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          blobs: ['baseline_analysis_failure', article.source],
          doubles: [1],
          indexes: [article.id],
        });
      }
    } catch (analyticsError) {
      console.error('Failed to log analytics for baseline failure:', analyticsError);
    }

    return null;
  }
}

/**
 * Tri-model approach: Parallel execution of 1B (classification) + 30B (IOCs)
 * 81% neuron reduction vs baseline
 */
async function analyzeArticleTriModel(
  env: Env,
  article: Threat,
  tracker?: NeuronTracker
): Promise<AIAnalysis | null> {
  try {
    const truncatedContent = truncateText(article.content, 12000);

    // PARALLEL EXECUTION: Run both models simultaneously
    const [basicAnalysis, detailedAnalysis] = await Promise.all([
      extractBasicInfo(env, article, truncatedContent, tracker),    // 1B: ~11 neurons
      extractDetailedInfo(env, article, truncatedContent, tracker), // 30B: ~23 neurons
    ]);

    // Merge results (total: ~34 neurons + 0.5 for embeddings = 35 neurons)
    if (!basicAnalysis || !detailedAnalysis) {
      return null;
    }

    const mergedAnalysis: AIAnalysis = {
      ...basicAnalysis,
      ...detailedAnalysis,
      model_strategy: 'trimodel', // Tag with tri-model strategy for tracking
    } as AIAnalysis;

    return mergedAnalysis;
  } catch (error) {
    logError('Error in tri-model analysis', error, {
      threatId: article.id,
      title: article.title,
      source: article.source,
      contentLength: article.content?.length || 0,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Track tri-model analysis failures
    try {
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          blobs: ['trimodel_analysis_failure', article.source],
          doubles: [1],
          indexes: [article.id],
        });
      }
    } catch (analyticsError) {
      console.error('Failed to log analytics for tri-model failure:', analyticsError);
    }

    return null;
  }
}

/**
 * Basic Info Extraction using Llama 3.2 1B
 * Handles: classification, severity, TLDR, basic entity extraction
 * Cost: ~11 neurons per article
 */
async function extractBasicInfo(
  env: Env,
  article: Threat,
  content: string,
  tracker?: NeuronTracker
): Promise<Partial<AIAnalysis> | null> {
  try {
    const systemPrompt = 'You are a cybersecurity analyst performing threat classification. Output only valid JSON.';
    const prompt = `You are a cybersecurity analyst. Extract basic classification from this threat intelligence article.

Output ONLY valid JSON in this exact format:
{
  "tldr": "One concise sentence summarizing the threat",
  "category": "ransomware|apt|vulnerability|phishing|malware|data_breach|ddos|supply_chain|insider_threat|cloud_security|web_security|zero_day|cryptojacking|iot_security|disinformation|policy|other",
  "severity": "critical|high|medium|low|info",
  "affected_sectors": ["sector1", "sector2"],
  "threat_actors": ["actor1", "actor2"]
}

Classification Guidelines:
- category: Choose the PRIMARY threat type (17 categories available - use specific ones over generic)
  * "zero_day": 0-day exploits being actively exploited (CRITICAL - highest priority)
  * "web_security": XSS, SQLi, RCE, CSRF (web app vulns)
  * "cloud_security": AWS/Azure/GCP attacks, Kubernetes exploits
  * "vulnerability": Generic CVEs, patches (NOT 0-days or web-specific)
  * "cryptojacking": Crypto mining malware
  * "iot_security": IoT/embedded device attacks
  * "disinformation": Influence operations, fake news
  * "policy": Legal/regulatory updates (NOT threats)
  * "other": Security tools, conferences, unclassifiable (use sparingly)
- severity: critical (active exploitation, widespread impact), high (serious risk), medium (moderate concern), low (minor), info (informational)
- affected_sectors: Industries explicitly mentioned as targeted (e.g., "healthcare", "finance", "energy")
- threat_actors: Named groups or campaigns (e.g., "APT28", "Lazarus Group", "Conti")

Article:
Title: ${article.title}
Source: ${article.source}
Content: ${content}`;

    // Estimate token usage
    const inputTokens = estimateTokens(systemPrompt + prompt);
    const maxOutputTokens = 512;

    const response = await env.AI.run(
      AI_MODELS.TEXT_GENERATION_SMALL,
      {
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: maxOutputTokens,
      },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
        },
      }
    );

    // Track neuron usage (llama-1b model)
    if (tracker) {
      const neurons = tracker.track('llama-1b', inputTokens, maxOutputTokens);
      console.log(`[Tri-Model 1B] Neurons used: ~${Math.round(neurons)} (classification)`);
    }

    const analysis = parseAIResponse<Partial<AIAnalysis>>(response);

    if (!analysis || !validateAIResponse(analysis, ['tldr', 'category', 'severity'])) {
      return null;
    }

    return analysis;
  } catch (error) {
    logError('Error extracting basic info (1B model)', error, {
      threatId: article.id,
      title: article.title,
      source: article.source,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      model: AI_MODELS.TEXT_GENERATION_SMALL,
    });
    return null;
  }
}

/**
 * Detailed Info Extraction using Qwen3 30B
 * Handles: IOC extraction, strategic key points
 * Cost: ~23 neurons per article
 */
async function extractDetailedInfo(
  env: Env,
  article: Threat,
  content: string,
  tracker?: NeuronTracker
): Promise<Partial<AIAnalysis> | null> {
  try {
    const systemPrompt = 'You are a senior threat intelligence analyst specializing in IOC extraction and strategic analysis. Output only valid JSON.';
    const prompt = `You are a senior cybersecurity analyst. Extract detailed threat intelligence with precision.

Output ONLY valid JSON in this exact format:
{
  "key_points": [
    "First key strategic insight",
    "Second key strategic insight",
    "Third key strategic insight"
  ],
  "iocs": {
    "ips": ["1.2.3.4"],
    "domains": ["malicious.com"],
    "cves": ["CVE-2024-1234"],
    "hashes": ["abc123def456"],
    "urls": ["https://c2-server.com/payload"],
    "emails": ["attacker@evil.com"]
  }
}

Instructions:

1. KEY POINTS (3-5 strategic insights):
   - Focus on actionable intelligence
   - Highlight novel TTPs or campaigns
   - Identify critical risks or urgency
   - Avoid generic statements

2. IOCs (Indicators of Compromise):
   - Extract ALL mentioned IOCs with precision
   - IP addresses: Real infrastructure IPs only (not RFC1918 examples like 192.168.x.x unless explicitly stated as malicious)
   - Domains: C2 servers, malicious infrastructure (not just mentioned brands)
   - CVEs: Include all CVE identifiers (CRITICAL - these are high priority)
   - Hashes: MD5, SHA1, SHA256 file hashes
   - URLs: Full malicious URLs (not just domains)
   - Emails: Attacker email addresses

   If no IOCs of a type are found, use empty arrays.

Article:
Title: ${article.title}
Content: ${content}`;

    // Estimate token usage
    const inputTokens = estimateTokens(systemPrompt + prompt);
    const maxOutputTokens = 1024;

    const response = await env.AI.run(
      AI_MODELS.TEXT_GENERATION_LARGE,
      {
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // Low temperature for precise extraction
        max_tokens: maxOutputTokens,
      },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
        },
      }
    );

    // Track neuron usage (qwen-30b model)
    if (tracker) {
      const neurons = tracker.track('qwen-30b', inputTokens, maxOutputTokens);
      console.log(`[Tri-Model 30B] Neurons used: ~${Math.round(neurons)} (IOC extraction)`);
    }

    const analysis = parseAIResponse<Partial<AIAnalysis>>(response);

    if (!analysis || !analysis.iocs) {
      return null;
    }

    return analysis;
  } catch (error) {
    logError('Error extracting detailed info (30B model)', error, {
      threatId: article.id,
      title: article.title,
      source: article.source,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      model: AI_MODELS.TEXT_GENERATION_LARGE,
    });
    return null;
  }
}

/**
 * Log comparison between baseline and tri-model results
 * Used during shadow testing phase
 */
function logModelComparison(
  threatId: string,
  baseline: AIAnalysis,
  trimodel: AIAnalysis
): void {
  const comparison = {
    threatId,
    timestamp: new Date().toISOString(),
    categoryMatch: baseline.category === trimodel.category,
    severityMatch: baseline.severity === trimodel.severity,
    iocCounts: {
      baseline: {
        ips: baseline.iocs?.ips?.length || 0,
        domains: baseline.iocs?.domains?.length || 0,
        cves: baseline.iocs?.cves?.length || 0,
        hashes: baseline.iocs?.hashes?.length || 0,
      },
      trimodel: {
        ips: trimodel.iocs?.ips?.length || 0,
        domains: trimodel.iocs?.domains?.length || 0,
        cves: trimodel.iocs?.cves?.length || 0,
        hashes: trimodel.iocs?.hashes?.length || 0,
      },
    },
    keyPointsCount: {
      baseline: baseline.key_points?.length || 0,
      trimodel: trimodel.key_points?.length || 0,
    },
  };

  console.log('[Shadow Test Comparison]', JSON.stringify(comparison, null, 2));
}

/**
 * Generate embedding using BGE-M3
 * Cost: ~0.5 neurons per article (94% cheaper than BGE-Large)
 */
export async function generateEmbedding(
  env: Env,
  text: string,
  tracker?: NeuronTracker
): Promise<number[] | null> {
  try {
    // Truncate text for embedding model (max ~512 tokens)
    const truncatedText = truncateText(text, 2000);

    // Use tri-model embedding (BGE-M3) or fallback based on deployment mode
    const embeddingModel = DEPLOYMENT_CONFIG.MODE === 'baseline'
      ? AI_MODELS.EMBEDDINGS_FALLBACK
      : AI_MODELS.EMBEDDINGS;

    // Estimate token usage
    const inputTokens = estimateTokens(truncatedText);

    const response = await env.AI.run(
      embeddingModel,
      {
        text: truncatedText,
      },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
        },
      }
    );

    // Track neuron usage for embeddings
    if (tracker) {
      const modelKey = embeddingModel === AI_MODELS.EMBEDDINGS ? 'bge-m3' : 'bge-large';
      const neurons = tracker.track(modelKey, inputTokens, 0); // Embeddings have no output tokens
      console.log(`[Embedding] Neurons used: ~${Math.round(neurons)} (${modelKey})`);
    }

    if (response && 'data' in response && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0] as number[];
    }

    logError('Invalid embedding response', new Error('Unexpected format'), { response });
    return null;
  } catch (error) {
    logError('Error generating embedding', error, {
      textLength: text.length,
      model: DEPLOYMENT_CONFIG.MODE === 'baseline' ? 'BGE-Large' : 'BGE-M3',
    });
    return null;
  }
}

/**
 * Analyze trends using the large model (30B or 70B depending on deployment mode)
 * This requires strategic synthesis capability
 */
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

    // Use large model for trend analysis (requires strategic reasoning)
    const trendModel = DEPLOYMENT_CONFIG.MODE === 'baseline'
      ? AI_MODELS.TEXT_GENERATION_LARGE_FALLBACK
      : AI_MODELS.TEXT_GENERATION_LARGE;

    const response = await env.AI.run(
      trendModel,
      {
        messages: [
          {
            role: 'system',
            content: 'You are a senior cybersecurity analyst. Provide strategic threat intelligence analysis.',
          },
          { role: 'user', content: trendPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
        },
      }
    );

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
