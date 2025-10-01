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

const STOPWORDS = new Set([
  'a',
  'o',
  'os',
  'as',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'para',
  'pra',
  'com',
  'em',
  'um',
  'uma',
  'uns',
  'umas',
  'e',
  'no',
  'na',
  'nos',
  'nas',
  'que',
  'se',
  'ao',
  'aos',
  'à',
  'às',
  'por',
  'sobre',
  'mais',
  'como',
  'quando',
  'onde',
  'qual',
  'quais',
  'porque',
  'pois',
  'já',
  'ser',
  'sua',
  'seu',
  'suas',
  'seus'
]);

function normaliseText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(text) {
  if (!text) return [];
  return normaliseText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function collectMetadataText(metadata = {}) {
  const parts = [];
  if (Array.isArray(metadata.perguntas)) parts.push(...metadata.perguntas);
  if (Array.isArray(metadata.fontes)) parts.push(...metadata.fontes);
  if (Array.isArray(metadata.aliases)) parts.push(...metadata.aliases);
  if (Array.isArray(metadata.tags)) parts.push(...metadata.tags);
  if (Array.isArray(metadata.trechos)) {
    for (const trecho of metadata.trechos) {
      if (!trecho) continue;
      const values = [];
      if (trecho.doc) values.push(trecho.doc);
      if (trecho.secao) values.push(trecho.secao);
      if (trecho.descricao) values.push(trecho.descricao);
      if (values.length) parts.push(values.join(' '));
    }
  }
  return parts.join(' ');
}

function buildLexicalTokens(doc) {
  const chunks = [];
  if (doc.text) chunks.push(doc.text);
  if (doc.resposta_ref) chunks.push(doc.resposta_ref);
  if (doc.metadata) chunks.push(collectMetadataText(doc.metadata));
  const tokens = tokenize(chunks.join(' '));
  return new Set(tokens);
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
    embedding: Float32Array.from(doc.embedding),
    lexicalTokens: buildLexicalTokens(doc)
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
  const queryTokens = tokenize(query);
  const lexicalWeight =
    typeof config.embeddings?.lexicalWeight === 'number' ? config.embeddings.lexicalWeight : 0.35;

  const scored = docs
    .map((doc) => {
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      const lexicalScore =
        queryTokens.length && doc.lexicalTokens?.size
          ? queryTokens.filter((token) => doc.lexicalTokens.has(token)).length / queryTokens.length
          : 0;
      return {
        id: doc.id,
        sourceId: doc.source_id,
        type: doc.type,
        similarity,
        lexicalScore,
        score: similarity + lexicalWeight * lexicalScore,
        text: doc.text || doc.resposta_ref,
        resposta_ref: doc.resposta_ref || null,
        metadata: doc.metadata || {}
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k);
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
