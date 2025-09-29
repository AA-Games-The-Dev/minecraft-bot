#!/usr/bin/env node
/*
 * Ingestão de dados para o bot RAG. Este script lê o dataset de FAQ
 * (`data/recipes.json`) e documentos auxiliares em `data/docs`, gera
 * embeddings usando um modelo open‑source e salva um índice vetorial
 * pronto para consultas de similaridade coseno.
 */

const fs = require('fs');
const path = require('path');
const { loadEmbedder, embedText } = require('../services/embeddings');
const config = require('../config');

const dataPath = path.join(__dirname, '..', 'data', 'recipes.json');
const indexPath = path.join(__dirname, '..', 'data', 'index.json');
const docsDir = path.join(__dirname, '..', 'data', 'docs');

function chunkDocument(text, { maxChars = 600 } = {}) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else if (candidate.length > maxChars) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceBlock = '';
      for (const sentence of sentences) {
        const sentenceCandidate = sentenceBlock ? `${sentenceBlock} ${sentence}` : sentence;
        if (sentenceCandidate.length > maxChars && sentenceBlock) {
          chunks.push(sentenceBlock.trim());
          sentenceBlock = sentence;
        } else {
          sentenceBlock = sentenceCandidate;
        }
      }
      if (sentenceBlock) chunks.push(sentenceBlock.trim());
      current = '';
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function buildFaqEntries(dataset, embedder) {
  const entries = [];
  for (const item of dataset) {
    const combined = [
      ...(item.pergunta || []),
      item.resposta_ref || ''
    ].join(' ');
    const embedding = await embedText(combined, { embedder });
    entries.push({
      id: `faq:${item.id}`,
      source_id: item.id,
      type: 'faq',
      text: item.resposta_ref,
      embedding,
      resposta_ref: item.resposta_ref,
      metadata: {
        perguntas: item.pergunta,
        fontes: item.fontes,
        trechos: item.trechos
      }
    });
  }
  return entries;
}

async function buildDocEntries(embedder) {
  if (!fs.existsSync(docsDir)) return [];
  const files = fs.readdirSync(docsDir).filter((file) => file.endsWith('.md') || file.endsWith('.txt'));
  const entries = [];
  for (const file of files) {
    const fullPath = path.join(docsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const chunks = chunkDocument(content);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue;
      const embedding = await embedText(chunk, { embedder });
      entries.push({
        id: `doc:${file}#${i}`,
        source_id: `${file}#${i}`,
        type: 'doc',
        text: chunk,
        embedding,
        metadata: {
          source: file,
          chunk: i
        }
      });
    }
  }
  return entries;
}

async function main() {
  const embedder = await loadEmbedder(config.embeddings?.model);
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const faqEntries = await buildFaqEntries(dataset, embedder);
  const docEntries = await buildDocEntries(embedder);
  const index = [...faqEntries, ...docEntries];
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`Índice salvo em ${indexPath}. ${index.length} documentos processados (${faqEntries.length} FAQ, ${docEntries.length} docs).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Falha ao gerar índice:', error);
    process.exit(1);
  });
}
