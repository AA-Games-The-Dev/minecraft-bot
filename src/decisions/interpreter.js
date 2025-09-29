function createInterpreter(bot, state, actions, helpers, goals) {
  const { GoalFollow, GoalNear } = goals;
  const { isHostileMob, getNearestPlayerEntity } = helpers.entities;

  function interpretReply(text) {
    const { memory } = state;

    if (/fugir/i.test(text)) {
      memory.lastAction = 'Fugindo do perigo';
      const dx = Math.random() * 15 - 7;
      const dz = Math.random() * 15 - 7;
      const target = bot.entity.position.offset(dx, 0, dz);
      bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
      return;
    }

    if (/esconder/i.test(text)) {
      memory.lastAction = 'Procurando esconderijo';
      const shelterBlock = bot.findBlock({
        matching: block => block.name.includes('leaves') || block.name.includes('planks'),
        maxDistance: 32
      });
      if (shelterBlock) {
        const position = shelterBlock.position;
        bot.pathfinder.setGoal(new GoalNear(position.x, position.y, position.z, 1));
      } else {
        const dx = Math.random() * 10 - 5;
        const dz = Math.random() * 10 - 5;
        const target = bot.entity.position.offset(dx, 0, dz);
        bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
      }
      return;
    }

    if (/subir( em)? (uma )?árvore|subir árvore/i.test(text)) {
      memory.lastAction = 'Subindo em árvore';
      const treeBlock = bot.findBlock({
        matching: block => block.name.includes('log'),
        maxDistance: 32
      });
      if (treeBlock) {
        const top = treeBlock.position.offset(0, 5, 0);
        bot.pathfinder.setGoal(new GoalNear(top.x, top.y, top.z, 1));
      }
      return;
    }

    if (/lutar/i.test(text)) {
      const hostile = bot.nearestEntity(isHostileMob);
      if (hostile) {
        memory.lastAction = `Atacando ${hostile.name}`;
        state.currentMode = 'patrol';
        actions.attackMob(hostile);
      }
      return;
    }

    if (/cozinhar/i.test(text)) {
      memory.lastAction = 'Cozinhando comida';
      actions.cookFood();
      return;
    }

    if (/caçar/i.test(text)) {
      memory.lastAction = 'Caçando alimento... 🐾';
      actions.huntLoop();
      return;
    }

    if (/explorar/i.test(text)) {
      memory.lastAction = 'Explorando área';
      const dx = Math.random() * 10 - 5;
      const dz = Math.random() * 10 - 5;
      const target = bot.entity.position.offset(dx, 0, dz);
      bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
      return;
    }

    if (/abrigo/i.test(text)) {
      memory.lastAction = 'Buscando abrigo';
      const shelterBlock = bot.findBlock({
        matching: block => block.name.includes('planks'),
        maxDistance: 32
      });
      if (shelterBlock) {
        const position = shelterBlock.position;
        bot.pathfinder.setGoal(new GoalNear(position.x, position.y, position.z, 1));
      }
      return;
    }

    if (/craftar/i.test(text)) {
      memory.lastAction = 'Craftando item';
      if (/tábuas|tabuas|planks|oak_planks/.test(text)) return actions.craftItem('oak_planks');
      if (/espada|uma espada|sword/.test(text)) return actions.craftItem('wooden_sword');
      if (/picareta|pickaxe/.test(text)) return actions.craftItem('wooden_pickaxe');
      if (/machado|axe/.test(text)) return actions.craftItem('wooden_axe');
      if (/pá|pa|shovel/.test(text)) return actions.craftItem('wooden_shovel');
      if (/enxada|hoe/.test(text)) return actions.craftItem('wooden_hoe');
      if (/mesa_de_trabalho|crafting_table/.test(text)) return actions.craftItem('crafting_table');
      if (/fornalha|furnace/.test(text)) return actions.craftItem('furnace');
      if (/baú|chest/.test(text)) return actions.craftItem('chest');
      if (/porta|door/.test(text)) return actions.craftItem('oak_door');
      if (/stick|graveto/.test(text)) return actions.craftItem('stick');
      if (/tocha|torch/.test(text)) return actions.craftItem('torch');
      if (/botão|button/.test(text)) return actions.craftItem('oak_button');
      if (/alavanca|lever/.test(text)) return actions.craftItem('lever');
      if (/placa|sign/.test(text)) return actions.craftItem('oak_sign');
      if (/escada|ladder/.test(text)) return actions.craftItem('ladder');
      return actions.craftItem('wooden_pickaxe');
    }

    if (/comer/i.test(text)) {
      const foodItem = bot.inventory.items().find(item =>
        ['beef', 'steak', 'apple', 'bread', 'porkchop', 'cooked_porkchop', 'mutton', 'cooked_mutton', 'chicken', 'cooked_chicken']
          .some(food => item.name.includes(food))
      );
      if (foodItem) {
        memory.lastAction = `Comeu ${foodItem.name}`;
        bot.equip(foodItem, 'hand')
          .then(() => bot.consume())
          .catch(() => {});
      }
      return;
    }

    if (/seguir/i.test(text)) {
      const player = memory.lastSpeaker ? bot.players[memory.lastSpeaker] : null;
      if (player?.entity) {
        memory.lastAction = `Seguindo ${memory.lastSpeaker}`;
        state.currentMode = 'follow';
        bot.pathfinder.setGoal(new GoalFollow(player.entity, 1));
      } else {
        const nearest = getNearestPlayerEntity();
        if (nearest) {
          memory.lastAction = 'Seguindo jogador mais próximo';
          state.currentMode = 'follow';
          bot.pathfinder.setGoal(new GoalFollow(nearest, 1));
        }
      }
      return;
    }

    if (/dormir/i.test(text)) {
      const bed = bot.findBlock({
        matching: block => block.name.includes('bed'),
        maxDistance: 32
      });
      if (bed) {
        memory.lastAction = 'Foi dormir';
        bot.sleep(bed).catch(() => {});
      }
      return;
    }

    if (/minerar/i.test(text)) {
      state.currentMode = 'mining';
      actions.setTask('stone');
      memory.lastAction = 'Minerando pedra';
      return;
    }

    if (/coletar_madeira/i.test(text)) {
      state.currentMode = 'mining';
      actions.setTask('wood');
      memory.lastAction = 'Coletando madeira';
      return;
    }

    if (/dar/i.test(text)) {
      const player = memory.lastSpeaker ? bot.players[memory.lastSpeaker] : null;
      const itemToGive = bot.inventory.items()[0];
      if (player?.entity && itemToGive) {
        memory.lastAction = `Deu ${itemToGive.name} para ${memory.lastSpeaker}`;
        memory.lastItemGiven = itemToGive.name;
        bot.lookAt(player.entity.position.offset(0, 1.5, 0)).catch(() => {});
        bot.tossStack(itemToGive).catch(() => {});
      } else {
        bot.chat('Sem jogador ou item pra dar agora.');
      }
      return;
    }
  }

  return interpretReply;
}

module.exports = createInterpreter;
