module.exports = {
  connection: {
    host: process.env.BOT_HOST || 'localhost',
    port: Number(process.env.BOT_PORT || 25565),
    username: process.env.BOT_USERNAME || 'Lais',
    version: process.env.BOT_VERSION || '1.20.1'
  },
  intervals: {
    contextCheckMs: Number(process.env.CONTEXT_CHECK_MS || 10000),
    behaviorLoopMs: Number(process.env.BEHAVIOR_LOOP_MS || 1000)
  },
  llm: {
    endpoint: process.env.LLM_ENDPOINT || 'http://localhost:5555/v1/chat/completions',
    model: process.env.LLM_MODEL || 'llama3.1:8b-instruct',
    apiKey: process.env.LLM_API_KEY || null,
    temperature: Number(process.env.LLM_TEMPERATURE || 0.2),
    maxTokens: process.env.LLM_MAX_TOKENS ? Number(process.env.LLM_MAX_TOKENS) : undefined,
    headers: {},
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 120000)
  },
  embeddings: {
    model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
  },
  antiSpamCooldownMs: Number(process.env.ANTI_SPAM_COOLDOWN_MS || 3000),
  autoDecisionBlockMs: Number(process.env.AUTO_DECISION_BLOCK_MS || 5000),
  visionRange: Number(process.env.VISION_RANGE || 16)
};
