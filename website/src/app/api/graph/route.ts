import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'stocknetwork123'
  )
);

export async function GET() {
  const session = driver.session();
  try {
    const nodeQuery = `MATCH (n) RETURN id(n) AS id, labels(n)[0] AS label, properties(n) AS p`;
    const edgeQuery = `MATCH (a)-[r]->(b) RETURN id(a) AS source, id(b) AS target, type(r) AS t, properties(r) AS p`;

    const nodeResult = await session.run(nodeQuery);
    const edgeResult = await session.run(edgeQuery);

    const nodes = nodeResult.records.map(record => ({
      data: {
        id: record.get('id').toNumber().toString(),
        label: record.get('label'),
        ...record.get('p')
      }
    }));

    const edges = edgeResult.records.map(record => ({
      data: {
        source: record.get('source').toNumber().toString(),
        target: record.get('target').toNumber().toString(),
        label: record.get('t'),
        ...record.get('p')
      }
    }));

    return NextResponse.json({ elements: [...nodes, ...edges] });
  } catch (error) {
    console.error('Neo4j fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  } finally {
    await session.close();
  }
}
