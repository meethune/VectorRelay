// Test AI processing for a single threat
import type { Env, Threat } from '../types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    // Get one threat without a summary
    const threatResult = await env.DB.prepare(`
      SELECT t.*
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE s.id IS NULL
      LIMIT 1
    `).first<Threat>();

    if (!threatResult) {
      return Response.json({ error: 'No threats without summaries found' }, { status: 404 });
    }

    const threat = threatResult;

    // Test AI analysis
    const maxContentLength = 12000;
    const truncatedContent =
      threat.content.length > maxContentLength
        ? threat.content.substring(0, maxContentLength) + '...'
        : threat.content;

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

    const userPrompt = `Title: ${threat.title}\n\nContent: ${truncatedContent}\n\nSource: ${threat.source}`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    return Response.json({
      threat: {
        id: threat.id,
        title: threat.title,
        content_length: threat.content.length,
        truncated_length: truncatedContent.length
      },
      ai_response: aiResponse,
      raw_response_type: typeof aiResponse
    }, { status: 200 });

  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
};
