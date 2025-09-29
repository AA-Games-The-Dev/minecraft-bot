/*
 * Módulo de recuperação para o bot Minecraft. Esta implementação
 * carrega um índice construído a partir do dataset em `data/recipes.json`.
 * Cada documento do índice contém um conjunto de tokens que
 * representam as perguntas e a resposta de referência associada.
 * Dado uma pergunta do jogador, calculamos a similaridade Jaccard
 * entre os tokens da pergunta e os tokens de cada documento. Os
 * documentos são então ordenados em ordem decrescente de
 * similaridade. A função `retrieveTopK` retorna os k documentos
 * mais relevantes, enquanto `retrieveAnswer` retorna somente a
 * resposta de referência do documento mais relevante ou null se
 * nenhum documento obtiver correspondência significativa.
 *
 * Este módulo é planejado para servir como substituto de uma
 * recuperação baseada em embeddings. Quando recursos como
 * ChromaDB ou Faiss estiverem disponíveis, basta alterar a
 * implementação de `retrieveTopK` para consultar esses bancos de
 * vetores.
 */

const fs = require('fs');
const path = require('path');

// Carrega o índice e o dataset apenas uma vez ao iniciar.
let index = null;
function loadIndex() {
  if (index) return index;
  const indexPath = path.join(__dirname, '..', 'data', 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Índice não encontrado. Execute `npm run ingest` para gerar o arquivo index.json.');
  }
  index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return index;
}

// Tokenização semelhante à usada no script de ingestão
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Similaridade Jaccard entre dois conjuntos de tokens
function jaccard(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Recupera os k documentos mais semelhantes ao texto de consulta.
 * @param {string} query Pergunta enviada pelo jogador.
 * @param {number} k Quantidade de documentos a retornar.
 * @returns {Array<{id: string, score: number, resposta_ref: string}>}
 */
function retrieveTopK(query, k = 3) {
  if (!query) return [];
  const qTokens = tokenize(query);
  const docs = loadIndex();
  const scored = docs
    .map((doc) => {
      const score = jaccard(qTokens, doc.tokens);
      return { id: doc.id, score, resposta_ref: doc.resposta_ref };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Recupera a resposta mais provável para a pergunta fornecida. Caso
 * o score máximo seja 0 (nenhuma sobreposição de tokens), retorna
 * null para permitir que a lógica superior recorra a outras ações
 * (por exemplo, perguntar a um LLM).
 * @param {string} query Pergunta enviada pelo jogador.
 * @returns {string|null} A resposta de referência se houver uma correspondência, caso contrário null.
 */
function retrieveAnswer(query) {
  const top = retrieveTopK(query, 1)[0];
  if (!top || top.score === 0) return null;
  return top.resposta_ref;
}

module.exports = {
  retrieveTopK,
  retrieveAnswer
};