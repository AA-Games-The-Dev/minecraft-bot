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

    let faqSuggestion = '';
    try {
      const ragAnswer = await retrieveAnswer(message, { k: 5 });
      if (ragAnswer) {
        faqSuggestion = `Sugestão do FAQ (score ${ragAnswer.score.toFixed(3)} - fonte ${ragAnswer.sourceId}):\n${ragAnswer.text}`;
      }
    } catch (err) {
      console.error('❌ Erro ao recuperar FAQ local:', err.message);
      faqSuggestion = '';
    }

    const statusBlock = `Seu status:\n- Vida: ${bot.health}/20\n- Comida: ${bot.food}/20`;
    const inventory = bot.inventory.items().map((i) => i.name).join(', ') || 'vazio';

    let context = '';
    try {
      const snippets = await buildContextSnippet(message, { k: 3 });
      if (snippets.length > 0) {
        context = snippets
          .map(
            (snippet) =>
              `Fonte ${snippet.rank} (${snippet.type} - ${snippet.sourceId}) [score ${snippet.score.toFixed(3)}]:\n${snippet.text}`
          )
          .join('\n\n');
      }
    } catch (err) {
      context = '';
    }

    const prompt = `Você é uma IA chamada Lais, um bot do Minecraft que age com carinho e inteligência.\n\n${statusBlock}\nInventário: ${inventory}\n\nContexto recuperado:\n${context || 'Nenhum trecho encontrado.'}\n\n${faqSuggestion || 'Nenhuma sugestão direta do FAQ está disponível.'}\n\nUm jogador chamado "${username}" disse: "${message}"\n\nSua memória recente:\n- Última ação: ${state.memory.lastAction || 'nenhuma'}\n- Último item entregue: ${state.memory.lastItemGiven || 'nenhum'}\n\nResponda sempre com base exclusivamente nas informações fornecidas no contexto recuperado e nos seus status atuais.\nSe for apropriado, inicie com COMANDO (somente quando o jogador pedir uma ação) seguido de uma resposta natural.\nOs valores permitidos em COMANDO são: fugir, lutar, comer, dormir, esconder, subir, cozinhar, abrigo, explorar, craftar (machado, picareta, espada, pá, enxada, tabuas, graveto, fornalha, mesa de trabalho, baú, porta, botão, lavanca, placa, escada), seguir, minerar, coletar_madeira e dar.`;

    try {
      const reply = await sendChatCompletion(config.llm, [
        {
          role: 'system',
          content:
            'Você é uma IA chamada Lais que vive dentro do Minecraft. Fale como alguém que conhece Minecraft e aja de forma direta. Use apenas o contexto fornecido.',
        },
        { role: 'user', content: prompt },
      ]);

      if (!reply) return;
      console.log('💬 Lais respondeu:', reply);
      bot.chat(reply);
      interpretReply(reply.toLowerCase());
    } catch (error) {
      console.error('❌ Erro no LM Studio (mensagem de jogador):', error.message || error);
    }
  });
}

module.exports = createChatDecision;
