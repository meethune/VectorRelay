// API: Get single threat details with IOCs
import type { Env } from '../../types';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const threatId = params.id as string;

  if (!threatId) {
    return Response.json({ error: 'Threat ID is required' }, { status: 400 });
  }

  try {
    // Get threat with summary
    const threat = await env.DB.prepare(
      `SELECT
        t.*,
        s.tldr,
        s.key_points,
        s.category,
        s.severity,
        s.affected_sectors,
        s.threat_actors,
        s.confidence_score
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE t.id = ?`
    )
      .bind(threatId)
      .first();

    if (!threat) {
      return Response.json({ error: 'Threat not found' }, { status: 404 });
    }

    // Get IOCs
    const iocsResult = await env.DB.prepare('SELECT * FROM iocs WHERE threat_id = ?').bind(threatId).all();

    // Parse JSON fields
    const threatData: any = {
      ...threat,
      key_points: threat.key_points ? JSON.parse(threat.key_points as string) : [],
      affected_sectors: threat.affected_sectors ? JSON.parse(threat.affected_sectors as string) : [],
      threat_actors: threat.threat_actors ? JSON.parse(threat.threat_actors as string) : [],
      iocs: iocsResult.results,
    };

    // Find similar threats using vectorize
    try {
      const embeddingText = `${threat.title} ${threat.tldr}`;
      const embedding = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
        text: embeddingText,
      });

      if (embedding && 'data' in embedding && Array.isArray(embedding.data)) {
        const similar = await env.VECTORIZE_INDEX.query(embedding.data[0], {
          topK: 6, // Get 6 to exclude self
          returnMetadata: true,
        });

        // Filter out the current threat and limit to 5
        threatData.similar_threats = similar.matches
          .filter((m) => m.id !== threatId)
          .slice(0, 5)
          .map((m) => ({
            id: m.id,
            score: m.score,
            ...m.metadata,
          }));
      }
    } catch (error) {
      console.error('Error finding similar threats:', error);
      threatData.similar_threats = [];
    }

    return Response.json(threatData);
  } catch (error) {
    console.error('Error fetching threat:', error);
    return Response.json({ error: 'Failed to fetch threat details' }, { status: 500 });
  }
};
