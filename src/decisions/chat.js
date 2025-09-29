const { sendChatCompletion } = require('../services/llm');
const { retrieveAnswer } = require('../services/rag');

function createChatDecision(bot, state, interpretReply, config) {
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    const now = Date.now();
    if (now - state.lastReplyTime < config.antiSpamCooldownMs) return;
    state.lastReplyTime = now;

    state.blockAutoDecisionUntil = now + config.autoDecisionBlockMs;
    state.memory.lastSpeaker = username;

    // First attempt to answer using our internal RAG knowledge base.  If the
    // player asks a question about crafting or core mechanics, respond
    // immediately with a prewritten explanation.  This prevents the LLM from
    // producing unpredictable answers when a concise, factual one is
    // available.
    try {
      const ragAnswer = retrieveAnswer(message);
      if (ragAnswer) {
        bot.chat(ragAnswer);
        // When answering a factual question we do not interpret a
        // command, so return early.
        return;
      }
    } catch (err) {
      // Ignore retrieval errors and fall back to LLM logic
    }

    const prompt = `Você é uma IA chamada Lais, um bot do Minecraft que age com carinho e inteligência.
Seu status:
- Vida: ${bot.health}/20
- Comida: ${bot.food}/20
Inventário: ${bot.inventory.items().map(i => i.name).join(', ') || 'vazio'}

Um jogador chamado "${username}" disse: "${message}"

Sua memória recente:
- Última ação: ${state.memory.lastAction || 'nenhuma'}
- Último item entregue: ${state.memory.lastItemGiven || 'nenhum'}

Sempre responda da seguinte forma: COMANDO e depois seja responda naturalmente :). Em COMANDO você pode colocar somente as seguintes palavras:
fugir, lutar, comer, dormir, esconder, subir, cozinhar, abrigo, explorar, craftar (nome do item que podem ser machado, picareta, espada, pá, enxada, tabuas, graveto, fornalha, mesa de trabalho, baú, porta, botão, lavanca, placa, escada), seguir, minerar, coletar_madeira e dar.`;

    try {
      const reply = await sendChatCompletion(config.llm, [
        { role: 'system', content: 'Você é uma IA chamada Lais que vive dentro do Minecraft. Fale como alguem que conhece minecraft e aja de forma direta.' },
        { role: 'user', content: prompt }
      ]);

      if (!reply) return;
      console.log('💬 Lais respondeu:', reply);
      bot.chat(reply);
      interpretReply(reply.toLowerCase());
    } catch (error) {
      console.error('❌ Erro no LM Studio (mensagem de jogador):', error);
      bot.chat('Tive probleminhas pra entender... 😿');
    }
  });
}

module.exports = createChatDecision;
