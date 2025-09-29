const { createState } = require('../state');
const createHelpers = require('../helpers');
const createActions = require('../actions');
const createInterpreter = require('../decisions/interpreter');
const createContextDecision = require('../decisions/context');
const createChatDecision = require('../decisions/chat');

function createController(bot, { Movements, goals, config }) {
  const state = createState();
  const helpers = createHelpers(bot, config);
  const actions = createActions(bot, state, helpers, goals);
  const interpretReply = createInterpreter(bot, state, actions, helpers, goals);
  const checkContextAndDecide = createContextDecision(bot, state, actions, helpers, config, interpretReply);

  function setupSpawn() {
    bot.once('spawn', () => {
      state.movements = new Movements(bot);
      bot.pathfinder.setMovements(state.movements);
      setInterval(() => {
        checkContextAndDecide();
      }, config.intervals.contextCheckMs);
    });
  }

  function setupBehaviorLoop() {
    setInterval(() => {
      if (state.busy) return;

      if (state.currentMode === 'mining') {
        if (state.task === 'stone') {
          actions.mineStone();
        } else if (state.task === 'wood') {
          actions.collectWood();
        }
      }

      if (state.currentMode === 'follow') {
        const target =
          (state.memory.lastSpeaker && bot.players[state.memory.lastSpeaker]?.entity) ||
          helpers.entities.getNearestPlayerEntity();
        if (target) {
          bot.pathfinder.setGoal(new goals.GoalFollow(target, 1));
        }
      }

      if (state.currentMode === 'patrol') {
        const hostile = bot.nearestEntity(helpers.entities.isHostileMob);
        if (hostile) {
          actions.attackMob(hostile);
        } else {
          state.currentMode = 'idle';
          bot.pathfinder.setGoal(null);
        }
      }
    }, config.intervals.behaviorLoopMs);
  }

  function setupPhysicsLook() {
    bot.on('physicsTick', () => {
      if (state.currentMode !== 'idle') return;
      const targetPos = helpers.entities.getBestLookTarget();
      if (targetPos) bot.lookAt(targetPos).catch(() => {});
    });
  }

  function setupDamageReaction() {
    bot.on('entityHurt', (entity) => {
      if (entity !== bot.entity) return;

      const hostile = bot.nearestEntity(helpers.entities.isHostileMob);
      if (hostile) {
        state.memory.lastAction = 'Reagindo a ataque!';
        state.currentMode = 'patrol';
        actions.attackMob(hostile);
      }
      if (bot.entity.onFire || bot.entity.position.y < 0) {
        bot.setControlState('jump', true);
        bot.setControlState('forward', true);
        bot.look(bot.entity.yaw + Math.PI, 0);
        setTimeout(() => bot.clearControlStates(), 2000);
      }
    });
  }

  function start() {
    setupSpawn();
    setupBehaviorLoop();
    setupPhysicsLook();
    setupDamageReaction();
    createChatDecision(bot, state, interpretReply, config);
  }

  return {
    actions,
    helpers,
    interpretReply,
    start,
    state
  };
}

module.exports = createController;
