import { extractFacts, ExtractedFact } from './ai.js';
import { factDb, memoryDb } from '../db/index.js';
import { writeFactsToVault } from './fact-writer.js';

export async function runFactExtraction(): Promise<ExtractedFact[]> {
  const memories = memoryDb.all();

  if (memories.length < 2) {
    console.log('[FactExtractor] Not enough memories to extract facts (need at least 2)');
    return [];
  }

  const records = memories.map((m) => ({
    id: m.id,
    content: m.raw_content,
    summary: m.summary || undefined,
  }));

  const extractedFacts = await extractFacts(records);

  let newCount = 0;
  for (const fact of extractedFacts) {
    const rawSources = fact.sources as string | string[] | undefined;
    const sources: string[] = Array.isArray(rawSources) 
      ? rawSources 
      : typeof rawSources === 'string' 
        ? rawSources.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [];

    const existing = factDb.all().find(
      (f) => f.entity === fact.entity && f.attribute === fact.attribute && f.value === fact.value
    );

    if (existing) {
      factDb.update(existing.id, {
        confidence: fact.confidence,
        source_count: sources.length,
        sources_json: JSON.stringify(sources),
        updated_at: new Date().toISOString(),
      });
    } else {
      const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      factDb.insert({
        id,
        entity: fact.entity,
        attribute: fact.attribute,
        value: fact.value,
        confidence: fact.confidence,
        source_count: sources.length,
        sources_json: JSON.stringify(sources),
        created_at: now,
        updated_at: now,
      });
      newCount++;
    }
  }

  console.log(`[FactExtractor] Extracted ${extractedFacts.length} facts (${newCount} new, ${extractedFacts.length - newCount} updated)`);
  
  writeFactsToVault();
  
  return extractedFacts;
}

export function getFactsByEntity(entity: string) {
  const facts = factDb.getByEntity(entity);
  return facts.map((f) => ({
    id: f.id,
    entity: f.entity,
    attribute: f.attribute,
    value: f.value,
    confidence: f.confidence,
    source_count: f.source_count,
    sources: f.sources_json ? JSON.parse(f.sources_json) : [],
    created_at: f.created_at,
    updated_at: f.updated_at,
  }));
}

export function getAllFacts() {
  const facts = factDb.all();
  return facts.map((f) => ({
    id: f.id,
    entity: f.entity,
    attribute: f.attribute,
    value: f.value,
    confidence: f.confidence,
    source_count: f.source_count,
    sources: f.sources_json ? JSON.parse(f.sources_json) : [],
    created_at: f.created_at,
    updated_at: f.updated_at,
  }));
}
