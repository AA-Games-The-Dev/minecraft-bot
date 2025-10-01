#!/usr/bin/env node
/*
 * Script de avaliação do componente de recuperação. Mede métricas de
 * precisão, recall e groundedness a partir do índice vetorial
 * produzido pelo script de ingestão.
 */

const fs = require('fs');
const path = require('path');
const { retrieveTopK } = require('../services/rag');

const dataPath = path.join(__dirname, '..', 'data', 'recipes.json');
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function groundedness(query, docText) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  const docTokens = new Set(
    docText
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
  let match = 0;
  for (const t of tokens) {
    if (docTokens.has(t)) match++;
  }
  return match / tokens.length;
}

async function main() {
  const results = [];
  let precisionAt1 = 0;
  let precisionAt3 = 0;
  let recallAt1 = 0;
  let recallAt3 = 0;
  let groundedSum = 0;
  let processed = 0;

  for (const item of dataset) {
    const questions = item.pergunta || item.question;
    if (!questions || (Array.isArray(questions) && questions.length === 0)) {
      console.warn(`Item ${item.id} sem perguntas válidas. Ignorando.`);
      continue;
    }

    const query = Array.isArray(questions) ? questions[0] : questions;
    const top3 = (await retrieveTopK(query, 3)) || [];
    const top1 = top3[0];
    const relevantId = `faq:${item.id}`;

    if (top1 && top1.id === relevantId && top1.score > 0) precisionAt1++;
    if (top3.find((doc) => doc.id === relevantId && doc.score > 0)) precisionAt3++;
    if (top1 && top1.id === relevantId && top1.score > 0) recallAt1++;
    if (top3.find((doc) => doc.id === relevantId && doc.score > 0)) recallAt3++;

    if (top1) {
      groundedSum += groundedness(query, top1.text || '');
    }

    results.push({ query, top3 });
    processed++;
  }

  const metrics = processed
    ? {
        precision_at_1: precisionAt1 / processed,
        precision_at_3: precisionAt3 / processed,
        recall_at_1: recallAt1 / processed,
        recall_at_3: recallAt3 / processed,
        groundedness: groundedSum / processed
      }
    : {
        precision_at_1: 0,
        precision_at_3: 0,
        recall_at_1: 0,
        recall_at_3: 0,
        groundedness: 0
      };

  const evalDir = path.join(__dirname, '..', 'eval');
  if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir);
  fs.writeFileSync(path.join(evalDir, 'results.json'), JSON.stringify({ metrics, results }, null, 2));
  console.log('Métricas de avaliação:\n', metrics);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Falha ao executar avaliação:', error);
    process.exit(1);
  });
}
