#!/usr/bin/env node
/*
 * Script de avaliação do pipeline de recuperação. Este utilitário
 * mede métricas simples de precisão e recall para o componente
 * retrieveAnswer. Para cada pergunta no dataset, usa apenas a
 * primeira pergunta registrada, invoca o algoritmo de recuperação e
 * calcula se a resposta correta está nas top‑k posições. Também
 * calcula uma métrica de “groundedness” baseada na proporção de
 * tokens da pergunta presentes no documento recuperado.
 *
 * Uso:
 *   node scripts/eval.js
 * O resultado será impresso no console e salvo em
 * `eval/results.json` com as métricas agregadas.
 */

const fs = require('fs');
const path = require('path');
const { retrieveTopK } = require('../services/rag');

// Leitura do dataset original
const dataPath = path.join(__dirname, '..', 'data', 'recipes.json');
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Função para calcular groundedness: proporção de tokens da
// pergunta que aparecem no conjunto de tokens do documento.
function groundedness(query, docTokens) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  let match = 0;
  const docSet = new Set(docTokens);
  for (const t of tokens) {
    if (docSet.has(t)) match++;
  }
  return match / tokens.length;
}

function main() {
  const results = [];
  let precisionAt1 = 0;
  let precisionAt3 = 0;
  let recallAt1 = 0;
  let recallAt3 = 0;
  let groundedSum = 0;

  for (const item of dataset) {
    const query = item.pergunta[0];
    const top3 = retrieveTopK(query, 3);
    const top1 = top3[0];
    const relevantId = item.id;
    // Precision@1: 1 se a primeira resposta retornada é correta
    if (top1 && top1.id === relevantId && top1.score > 0) precisionAt1++;
    // Precision@3: 1 se qualquer documento correto aparece entre os 3 primeiros
    if (top3.find((doc) => doc.id === relevantId && doc.score > 0)) precisionAt3++;
    // Recall@1 e Recall@3 são idênticos neste contexto, pois há apenas uma
    // resposta correta por consulta
    if (top1 && top1.id === relevantId && top1.score > 0) recallAt1++;
    if (top3.find((doc) => doc.id === relevantId && doc.score > 0)) recallAt3++;
    // Groundedness: calcula com os tokens do documento top1
    if (top1) {
      const indexPath = path.join(__dirname, '..', 'data', 'index.json');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const docEntry = index.find((d) => d.id === top1.id);
      groundedSum += groundedness(query, docEntry ? docEntry.tokens : []);
    }
    results.push({ query, top3 });
  }

  const n = dataset.length;
  const metrics = {
    precision_at_1: precisionAt1 / n,
    precision_at_3: precisionAt3 / n,
    recall_at_1: recallAt1 / n,
    recall_at_3: recallAt3 / n,
    groundedness: groundedSum / n
  };

  // Certifique‑se de que a pasta eval exista
  const evalDir = path.join(__dirname, '..', 'eval');
  if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir);
  fs.writeFileSync(path.join(evalDir, 'results.json'), JSON.stringify({ metrics, results }, null, 2));
  console.log('Métricas de avaliação:\n', metrics);
}

if (require.main === module) {
  main();
}