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
  // Configurações do LLM. O trabalho requer o uso de um modelo de linguagem
  // aberto em vez de serviços proprietários. Aqui configuramos o endpoint
  // padrão do Ollama (rodando em localhost) e especificamos um modelo
  // open‑source compatível, como Llama 3.1 8B Instruct ou Mistral 7B
  // Instruct. Para mudar o modelo basta alterar o campo `model`.
  llm: {
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3.1:8b-instruct'
  },
  antiSpamCooldownMs: 3000,
  autoDecisionBlockMs: 5000,
  visionRange: 16
};
