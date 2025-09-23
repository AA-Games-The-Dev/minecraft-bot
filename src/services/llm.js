const axios = require('axios');

async function sendChatCompletion(config, messages) {
  try {
    const response = await axios.post(config.endpoint, {
      model: config.model,
      messages
    });

    return (response.data.choices?.[0]?.message?.content || '').trim();
  } catch (error) {
    throw error;
  }
}

module.exports = {
  sendChatCompletion
};
