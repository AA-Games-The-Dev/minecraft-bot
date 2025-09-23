module.exports = {
  connection: {
    host: 'localhost',
    port: 25565,
    username: 'Lais',
    version: '1.20.1'
  },
  intervals: {
    contextCheckMs: 10000,
    behaviorLoopMs: 1000
  },
  llm: {
    endpoint: 'http://localhost:5555/v1/chat/completions',
    model: 'glm-4-9b-chat-1m'
  },
  antiSpamCooldownMs: 3000,
  autoDecisionBlockMs: 5000,
  visionRange: 16
};
