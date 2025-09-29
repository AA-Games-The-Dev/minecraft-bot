const axios = require('axios');

async function sendChatCompletion(config, messages, extraPayload = {}) {
  const payload = {
    model: config.model,
    messages,
    temperature: config.temperature,
    ...extraPayload
  };
  if (config.maxTokens) payload.max_tokens = config.maxTokens;

  const headers = {
    'Content-Type': 'application/json',
    ...(config.headers || {})
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  try {
    const response = await axios.post(config.endpoint, payload, {
      headers,
      timeout: config.timeoutMs || 120000
    });

    return (response.data.choices?.[0]?.message?.content || '').trim();
  } catch (error) {
    const details = error.response?.data || error.message;
    throw new Error(`Falha ao chamar LLM: ${JSON.stringify(details)}`);
  }
}

module.exports = {
  sendChatCompletion
};
