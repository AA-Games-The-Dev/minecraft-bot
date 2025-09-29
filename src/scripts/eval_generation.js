#!/usr/bin/env node
/*
 * Avaliação da geração: utiliza o pipeline RAG completo para responder
 * às perguntas do dataset e calcula métricas simples de F1 token-level
 * em relação às respostas de referência.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { sendChatCompletion } = require('../services/llm');
const { retrieveTopK } = require('../services/rag');

const dataPath = path.join(__dirname, '..', 'data', 'recipes.json');
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function f1Score(prediction, reference) {
  const predTokens = normalise(prediction);
  const refTokens = normalise(reference);
  if (predTokens.length === 0 || refTokens.length === 0) return 0;
  const refCounts = new Map();
  for (const token of refTokens) {
    refCounts.set(token, (refCounts.get(token) || 0) + 1);
  }
  let match = 0;
  for (const token of predTokens) {
    const count = refCounts.get(token);
    if (count) {
      refCounts.set(token, count - 1);
      match++;
    }
  }
  if (match === 0) return 0;
  const precision = match / predTokens.length;
  const recall = match / refTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

async function evaluateItem(item) {
  const question = item.pergunta[0];
  const context = await retrieveTopK(question, 3);
  const contextText = context
    .map((doc, idx) => `Trecho ${idx + 1} (${doc.type} - ${doc.sourceId}, score ${doc.score.toFixed(3)}):\n${doc.text}`)
    .join('\n\n');

  const messages = [
    { role: 'system', content: 'Você é uma IA que responde perguntas sobre Minecraft. Use APENAS as informações fornecidas no contexto recuperado. Se não tiver certeza, admita.' },
    {
      role: 'user',
      content: `Contexto recuperado:\n${contextText || 'Nenhum trecho encontrado.'}\n\nPergunta: ${question}\nResponda em português de forma objetiva.`
    }
  ];

  const answer = await sendChatCompletion(config.llm, messages);
  const score = f1Score(answer, item.resposta_ref);
  return {
    id: item.id,
    question,
    reference: item.resposta_ref,
    answer,
    f1: score,
    context
  };
}

async function main() {
  const results = [];
  let f1Sum = 0;

  for (const item of dataset) {
    try {
      const result = await evaluateItem(item);
      results.push(result);
      f1Sum += result.f1;
      console.log(`Pergunta ${item.id}: F1 ${(result.f1 * 100).toFixed(1)}%`);
    } catch (error) {
      console.error(`Falha ao avaliar pergunta ${item.id}:`, error.message || error);
      throw new Error('Interrompendo avaliação porque a chamada ao LLM falhou. Verifique se o LM Studio/Ollama está em execução.');
    }
  }

  const metrics = {
    mean_f1: results.length ? f1Sum / results.length : 0
  };

  const evalDir = path.join(__dirname, '..', 'eval');
  if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir);
  fs.writeFileSync(path.join(evalDir, 'generation.json'), JSON.stringify({ metrics, results }, null, 2));
  console.log('Avaliação concluída. Métrica média F1:', metrics.mean_f1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Falha na avaliação de geração:', error.message || error);
    process.exit(1);
  });
}
