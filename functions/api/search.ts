// API: Search threats (keyword + semantic)
import type { Env } from '../types';
import { semanticSearch } from '../utils/ai-processor';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const mode = url.searchParams.get('mode') || 'keyword'; // keyword or semantic
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  if (!query) {
    return Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    let threatIds: string[] = [];

    if (mode === 'semantic') {
      // Semantic search using embeddings
      const results = await semanticSearch(env, query, limit);
      threatIds = results.map((r) => r.id);

      if (threatIds.length === 0) {
        return Response.json({ threats: [], count: 0, mode: 'semantic' });
      }
    }

    // Build SQL query
    let sqlQuery = '';
    let params: any[] = [];

    if (mode === 'semantic' && threatIds.length > 0) {
      // Fetch threats by IDs from semantic search
      const placeholders = threatIds.map(() => '?').join(',');
      sqlQuery = `
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
        WHERE t.id IN (${placeholders})
        ORDER BY t.published_at DESC
      `;
      params = threatIds;
    } else {
      // Keyword search
      const searchTerm = `%${query}%`;
      sqlQuery = `
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
        WHERE t.title LIKE ? OR t.content LIKE ? OR s.tldr LIKE ?
        ORDER BY t.published_at DESC
        LIMIT ?
      `;
      params = [searchTerm, searchTerm, searchTerm, limit];
    }

    const result = await env.DB.prepare(sqlQuery).bind(...params).all();

    // Parse JSON fields
    const threats = result.results.map((row: any) => ({
      ...row,
      key_points: row.key_points ? JSON.parse(row.key_points) : [],
      affected_sectors: row.affected_sectors ? JSON.parse(row.affected_sectors) : [],
      threat_actors: row.threat_actors ? JSON.parse(row.threat_actors) : [],
    }));

    // Log search for analytics
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO search_history (query, result_count, searched_at) VALUES (?, ?, ?)')
      .bind(query, threats.length, now)
      .run();

    return Response.json({
      threats,
      count: threats.length,
      mode,
      query,
    });
  } catch (error) {
    console.error('Error searching threats:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
};
