const mcDataLoader = require('minecraft-data');

function createActions(bot, state, helpers, goals) {
  const { ensureBlockNearby } = helpers.environment;
  const { GoalFollow, GoalNear } = goals;

  function setTask(task) {
    state.task = task;
    bot.task = task;
  }

  function setBusy(value) {
    state.busy = value;
  }

  function attackMob(mob) {
    if (!mob?.isValid) return;
    const sword = bot.inventory.items().find(i => i.name.includes('sword'));

    const doAttack = () => {
      bot.lookAt(mob.position, true)
        .then(() => {
          if (mob?.isValid) bot.attack(mob);
        })
        .catch(() => {});
    };

    if (sword) {
      bot.equip(sword, 'hand').then(doAttack).catch(doAttack);
    } else {
      doAttack();
    }

    const distance = bot.entity.position.distanceTo(mob.position);
    if (distance > 2.5) {
      bot.pathfinder.setGoal(new GoalFollow(mob, 1));
    }
  }

  function collectWood() {
    const hasAxe = bot.inventory.items().some(i => i.name.includes('axe'));
    const logBlock = bot.findBlock({
      matching: block => block.name.includes('log'),
      maxDistance: 32
    });

    if (hasAxe) {
      const axe = bot.inventory.items().find(i => i.name.includes('axe'));
      if (axe) bot.equip(axe, 'hand').catch(() => {});
    }

    if (!logBlock) {
      setTask(null);
      return;
    }

    bot.collectBlock.collect(logBlock)
      .then(() => { setTask(null); })
      .catch(() => { setTask(null); });
  }

  function mineStone() {
    const hasPickaxe = bot.inventory.items().some(i => i.name.includes('pickaxe'));
    const stoneBlock = bot.findBlock({
      matching: block => block.name.includes('stone'),
      maxDistance: 32
    });

    if (hasPickaxe) {
      const pick = bot.inventory.items().find(i => i.name.includes('pickaxe'));
      if (pick) bot.equip(pick, 'hand').catch(() => {});
    }

    if (!stoneBlock) {
      setTask(null);
      return;
    }

    bot.collectBlock.collect(stoneBlock)
      .then(() => { setTask(null); })
      .catch(() => { setTask(null); });
  }

  async function craftItem(itemName) {
    const mcData = mcDataLoader(bot.version);
    const item = mcData.itemsByName[itemName];
    if (!item) return;

    const existingItem = bot.inventory.items().find(i => i.name === itemName);
    if (existingItem) {
      bot.chat(`Já tenho ${itemName}`);
      return;
    }

    const recipe = bot.recipesFor(item.id, null, 1)?.[0];
    if (!recipe) {
      return;
    }

    const requirements = collectRequirements(recipe);

    const haveCount = (id) =>
      bot.inventory.items().filter(i => i.type === id).reduce((sum, itemStack) => sum + itemStack.count, 0);

    let missingInfo = null;
    for (const [id, need] of requirements.entries()) {
      const have = haveCount(id);
      if (have < need) { missingInfo = { id, need, have }; break; }
    }

    if (missingInfo) {
      const missName = mcData.items[missingInfo.id]?.name || 'item';
      const missDisplay = mcData.items[missingInfo.id]?.displayName || missName;
      bot.chat(`Falta ${missDisplay} pra ${item.displayName}. Vou tentar conseguir~ 🧐`);

      if (/log/.test(missName)) {
        setTask('wood');
        state.currentMode = 'mining';
        return;
      }

      if (missName === 'cobblestone') {
        setTask('stone');
        state.currentMode = 'mining';
        return;
      }

      bot.chat('Não sei coletar esse ingrediente automaticamente agora, vou esperar.');
      return;
    }

    let craftingTableBlock = null;
    if (recipe.requiresTable) {
      craftingTableBlock = await ensureBlockNearby({
        findNamePart: 'crafting_table',
        invItemName: 'crafting_table',
        searchRange: 4
      });

      if (!craftingTableBlock) {
        bot.chat('Não tenho mesa por perto e nem no inventário... vou tentar craftar uma!');
        if (itemName !== 'crafting_table') {
          return craftItem('crafting_table');
        }
      } else {
        const position = craftingTableBlock.position;
        setBusy(true);
        await bot.pathfinder.goto(new GoalNear(position.x, position.y, position.z, 1)).catch(() => {});
        setBusy(false);
      }
    }

    bot.craft(recipe, 1, craftingTableBlock, (error) => {
      if (error) {
        bot.chat('Awn... Não consegui craftar');
      } else {
        bot.chat(`Craft de ${item.displayName} feito com sucesso`);
      }
    });
  }

  async function cookFood() {
    const mcData = mcDataLoader(bot.version);

    const rawFood = bot.inventory.items().find(item =>
      ['beef', 'porkchop', 'chicken', 'mutton'].some(f => item.name.includes(f)) &&
      !item.name.includes('cooked')
    );

    if (!rawFood) {
      bot.chat('Não achei comida crua pra cozinhar');
      return;
    }

    const furnaceBlock = await ensureBlockNearby({
      findNamePart: 'furnace',
      invItemName: 'furnace',
      searchRange: 4
    });

    async function goAndCook(furnacePosition) {
      setBusy(true);
      await bot.pathfinder.goto(new GoalNear(furnacePosition.x, furnacePosition.y, furnacePosition.z, 1)).catch(() => {});

      try {
        const furnaceBlockNow = bot.blockAt(furnacePosition);
        const furnace = await bot.openFurnace(furnaceBlockNow);

        await furnace.putInput(rawFood.type, null, rawFood.count);

        const fuel = bot.inventory.items().find(i =>
          i.name.includes('coal') || i.name.includes('log') || i.name.includes('planks')
        );

        if (fuel) {
          await furnace.putFuel(fuel.type, null, fuel.count);
          bot.chat('Comida no forno');
        } else {
          bot.chat('Não achei combustível...');
          furnace.close();
          setBusy(false);
          return;
        }

        const cookCheck = setInterval(async () => {
          const output = furnace.outputItem();
          if (output) {
            try {
              await furnace.takeOutput();
              bot.chat('Yay~ Comida assada!');
            } catch (error) {
              // ignore error when taking output
            }
            clearInterval(cookCheck);
            furnace.close();
            setBusy(false);
          }
        }, 1000);
      } catch (error) {
        bot.chat('Hmm... Não consegui usar a fornalha');
        setBusy(false);
      }
    }

    if (furnaceBlock) {
      goAndCook(furnaceBlock.position);
    } else {
      bot.chat('Não achei/coloquei fornalha… vou tentar craftar uma!');
      const cobbleId = mcData.itemsByName.cobblestone.id;
      const cobbleCount = bot.inventory.items()
        .filter(i => i.type === cobbleId)
        .reduce((sum, itemStack) => sum + itemStack.count, 0);

      if (cobbleCount >= 8) {
        const furnaceRecipe = bot.recipesFor(mcData.itemsByName.furnace.id, null, 1)?.[0];
        if (furnaceRecipe) {
          bot.craft(furnaceRecipe, 1, null, async (error) => {
            if (error) {
              bot.chat('não consegui craftar a fornalha');
            } else {
              bot.chat('Fornalha craftada!');
              const placed = await ensureBlockNearby({
                findNamePart: 'furnace',
                invItemName: 'furnace',
                searchRange: 4
              });
              if (placed) goAndCook(placed.position);
            }
          });
        }
      } else {
        bot.chat('Hmm... Não tenho pedras suficientes pra fazer uma fornalha');
      }
    }
  }

  async function huntLoop() {
    setBusy(true);

    async function tryToHarvestFood() {
      const foodBlock = bot.findBlock({
        matching: block => block.name.includes('wheat') || block.name.includes('melon'),
        maxDistance: 32
      });
      if (foodBlock) {
        bot.chat('Achei plantações, vou colher!');
        const position = foodBlock.position;
        await bot.pathfinder.goto(new GoalNear(position.x, position.y, position.z, 1)).catch(() => {});
        await bot.dig(foodBlock).catch(() => bot.chat('Não consegui colher a plantinha'));
        return true;
      }
      return false;
    }

    async function huntAnimal() {
      const prey = bot.nearestEntity(entity =>
        entity.type === 'mob' && ['pig', 'cow', 'chicken', 'sheep'].includes(entity.name)
      );

      if (prey) {
        state.memory.lastAction = `Caçando ${prey.name} 🐷`;
        bot.chat(`Achei um ${prey.name}, indo caçar!`);
        await bot.pathfinder.goto(new GoalFollow(prey, 1)).catch(() => {});
        const deathPos = prey.position.clone();

        while (prey?.isValid) {
          await bot.lookAt(prey.position, true).catch(() => {});
          bot.attack(prey);
          await bot.waitForTicks(20);
        }

        await bot.pathfinder.goto(new GoalNear(deathPos.x, deathPos.y, deathPos.z, 1)).catch(() => {});
        bot.chat(`${prey.name} derrotado! Vamos ver se peguei comida...`);
        return true;
      }

      return false;
    }

    for (let i = 0; i < 20; i++) {
      const food = bot.inventory.items().find(i =>
        ['beef', 'porkchop', 'chicken', 'mutton', 'apple', 'bread'].some(f => i.name.includes(f))
      );
      if (food) {
        bot.chat('Yay~ Consegui comida!');
        setBusy(false);
        return;
      }

      if (await tryToHarvestFood()) continue;
      if (await huntAnimal()) continue;

      const dx = Math.floor(Math.random() * 10 - 5);
      const dz = Math.floor(Math.random() * 10 - 5);
      const target = bot.entity.position.offset(dx, 0, dz);
      bot.chat('Procurando mais comidinhas...');
      await bot.pathfinder.goto(new GoalNear(target.x, target.y, target.z, 1)).catch(() => {});
    }

    setBusy(false);
  }

  function collectRequirements(recipe) {
    const requirements = new Map();
    const add = (id, quantity = 1) => {
      if (!id || !Number.isFinite(quantity)) return;
      requirements.set(id, (requirements.get(id) || 0) + quantity);
    };

    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      for (const ingredient of recipe.ingredients) add(ingredient.id, ingredient.count || 1);
    } else if (Array.isArray(recipe.inShape)) {
      for (const row of recipe.inShape) {
        for (const cell of row) if (cell) add(cell.id, 1);
      }
    }

    return requirements;
  }

  return {
    attackMob,
    collectWood,
    cookFood,
    craftItem,
    huntLoop,
    mineStone,
    setBusy,
    setTask
  };
}

module.exports = createActions;
