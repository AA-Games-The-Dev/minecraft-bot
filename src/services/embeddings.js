const { pipeline } = require('@xenova/transformers');
const config = require('../config');

let embedderPromise = null;

function resolveModelId(explicitModel) {
  if (explicitModel) return explicitModel;
  if (config.embeddings && config.embeddings.model) {
    return config.embeddings.model;
  }
  return process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
}

function loadEmbedder(modelId) {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', modelId);
  }
  return embedderPromise;
}

async function embedText(text, { embedder, model } = {}) {
  const resolvedModel = resolveModelId(model);
  const embedderInstance = embedder || (await loadEmbedder(resolvedModel));
  const output = await embedderInstance(text, { pooling: 'mean', normalize: true });
  // `output.data` is a TypedArray already normalised.
  return Array.from(output.data);
}

module.exports = {
  loadEmbedder,
  embedText
};
