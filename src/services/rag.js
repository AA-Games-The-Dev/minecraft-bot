/*
 * Módulo de recuperação baseado em embeddings para o bot Minecraft.
 * O índice é gerado pelo script `scripts/ingest.js`, que extrai
 * embeddings de sentenças usando modelos open‑source do pacote
 * `@xenova/transformers` e salva vetores normalizados em
 * `data/index.json`. Cada entrada pode representar tanto exemplos de
 * perguntas/respostas (FAQ) quanto trechos de documentos externos.
 *
 * Dada uma consulta do jogador, este módulo embebe a pergunta no mesmo
 * espaço vetorial e calcula similaridade coseno com todos os vetores.
 * Os documentos são ordenados pelo score e retornados em ordem
 * decrescente. A função `retrieveAnswer` prioriza respostas
 * parametrizadas do FAQ quando a similaridade ultrapassa um limiar,
 * enquanto `retrieveTopK` retorna os trechos mais relevantes para uso
 * em prompts de LLM ou para inspeção manual.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { loadEmbedder, embedText } = require('./embeddings');

function normaliseToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value].filter(Boolean);
  return [];
}

let faqDatasetCache = null;

function loadFaqDataset() {
  if (faqDatasetCache) return faqDatasetCache;
  const datasetPath = path.join(__dirname, '..', 'data', 'recipes.json');
  if (!fs.existsSync(datasetPath)) {
    faqDatasetCache = new Map();
    return faqDatasetCache;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    faqDatasetCache = new Map(
      raw.map((item) => [
        item.id,
        {
          questions: [...normaliseToArray(item.pergunta), ...normaliseToArray(item.question)],
          answer: item.resposta_ref || item.answer_ref || '',
          fontes: item.fontes || item.sources,
          trechos: item.trechos || item.snippets
        }
      ])
    );
  } catch (error) {
    console.warn('Não foi possível carregar recipes.json para metadados FAQ:', error.message || error);
    faqDatasetCache = new Map();
  }
  return faqDatasetCache;
}

let indexCache = null;

function loadIndex() {
  if (indexCache) return indexCache;
  const indexPath = path.join(__dirname, '..', 'data', 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Índice não encontrado. Execute `npm run ingest` para gerar o arquivo index.json.');
  }
  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  indexCache = raw.map((doc) => ({
    ...doc,
    embedding: Float32Array.from(doc.embedding)
  }));
  return indexCache;
}

function cosineSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function embedQuery(text) {
  const embedder = await loadEmbedder(config.embeddings?.model);
  const vector = await embedText(text, { embedder });
  return Float32Array.from(vector);
}

async function retrieveTopK(query, k = 3) {
  if (!query) return [];
  const docs = loadIndex();
  if (docs.length === 0) return [];

  const queryEmbedding = await embedQuery(query);
  const faqDataset = loadFaqDataset();
  const scored = docs
    .map((doc) => ({
      id: doc.id,
      sourceId: doc.source_id,
      type: doc.type,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      text: doc.text,
      resposta_ref: doc.resposta_ref || null,
      metadata: doc.metadata || {}
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((doc) => {
    if (doc.type !== 'faq') return doc;

    const datasetEntry = faqDataset.get(doc.sourceId?.replace(/^faq:/, '') || doc.sourceId || doc.id?.replace(/^faq:/, ''));
    if (!datasetEntry) return doc;

    const metadata = { ...doc.metadata };
    const perguntasMetadata = normaliseToArray(metadata.perguntas);
    if (perguntasMetadata.length === 0 && datasetEntry.questions?.length) {
      metadata.perguntas = datasetEntry.questions;
    } else if (perguntasMetadata.length > 0) {
      metadata.perguntas = perguntasMetadata;
    }
    if (!metadata.fontes && datasetEntry.fontes) {
      metadata.fontes = datasetEntry.fontes;
    }
    if (!metadata.trechos && datasetEntry.trechos) {
      metadata.trechos = datasetEntry.trechos;
    }

    return {
      ...doc,
      text: doc.text || datasetEntry.answer,
      resposta_ref: doc.resposta_ref || datasetEntry.answer || null,
      metadata
    };
  });
}

async function retrieveAnswer(query, options = {}) {
  const { minScore = 0.45, k = 5 } = options;
  const top = await retrieveTopK(query, k);
  const candidate = top.find((doc) => doc.type === 'faq' && doc.resposta_ref && doc.score >= minScore);
  if (!candidate) return null;
  return {
    text: candidate.resposta_ref,
    score: candidate.score,
    sourceId: candidate.sourceId,
    metadata: candidate.metadata
  };
}

async function buildContextSnippet(query, { k = 3 } = {}) {
  const top = await retrieveTopK(query, k);
  return top.map((doc, index) => ({
    rank: index + 1,
    score: doc.score,
    type: doc.type,
    sourceId: doc.sourceId,
    text: doc.text
  }));
}

module.exports = {
  retrieveTopK,
  retrieveAnswer,
  buildContextSnippet
};
