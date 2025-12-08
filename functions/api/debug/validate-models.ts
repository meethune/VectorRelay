/**
 * Model Validation API Endpoint
 *
 * Runs validation tests on tri-model configuration
 * Only accessible in development environment with API key
 *
 * Usage:
 *   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/validate-models?test=classification
 *   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/validate-models?test=ioc-extraction
 *   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/validate-models?test=all
 */

import type { Env, Threat } from '../../types';
import { analyzeArticle } from '../../utils/ai-processor';
import { createErrorResponse, createJsonResponse } from '../../utils/response-helper';
import { validateApiKey, unauthorizedResponse } from '../../utils/auth';

interface GroundTruthTest {
  article: Threat;
  expected: {
    category: string;
    severity: string;
    hasIOCs: boolean;
    minKeyPoints: number;
  };
}

// Sample test cases for validation
const TEST_CASES: GroundTruthTest[] = [
  {
    article: {
      id: 'validation-test-1',
      title: 'Critical Log4Shell Vulnerability CVE-2021-44228 Actively Exploited in Healthcare',
      content: `Security researchers have confirmed active exploitation of the Log4Shell vulnerability (CVE-2021-44228) targeting healthcare organizations. Attackers are using command and control infrastructure at IP address 203.0.113.5 and domain evil-c2.com. The malicious payload has been identified with SHA256 hash abc123def456789012345678901234567890123456789012345678901234. Organizations must patch immediately as this represents a critical threat to patient data and hospital operations.`,
      source: 'Test Data',
      url: 'https://test.example.com/1',
      published_at: Math.floor(Date.now() / 1000),
      fetched_at: Math.floor(Date.now() / 1000),
      raw_data: '{}',
    },
    expected: {
      category: 'vulnerability',
      severity: 'critical',
      hasIOCs: true,
      minKeyPoints: 3,
    },
  },
  {
    article: {
      id: 'validation-test-2',
      title: 'APT28 Conducts Spearphishing Campaign Against European Government',
      content: `The Russia-linked APT28 threat group has launched a sophisticated spearphishing campaign targeting European government agencies. The attackers are using emails from malicious@apt28-server.ru to deliver malware. No CVEs are being exploited - this is social engineering. The campaign is considered high severity due to the sensitive nature of the targets.`,
      source: 'Test Data',
      url: 'https://test.example.com/2',
      published_at: Math.floor(Date.now() / 1000),
      fetched_at: Math.floor(Date.now() / 1000),
      raw_data: '{}',
    },
    expected: {
      category: 'apt',
      severity: 'high',
      hasIOCs: true,
      minKeyPoints: 2,
    },
  },
  {
    article: {
      id: 'validation-test-3',
      title: 'General Security Best Practices for Remote Work',
      content: `This article discusses general security best practices for remote workers, including using VPNs, enabling multi-factor authentication, and keeping software updated. No specific threats or vulnerabilities are discussed. This is educational content for security awareness.`,
      source: 'Test Data',
      url: 'https://test.example.com/3',
      published_at: Math.floor(Date.now() / 1000),
      fetched_at: Math.floor(Date.now() / 1000),
      raw_data: '{}',
    },
    expected: {
      category: 'other',
      severity: 'info',
      hasIOCs: false,
      minKeyPoints: 2,
    },
  },
];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Security: Disable validation endpoint in production
  if (env.ENVIRONMENT === 'production') {
    return Response.json({
      error: 'Endpoint disabled',
      message: 'Model validation endpoint is disabled in production.'
    }, { status: 403 });
  }

  // In development, require API key
  if (!validateApiKey(request, env)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const testType = url.searchParams.get('test') || 'all';

  console.log(`Running validation test: ${testType}`);

  try {
    let results: any = {};

    if (testType === 'classification' || testType === 'all') {
      results.classification = await testClassificationAccuracy(env);
    }

    if (testType === 'ioc-extraction' || testType === 'all') {
      results.iocExtraction = await testIOCExtraction(env);
    }

    if (testType === 'all') {
      results.summary = generateSummary(results);
    }

    return createJsonResponse(results);
  } catch (error) {
    console.error('Validation error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Validation failed',
      500
    );
  }
};

/**
 * Test classification accuracy (category and severity)
 */
async function testClassificationAccuracy(env: Env): Promise<any> {
  let categoryCorrect = 0;
  let severityCorrect = 0;
  const total = TEST_CASES.length;
  const details: any[] = [];

  for (const test of TEST_CASES) {
    const analysis = await analyzeArticle(env, test.article);

    if (analysis) {
      const categoryMatch = analysis.category === test.expected.category;
      const severityMatch = analysis.severity === test.expected.severity;

      if (categoryMatch) categoryCorrect++;
      if (severityMatch) severityCorrect++;

      details.push({
        articleId: test.article.id,
        title: test.article.title,
        categoryMatch,
        severityMatch,
        expected: {
          category: test.expected.category,
          severity: test.expected.severity,
        },
        actual: {
          category: analysis.category,
          severity: analysis.severity,
        },
      });
    }
  }

  const categoryAccuracy = (categoryCorrect / total) * 100;
  const severityAccuracy = (severityCorrect / total) * 100;
  const overallAccuracy = (categoryAccuracy + severityAccuracy) / 2;

  return {
    categoryAccuracy: `${categoryAccuracy.toFixed(1)}%`,
    severityAccuracy: `${severityAccuracy.toFixed(1)}%`,
    overallAccuracy: `${overallAccuracy.toFixed(1)}%`,
    categoryThreshold: '85%',
    severityThreshold: '80%',
    passed: categoryAccuracy >= 85 && severityAccuracy >= 80,
    details,
  };
}

/**
 * Test IOC extraction accuracy
 */
async function testIOCExtraction(env: Env): Promise<any> {
  let hasIOCsCorrect = 0;
  let totalIOCsFound = 0;
  const total = TEST_CASES.length;
  const details: any[] = [];

  for (const test of TEST_CASES) {
    const analysis = await analyzeArticle(env, test.article);

    if (analysis) {
      const hasAnyIOC =
        (analysis.iocs?.ips?.length || 0) > 0 ||
        (analysis.iocs?.domains?.length || 0) > 0 ||
        (analysis.iocs?.cves?.length || 0) > 0 ||
        (analysis.iocs?.hashes?.length || 0) > 0 ||
        (analysis.iocs?.urls?.length || 0) > 0 ||
        (analysis.iocs?.emails?.length || 0) > 0;

      const hasIOCsMatch = hasAnyIOC === test.expected.hasIOCs;

      if (hasIOCsMatch) hasIOCsCorrect++;

      const iocCount =
        (analysis.iocs?.ips?.length || 0) +
        (analysis.iocs?.domains?.length || 0) +
        (analysis.iocs?.cves?.length || 0) +
        (analysis.iocs?.hashes?.length || 0) +
        (analysis.iocs?.urls?.length || 0) +
        (analysis.iocs?.emails?.length || 0);

      totalIOCsFound += iocCount;

      details.push({
        articleId: test.article.id,
        title: test.article.title,
        hasIOCsMatch,
        expectedHasIOCs: test.expected.hasIOCs,
        actualHasIOCs: hasAnyIOC,
        iocCounts: {
          ips: analysis.iocs?.ips?.length || 0,
          domains: analysis.iocs?.domains?.length || 0,
          cves: analysis.iocs?.cves?.length || 0,
          hashes: analysis.iocs?.hashes?.length || 0,
          urls: analysis.iocs?.urls?.length || 0,
          emails: analysis.iocs?.emails?.length || 0,
        },
        totalIOCs: iocCount,
      });
    }
  }

  const accuracy = (hasIOCsCorrect / total) * 100;

  return {
    accuracy: `${accuracy.toFixed(1)}%`,
    threshold: '85%',
    passed: accuracy >= 85,
    totalIOCsFound,
    averageIOCsPerArticle: (totalIOCsFound / total).toFixed(1),
    details,
  };
}

/**
 * Generate summary of all tests
 */
function generateSummary(results: any): any {
  const allTests = [];

  if (results.classification) {
    allTests.push({
      test: 'Classification Accuracy',
      passed: results.classification.passed,
      score: results.classification.overallAccuracy,
    });
  }

  if (results.iocExtraction) {
    allTests.push({
      test: 'IOC Extraction',
      passed: results.iocExtraction.passed,
      score: results.iocExtraction.accuracy,
    });
  }

  const allPassed = allTests.every((t) => t.passed);

  return {
    totalTests: allTests.length,
    passed: allTests.filter((t) => t.passed).length,
    failed: allTests.filter((t) => !t.passed).length,
    allPassed,
    recommendation: allPassed
      ? 'Tri-model strategy is ready for canary deployment'
      : 'Some tests failed - review details and consider using fallback models',
    tests: allTests,
  };
}
