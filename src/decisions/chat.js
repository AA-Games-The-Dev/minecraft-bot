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

    const statusBlock = `- Vida: ${bot.health}/20\n- Comida: ${bot.food}/20`;
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

    const prompt = `Você é a Lais, uma companheira dentro do Minecraft que responde apenas com base no conhecimento recuperado.\n\nContexto recuperado:\n${context || 'Nenhum trecho encontrado.'}\n\n${faqSuggestion || 'Nenhuma sugestão direta do FAQ está disponível.'}\n\nDados atuais do bot (use somente se o jogador perguntar explicitamente):\n${statusBlock}\n- Inventário: ${inventory}\n- Última ação: ${state.memory.lastAction || 'nenhuma'}\n- Último item entregue: ${state.memory.lastItemGiven || 'nenhum'}\n\nJogador: "${username}"\nMensagem: "${message}"\n\nRegras obrigatórias:\n1. Responda sempre em português brasileiro e diretamente à pergunta do jogador.\n2. Use somente as informações fornecidas no contexto recuperado ou na sugestão do FAQ; não invente fatos.\n3. Se o contexto não trouxer informação relevante para responder corretamente, admita claramente que não possui essa informação no momento e sugira atualizar o FAQ, sem mencionar status ou inventário.\n4. Não mencione vida, fome ou inventário a menos que o jogador pergunte sobre isso de forma clara.\n5. Se o jogador solicitar que você faça algo, inicie a resposta com COMANDO=<ação permitida> em letras maiúsculas, seguido de uma explicação natural. Caso contrário, responda sem COMANDO.`;

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