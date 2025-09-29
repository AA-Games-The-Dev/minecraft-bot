const { sendChatCompletion } = require('../services/llm');
const { retrieveAnswer, buildContextSnippet } = require('../services/rag');

function createChatDecision(bot, state, interpretReply, config) {
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    const now = Date.now();
    if (now - state.lastReplyTime < config.antiSpamCooldownMs) return;
    state.lastReplyTime = now;

    state.blockAutoDecisionUntil = now + config.autoDecisionBlockMs;
    state.memory.lastSpeaker = username;

    try {
      const ragAnswer = await retrieveAnswer(message);
      if (ragAnswer) {
        bot.chat(ragAnswer.text);
        return;
      }
    } catch (err) {
      console.error('❌ Erro ao recuperar contexto local:', err.message);
    }

    const statusBlock = `Seu status:\n- Vida: ${bot.health}/20\n- Comida: ${bot.food}/20`;
    const inventory = bot.inventory.items().map((i) => i.name).join(', ') || 'vazio';

    let context = '';
    try {
      const snippets = await buildContextSnippet(message, { k: 3 });
      if (snippets.length > 0) {
        context = snippets
          .map((snippet) => `Fonte ${snippet.rank} (${snippet.type} - ${snippet.sourceId}) [score ${snippet.score.toFixed(3)}]:\n${snippet.text}`)
          .join('\n\n');
      }
    } catch (err) {
      context = '';
    }

    const prompt = `Você é uma IA chamada Lais, um bot do Minecraft que age com carinho e inteligência.\n
    ${statusBlock}\n
    Inventário: ${inventory}\n\nContexto recuperado:\n
    ${context || 'Nenhum trecho encontrado.'}\n\n
    Um jogador chamado "${username}" disse: "${message}"\n\n
    Sua memória recente:\n- Última ação: ${state.memory.lastAction || 'nenhuma'}\n- Último item entregue: ${state.memory.lastItemGiven || 'nenhum'}\n\n
    Sempre responda da seguinte forma: COMANDO (Mas só se o jogador pedir algo, se ele perguntar algo não precisa colocar COMANDO) e depois responda naturalmente :). 
    Em COMANDO você pode colocar somente as seguintes palavras:\n
    fugir, lutar, comer, dormir, esconder, subir, cozinhar, abrigo, explorar, craftar (nome do item que podem ser machado, picareta, espada, pá, enxada, tabuas, graveto, fornalha, mesa de trabalho, baú, porta, botão, lavanca, placa, escada), seguir, minerar, coletar_madeira e dar.`;

    try {
      const reply = await sendChatCompletion(config.llm, [
        { role: 'system', content: 'Você é uma IA chamada Lais que vive dentro do Minecraft. Fale como alguém que conhece Minecraft e aja de forma direta. Use o contexto apenas se for útil.' },
        { role: 'user', content: prompt }
      ]);

      if (!reply) return;
      console.log('💬 Lais respondeu:', reply);
      bot.chat(reply);
      interpretReply(reply.toLowerCase());
    } catch (error) {
      console.error('❌ Erro no LM Studio (mensagem de jogador):', error.message || error);
      bot.chat('Tive problemas pra entender...');
    }
  });
}

module.exports = createChatDecision;
