const { sendChatCompletion } = require('../services/llm');

function createContextDecision(bot, state, actions, helpers, config, interpretReply) {
  async function checkContextAndDecide() {
    if (Date.now() < state.blockAutoDecisionUntil || state.busy) return;

    if (state.task === 'wood') return actions.collectWood();
    if (state.task === 'stone') return actions.mineStone();

    const player = helpers.entities.getNearestPlayerEntity();
    const hostile = bot.nearestEntity(helpers.entities.isHostileMob);
    const isNight = bot.time.isNight;

    const context = `Você é um bot do Minecraft com comportamento inteligente.
Status:
- Vida: ${bot.health}/20
- Comida: ${bot.food}/20 {Quanto menor, mais fome}
- É noite? ${isNight ? 'Sim' : 'Não'}
- Mob hostil por perto? ${hostile ? 'Sim, ' + hostile.displayName : 'Não'}
- Jogador visível? ${player ? 'Sim' : 'Nenhum'}
Inventário: ${bot.inventory.items().map(i => i.name).join(', ') || 'vazio'}

Baseado nos status diga uma ação lógica e possível que pretende fazer agora, faça da seguinte forma:
COMANDO e depois diga o motivo curto baseado no status.

Em [ COMANDO ] você pode colocar somente as seguintes palavras:
fugir {caso precise fugir de mobs},
lutar {caso queira lutar contra os mobs},
comer {Caso esteja com fome},
dormir {caso seja de noite e tenha cama por perto},
esconder {caso não queira lutar contra os mobs},
subir {em cima de arvores},
cozinhar {caso tenha alimentos crus no inventario e tenha carvão},
abrigo {caso queira retornar para um lugar seguro},
explorar {Caso queira explorar},
craftar (machado, picareta, espada, pá, enxada, tabuas, graveto, fornalha, mesa de trabalho, baú, porta, botão, lavanca, placa, escada),
seguir {caso você queira me seguir},
coletar_madeira {caso não tenha madeira}
e dar {caso queira me dar um item}.`;

    try {
      const reply = await sendChatCompletion(config.llm, [
        { role: 'system', content: 'Você é um bot Minecraft com decisões próprias. Sempre diga uma ação direta e breve.' },
        { role: 'user', content: context }
      ]);

      if (!reply) return;
      console.log('🧐 Lais (decisão autônoma):', reply);
      interpretReply(reply.toLowerCase());
      if (Math.random() < 0.05) bot.chat(reply);
    } catch (error) {
      console.error('❌ Erro no LM Studio (contexto):', error);
    }
  }

  return checkContextAndDecide;
}

module.exports = createContextDecision;
