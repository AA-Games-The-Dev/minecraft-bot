// Lais Bot – Mineflayer (corrigido e organizado)
// Requisitos: mineflayer, mineflayer-pathfinder, mineflayer-collectblock, axios, vec3

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear } = goals;
const collectBlock = require('mineflayer-collectblock').plugin;
const axios = require('axios');
const { Vec3 } = require('vec3');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Lais',
  version: '1.20.1'
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(collectBlock);

let currentMode = 'idle';
let movements;
let lastReplyTime = 0;
let blockAutoDecisionUntil = 0;
let busy = false; // evita conflitos de metas (GoalChanged)
bot.task = null;

const laisMemory = {
  lastAction: null,
  lastSpeaker: null,
  lastItemGiven: null
};

const VISION_RANGE = 16;

// ===== Helpers =====

// Garante um bloco utilitário por perto: se não existir, coloca do inventário "sem pensar duas vezes".
async function ensureBlockNearby({ findNamePart, invItemName, searchRange = 4 }) {
  // 1) já existe por perto?
  let block = bot.findBlock({
    matching: b => b.name.includes(findNamePart),
    maxDistance: searchRange
  });
  if (block) return block;

  // 2) se tiver no inventário, coloca imediatamente
  const item = bot.inventory.items().find(i => i.name === invItemName);
  if (!item) return null;

  const base = bot.blockAt(bot.entity.position.offset(0, -1, 0));
  if (!base) return null;

  try {
    await bot.equip(item, 'hand');
  } catch { /* ignora */ }

  // tenta posições ao redor (em cima do bloco de chão onde está)
  const offsets = [
    new Vec3(0, 1, 0),
    new Vec3(1, 1, 0),
    new Vec3(-1, 1, 0),
    new Vec3(0, 1, 1),
    new Vec3(0, 1, -1)
  ];

  for (const off of offsets) {
    try {
      await bot.placeBlock(base, off);
      await bot.waitForTicks(8);
      block = bot.findBlock({
        matching: b => b.name.includes(findNamePart),
        maxDistance: searchRange
      });
      if (block) return block;
    } catch {
      // tenta o próximo offset
    }
  }
  return null;
}

function isHostileMob(e) {
  return (
    (e.type === 'hostile' || e.type === 'mob') &&
    e.displayName !== 'Armor Stand' &&
    e.position.distanceTo(bot.entity.position) < 16
  );
}

function isHostileMobNearby() {
  return bot.nearestEntity(isHostileMob) !== null;
}

function getNearestPlayerEntity() {
  let nearest = null;
  let minDist = Infinity;
  for (const [name, p] of Object.entries(bot.players)) {
    if (!p.entity || name === bot.username) continue;
    const d = p.entity.position.distanceTo(bot.entity.position);
    if (d < minDist) {
      minDist = d;
      nearest = p.entity;
    }
  }
  return nearest;
}

function getBestLookTarget() {
  const entities = Object.values(bot.entities);
  const players = Object.values(bot.players).filter(p => p.entity);
  let nearest = null;
  let minDist = Infinity;

  const checkTarget = (pos) => {
    const dist = bot.entity.position.distanceTo(pos);
    if (dist < minDist && dist <= VISION_RANGE) {
      minDist = dist;
      nearest = pos;
    }
  };

  for (const entity of entities) {
    if (['hostile', 'mob'].includes(entity.type)) {
      const pos = entity.position.clone();
      pos.y += entity.height || 1.6;
      checkTarget(pos);
    }
    if (entity.name === 'item') {
      const pos = entity.position.clone();
      pos.y += 0.5;
      checkTarget(pos);
    }
  }

  for (const player of players) {
    if (player.username === bot.username) continue;
    const pos = player.entity.position.clone();
    pos.y += 1.6;
    checkTarget(pos);
  }

  return nearest;
}

// ===== Lifecycle =====
bot.once('spawn', () => {
  movements = new Movements(bot);
  bot.pathfinder.setMovements(movements);
  setInterval(() => {
    checkContextAndDecide();
  }, 10000);
});

// Olhar automaticamente para alvos interessantes quando idle
bot.on('physicsTick', () => {
  if (currentMode !== 'idle') return;
  const targetPos = getBestLookTarget();
  if (targetPos) bot.lookAt(targetPos).catch(() => {});
});

// Loop de comportamento baseado no modo
setInterval(() => {
  if (busy) return;

  // Minerando
  if (currentMode === 'mining') {
    if (bot.task === 'stone') {
      mineStone();
    } else if (bot.task === 'wood') {
      collectWood();
    }
  }

  // Seguindo
  if (currentMode === 'follow') {
    const target =
      (laisMemory.lastSpeaker && bot.players[laisMemory.lastSpeaker]?.entity) ||
      getNearestPlayerEntity();
    if (target) {
      bot.pathfinder.setGoal(new GoalFollow(target, 1));
    }
  }

  // Patrulhando / lutando
  if (currentMode === 'patrol') {
    const hostile = bot.nearestEntity(isHostileMob);
    if (hostile) {
      attackMob(hostile);
    } else {
      currentMode = 'idle';
      bot.pathfinder.setGoal(null);
    }
  }
}, 1000);

// Reagir quando o BOT é ferido
bot.on('entityHurt', (entity) => {
  if (entity !== bot.entity) return;

  const hostile = bot.nearestEntity(isHostileMob);
  if (hostile) {
    laisMemory.lastAction = 'Reagindo a ataque!';
    currentMode = 'patrol';
    attackMob(hostile);
  }
  if (bot.entity.onFire || bot.entity.position.y < 0) {
    bot.setControlState('jump', true);
    bot.setControlState('forward', true);
    bot.look(bot.entity.yaw + Math.PI, 0);
    setTimeout(() => bot.clearControlStates(), 2000);
  }
});

// Chat → LLM decide ação
bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  const now = Date.now();
  if (now - lastReplyTime < 3000) return; // antispam básico
  lastReplyTime = now;

  blockAutoDecisionUntil = now + 5000;
  laisMemory.lastSpeaker = username;

  const prompt = `Você é uma IA chamada Lais, um bot do Minecraft que age com carinho e inteligência.
Seu status:
- Vida: ${bot.health}/20
- Comida: ${bot.food}/20
Inventário: ${bot.inventory.items().map(i => i.name).join(', ') || 'vazio'}

Um jogador chamado "${username}" disse: "${message}"

Sua memória recente:
- Última ação: ${laisMemory.lastAction || 'nenhuma'}
- Último item entregue: ${laisMemory.lastItemGiven || 'nenhum'}

Sempre responda da seguinte forma: COMANDO e depois seja responda naturalmente :).
Em COMANDO você pode colocar somente as seguintes palavras:
fugir, lutar, comer, dormir, esconder, subir, cozinhar, abrigo, explorar, craftar (nome do item que podem ser machado, picareta, espada, pá, enxada, tabuas, graveto, fornalha, mesa de trabalho, baú, porta, botão, lavanca, placa, escada), seguir, minerar, coletar_madeira e dar.`;

  try {
    const response = await axios.post('http://localhost:5555/v1/chat/completions', {
      model: 'glm-4-9b-chat-1m',
      messages: [
        { role: 'system', content: 'Você é uma IA chamada Lais que vive dentro do Minecraft. Fale como alguem que conhece minecraft e aja de forma direta.' },
        { role: 'user', content: prompt }
      ]
    });

    const reply = (response.data.choices?.[0]?.message?.content || '').trim();
    if (!reply) return;
    console.log('💬 Lais respondeu:', reply);
    bot.chat(reply);
    interpretReply(reply.toLowerCase());
  } catch (err) {
    console.error('❌ Erro no LM Studio (mensagem de jogador):', err);
    bot.chat('Tive probleminhas pra entender... 😿');
  }
});

// ===== Decisão autônoma periódica (LLM) =====
async function checkContextAndDecide() {
  if (Date.now() < blockAutoDecisionUntil || busy) return;

  if (bot.task === 'wood') return collectWood();
  if (bot.task === 'stone') return mineStone();

  const player = getNearestPlayerEntity();
  const hostile = bot.nearestEntity(isHostileMob);
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
    const response = await axios.post('http://localhost:5555/v1/chat/completions', {
      model: 'glm-4-9b-chat-1m',
      messages: [
        { role: 'system', content: 'Você é um bot Minecraft com decisões próprias. Sempre diga uma ação direta e breve.' },
        { role: 'user', content: context }
      ]
    });

    const reply = (response.data.choices?.[0]?.message?.content || '').trim().toLowerCase();
    if (!reply) return;
    console.log('🧐 Lais (decisão autônoma):', reply);
    interpretReply(reply);
    if (Math.random() < 0.05) bot.chat(reply);
  } catch (err) {
    console.error('❌ Erro no LM Studio (contexto):', err);
  }
}

// ===== Interpretar comando =====
function interpretReply(text) {
  // Fugir do perigo
  if (/fugir/i.test(text)) {
    laisMemory.lastAction = 'Fugindo do perigo';
    const dx = Math.random() * 15 - 7;
    const dz = Math.random() * 15 - 7;
    const target = bot.entity.position.offset(dx, 0, dz);
    bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
    return;
  }

  // Procurar esconderijo
  if (/esconder/i.test(text)) {
    laisMemory.lastAction = 'Procurando esconderijo';
    const shelterBlock = bot.findBlock({
      matching: block => block.name.includes('leaves') || block.name.includes('planks'),
      maxDistance: 32
    });
    if (shelterBlock) {
      const p = shelterBlock.position;
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1));
    } else {
      const dx = Math.random() * 10 - 5;
      const dz = Math.random() * 10 - 5;
      const target = bot.entity.position.offset(dx, 0, dz);
      bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
    }
    return;
  }

  // Subir em árvore
  if (/subir( em)? (uma )?árvore|subir árvore/i.test(text)) {
    laisMemory.lastAction = 'Subindo em árvore';
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

  // Lutar
  if (/lutar/i.test(text)) {
    const hostile = bot.nearestEntity(isHostileMob);
    if (hostile) {
      laisMemory.lastAction = `Atacando ${hostile.name}`;
      currentMode = 'patrol';
      attackMob(hostile);
    } else {
      //bot.chat('Não vejo nenhum inimigo agora');
    }
    return;
  }

  // Cozinhar
  if (/cozinhar/i.test(text)) {
    laisMemory.lastAction = 'Cozinhando comida';
    cookFood();
    return;
  }

  // Caçar / buscar comida
  if (/caçar/i.test(text)) {
    laisMemory.lastAction = 'Caçando alimento... 🐾';
    huntLoop();
    return;
  }

  // Explorar
  if (/explorar/i.test(text)) {
    laisMemory.lastAction = 'Explorando área';
    const dx = Math.random() * 10 - 5;
    const dz = Math.random() * 10 - 5;
    const target = bot.entity.position.offset(dx, 0, dz);
    bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
    return;
  }

  // Abrigo
  if (/abrigo/i.test(text)) {
    laisMemory.lastAction = 'Buscando abrigo';
    const shelterBlock = bot.findBlock({
      matching: block => block.name.includes('planks'),
      maxDistance: 32
    });
    if (shelterBlock) {
      const p = shelterBlock.position;
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1));
    }
    return;
  }

  // Craftar
  if (/craftar/i.test(text)) {
    laisMemory.lastAction = 'Craftando item';
    // Tábuas
    if (/tábuas|tabuas|planks|oak_planks/.test(text)) return craftItem('oak_planks');
    // Ferramentas
    if (/espada|uma espada|sword/.test(text)) return craftItem('wooden_sword');
    if (/picareta|pickaxe/.test(text)) return craftItem('wooden_pickaxe');
    if (/machado|axe/.test(text)) return craftItem('wooden_axe');
    if (/pá|pa|shovel/.test(text)) return craftItem('wooden_shovel');
    if (/enxada|hoe/.test(text)) return craftItem('wooden_hoe');
    // Blocos / estruturas
    if (/mesa_de_trabalho|crafting_table/.test(text)) return craftItem('crafting_table');
    if (/fornalha|furnace/.test(text)) return craftItem('furnace');
    if (/baú|chest/.test(text)) return craftItem('chest');
    if (/porta|door/.test(text)) return craftItem('oak_door');
    // Utilitários
    if (/stick|graveto/.test(text)) return craftItem('stick');
    if (/tocha|torch/.test(text)) return craftItem('torch');
    if (/botão|button/.test(text)) return craftItem('oak_button');
    if (/alavanca|lever/.test(text)) return craftItem('lever');
    if (/placa|sign/.test(text)) return craftItem('oak_sign');
    if (/escada|ladder/.test(text)) return craftItem('ladder');

    // Fallback
    return craftItem('wooden_pickaxe');
  }

  // Comer
  if (/comer/i.test(text)) {
    const foodItem = bot.inventory.items().find(item =>
      ['beef', 'steak', 'apple', 'bread', 'porkchop', 'cooked_porkchop', 'mutton', 'cooked_mutton', 'chicken', 'cooked_chicken']
        .some(f => item.name.includes(f))
    );
    if (foodItem) {
      laisMemory.lastAction = `Comeu ${foodItem.name}`;
      bot.equip(foodItem, 'hand')
        .then(() => bot.consume())
        .catch(() => {});
    } else {
      //bot.chat('Não tenho comida agora');
    }
    return;
  }

  // Seguir
  if (/seguir/i.test(text)) {
    const player = laisMemory.lastSpeaker ? bot.players[laisMemory.lastSpeaker] : null;
    if (player?.entity) {
      laisMemory.lastAction = `Seguindo ${laisMemory.lastSpeaker}`;
      currentMode = 'follow';
      bot.pathfinder.setGoal(new GoalFollow(player.entity, 1));
    } else {
      const near = getNearestPlayerEntity();
      if (near) {
        laisMemory.lastAction = 'Seguindo jogador mais próximo';
        currentMode = 'follow';
        bot.pathfinder.setGoal(new GoalFollow(near, 1));
      }
    }
    return;
  }

  // Dormir
  if (/dormir/i.test(text)) {
    const bed = bot.findBlock({
      matching: block => block.name.includes('bed'),
      maxDistance: 32
    });
    if (bed) {
      laisMemory.lastAction = 'Foi dormir';
      bot.sleep(bed).catch(() => {});
    } else {
      //bot.chat('Não achei cama por perto');
    }
    return;
  }

  // Minerar pedra
  if (/minerar/i.test(text)) {
    currentMode = 'mining';
    bot.task = 'stone';
    laisMemory.lastAction = 'Minerando pedra';
    return;
  }

  // Coletar madeira
  if (/coletar_madeira/i.test(text)) {
    currentMode = 'mining';
    bot.task = 'wood';
    laisMemory.lastAction = 'Coletando madeira';
    return;
  }

  // Dar item
  if (/dar/i.test(text)) {
    const player = laisMemory.lastSpeaker ? bot.players[laisMemory.lastSpeaker] : null;
    const itemToGive = bot.inventory.items()[0];
    if (player?.entity && itemToGive) {
      laisMemory.lastAction = `Deu ${itemToGive.name} para ${laisMemory.lastSpeaker}`;
      laisMemory.lastItemGiven = itemToGive.name;
      bot.lookAt(player.entity.position.offset(0, 1.5, 0)).catch(() => {});
      bot.tossStack(itemToGive).catch(() => {});
    } else {
      bot.chat('Sem jogador ou item pra dar agora.');
    }
    return;
  }
}

// ===== Ações =====
function attackMob(mob) {
  if (!mob?.isValid) return;
  const sword = bot.inventory.items().find(i => i.name.includes('sword'));
  const doAttack = () => {
    bot.lookAt(mob.position, true).then(() => {
      if (mob?.isValid) bot.attack(mob);
    }).catch(() => {});
  };

  if (sword) {
    bot.equip(sword, 'hand').then(doAttack).catch(doAttack);
  } else {
    doAttack();
  }

  // Aproximar-se se estiver longe
  const dist = bot.entity.position.distanceTo(mob.position);
  if (dist > 2.5) {
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
    bot.task = null;
    return;
  }

  bot.collectBlock.collect(logBlock)
    .then(() => { bot.task = null; })
    .catch(() => { bot.task = null; });
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
    bot.task = null;
    return;
  }

  bot.collectBlock.collect(stoneBlock)
    .then(() => { bot.task = null; })
    .catch(() => { bot.task = null; });
}

async function craftItem(itemName) {
  const mcData = require('minecraft-data')(bot.version);
  const item = mcData.itemsByName[itemName];
  if (!item) return; // item desconhecido

  const existingItem = bot.inventory.items().find(i => i.name === itemName);
  if (existingItem) {
    bot.chat(`Já tenho ${itemName}`);
    return;
  }

  // Pega uma receita válida (1.20.x)
  const recipe = bot.recipesFor(item.id, null, 1)?.[0];
  if (!recipe) {
    // bot.chat('Não sei como craftar isso');
    return;
  }

  // Normaliza requisitos: cobre receitas shapeless (ingredients) e shaped (inShape)
  function collectRequirements(r) {
    const req = new Map(); // id -> count
    const add = (id, n = 1) => {
      if (!id || !Number.isFinite(n)) return;
      req.set(id, (req.get(id) || 0) + n);
    };

    if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
      // shapeless
      for (const ing of r.ingredients) add(ing.id, ing.count || 1);
    } else if (Array.isArray(r.inShape)) {
      // shaped
      for (const row of r.inShape) {
        for (const cell of row) if (cell) add(cell.id, 1);
      }
    }
    return req;
  }

  const requirements = collectRequirements(recipe);

  const haveCount = (id) =>
    bot.inventory.items().filter(i => i.type === id).reduce((s, i) => s + i.count, 0);

  // Primeiro ingrediente faltando
  let missingInfo = null;
  for (const [id, need] of requirements.entries()) {
    const have = haveCount(id);
    if (have < need) { missingInfo = { id, need, have }; break; }
  }

  if (missingInfo) {
    const missName = mcData.items[missingInfo.id]?.name || 'item';
    const missDisplay = mcData.items[missingInfo.id]?.displayName || missName;
    bot.chat(`Falta ${missDisplay} pra ${item.displayName}. Vou tentar conseguir~ 🧐`);

    if (/log/.test(missName)) { bot.task = 'wood';  currentMode = 'mining'; return; }
    if (missName === 'cobblestone') { bot.task = 'stone'; currentMode = 'mining'; return; }

    bot.chat('Não sei coletar esse ingrediente automaticamente agora, vou esperar.');
    return;
  }

  // Mesa de trabalho: coloca "sem pensar duas vezes" se precisar
  let craftingTableBlock = null;
  if (recipe.requiresTable) {
    craftingTableBlock = await ensureBlockNearby({
      findNamePart: 'crafting_table',
      invItemName: 'crafting_table',
      searchRange: 4
    });

    if (!craftingTableBlock) {
      // Fallback: craftar mesa se não tiver
      bot.chat('Não tenho mesa por perto e nem no inventário... vou tentar craftar uma!');
      if (itemName !== 'crafting_table') return craftItem('crafting_table');
    } else {
      const p = craftingTableBlock.position;
      busy = true;
      await bot.pathfinder.goto(new GoalNear(p.x, p.y, p.z, 1)).catch(() => {});
      busy = false;
    }
  }

  // Executa o craft
  bot.craft(recipe, 1, craftingTableBlock, (err) => {
    if (err) {
      bot.chat('Awn... Não consegui craftar');
    } else {
      bot.chat(`Craft de ${item.displayName} feito com sucesso`);
    }
  });
}


// ===== Cozinhar =====
async function cookFood() {
  const mcData = require('minecraft-data')(bot.version);

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
    busy = true;
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
        busy = false;
        return;
      }

      const cookCheck = setInterval(async () => {
        const output = furnace.outputItem();
        if (output) {
          try { await furnace.takeOutput(); bot.chat('Yay~ Comida assada!'); } catch {}
          clearInterval(cookCheck);
          furnace.close();
          busy = false;
        }
      }, 1000);
    } catch {
      bot.chat('Hmm... Não consegui usar a fornalha');
      busy = false;
    }
  }

  if (furnaceBlock) {
    goAndCook(furnaceBlock.position);
  } else {
    // fallback: craftar fornalha se tiver material
    bot.chat('Não achei/coloquei fornalha… vou tentar craftar uma!');
    const cobbleId = mcData.itemsByName.cobblestone.id;
    const cobbleCount = bot.inventory.items().filter(i => i.type === cobbleId).reduce((s, i) => s + i.count, 0);
    if (cobbleCount >= 8) {
      const furnaceRecipe = bot.recipesFor(mcData.itemsByName.furnace.id, null, 1)?.[0];
      if (furnaceRecipe) {
        bot.craft(furnaceRecipe, 1, null, async (err) => {
          if (err) bot.chat('não consegui craftar a fornalha');
          else {
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

// ===== Caçar / pegar comida =====
async function huntLoop() {
  busy = true;

  async function tryToHarvestFood() {
    const foodBlock = bot.findBlock({
      matching: block => block.name.includes('wheat') || block.name.includes('melon'),
      maxDistance: 32
    });
    if (foodBlock) {
      bot.chat('Achei plantações, vou colher!');
      const p = foodBlock.position;
      await bot.pathfinder.goto(new GoalNear(p.x, p.y, p.z, 1)).catch(() => {});
      await bot.dig(foodBlock).catch(() => bot.chat('Não consegui colher a plantinha'));
      return true;
    }
    return false;
  }

  async function huntAnimal() {
    const prey = bot.nearestEntity(e =>
      e.type === 'mob' && ['pig', 'cow', 'chicken', 'sheep'].includes(e.name)
    );
    if (prey) {
      laisMemory.lastAction = `Caçando ${prey.name} 🐷`;
      bot.chat(`Achei um ${prey.name}, indo caçar!`);
      await bot.pathfinder.goto(new GoalFollow(prey, 1)).catch(() => {});
      const deathPos = prey.position.clone();

      while (prey?.isValid) {
        await bot.lookAt(prey.position, true).catch(() => {});
        bot.attack(prey);
        await bot.waitForTicks(20);
      }

      // andar sobre o local para pegar itens dropados
      await bot.pathfinder.goto(new GoalNear(deathPos.x, deathPos.y, deathPos.z, 1)).catch(() => {});
      bot.chat(`${prey.name} derrotado! Vamos ver se peguei comida...`);
      return true;
    }
    return false;
  }

  // Loop até obter alguma comida no inventário
  for (let i = 0; i < 20; i++) { // limite de tentativas
    const food = bot.inventory.items().find(i =>
      ['beef', 'porkchop', 'chicken', 'mutton', 'apple', 'bread'].some(f => i.name.includes(f))
    );
    if (food) {
      bot.chat('Yay~ Consegui comida!');
      busy = false;
      return;
    }

    if (await tryToHarvestFood()) continue;
    if (await huntAnimal()) continue;

    // Se não encontrar nada, anda aleatoriamente
    const dx = Math.floor(Math.random() * 10 - 5);
    const dz = Math.floor(Math.random() * 10 - 5);
    const target = bot.entity.position.offset(dx, 0, dz);
    bot.chat('Procurando mais comidinhas...');
    await bot.pathfinder.goto(new GoalNear(target.x, target.y, target.z, 1)).catch(() => {});
  }

  busy = false;
}