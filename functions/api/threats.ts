// API: Get threats with filtering and pagination
import type { Env, ThreatWithSummary } from '../types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);

  // Security: Validate and cap pagination parameters
  const requestedPage = parseInt(url.searchParams.get('page') || '1');
  const page = Math.max(requestedPage, 1); // Min page 1

  const requestedLimit = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(requestedLimit, 1), 50); // Min 1, Max 50

  const category = url.searchParams.get('category');
  const severity = url.searchParams.get('severity');
  const source = url.searchParams.get('source');
  const offset = (page - 1) * limit;

  try {
    // Build query with filters
    let query = `
      SELECT
        t.*,
        s.tldr,
        s.key_points,
        s.category,
        s.severity,
        s.affected_sectors,
        s.threat_actors
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (category) {
      query += ' AND s.category = ?';
      params.push(category);
    }

    if (severity) {
      query += ' AND s.severity = ?';
      params.push(severity);
    }

    if (source) {
      query += ' AND t.source = ?';
      params.push(source);
    }

    query += ' ORDER BY t.published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const result = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM threats t LEFT JOIN summaries s ON t.id = s.threat_id WHERE 1=1';
    const countParams: any[] = [];

    if (category) {
      countQuery += ' AND s.category = ?';
      countParams.push(category);
    }

    if (severity) {
      countQuery += ' AND s.severity = ?';
      countParams.push(severity);
    }

    if (source) {
      countQuery += ' AND t.source = ?';
      countParams.push(source);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Parse JSON fields
    const threats = result.results.map((row: any) => ({
      ...row,
      key_points: row.key_points ? JSON.parse(row.key_points) : [],
      affected_sectors: row.affected_sectors ? JSON.parse(row.affected_sectors) : [],
      threat_actors: row.threat_actors ? JSON.parse(row.threat_actors) : [],
    }));

    return Response.json({
      threats,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching threats:', error);
    return Response.json({ error: 'Failed to fetch threats' }, { status: 500 });
  }
};
