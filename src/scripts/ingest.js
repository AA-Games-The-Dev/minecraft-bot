#!/usr/bin/env node
/*
 * Ingestão de dados para o bot RAG. Este script lê um conjunto de
 * exemplos de perguntas e respostas definidas em `data/recipes.json`
 * e constrói um índice simplificado baseado em palavras‑chave. A
 * ideia é que cada documento no dataset seja representado por um
 * conjunto de tokens normalizados (lowercase, sem pontuação) que
 * servirão como base para o cálculo de similaridade. Esse método
 * não utiliza embeddings de alta dimensão, mas fornece uma estrutura
 * de recuperação determinística que pode ser facilmente substituída
 * por uma solução de vetores (ChromaDB, Faiss, etc.) quando
 * recursos adicionais estiverem disponíveis.
 *
 * Para executar o script, use:
 *   node scripts/ingest.js
 * O índice será salvo em `data/index.json`.
 */

const fs = require('fs');
const path = require('path');

// Caminhos dos arquivos
const dataPath = path.join(__dirname, '..', 'data', 'recipes.json');
const indexPath = path.join(__dirname, '..', 'data', 'index.json');

// Função simples de tokenização: converte texto em lowercase e remove
// caracteres não alfanuméricos, dividindo por espaço.
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúãõâêôç\s]/gi, ' ') // mantém caracteres acentuados comuns
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function main() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const dataset = JSON.parse(raw);
  const index = dataset.map((item) => {
    // Combine todas as perguntas e a resposta para capturar a semântica
    const combined = [
      ...(item.pergunta || []),
      item.resposta_ref || ''
    ].join(' ');
    const tokens = Array.from(new Set(tokenize(combined)));
    return {
      id: item.id,
      tokens,
      resposta_ref: item.resposta_ref
    };
  });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`Índice salvo em ${indexPath}. ${index.length} documentos processados.`);
}

if (require.main === module) {
  main();
}