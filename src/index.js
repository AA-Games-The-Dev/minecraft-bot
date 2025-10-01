const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const config = require('./config');
const createController = require('./bot/controller');

function startBot(customConfig = {}) {
  const mergedConfig = {
    ...config,
    ...customConfig,
    connection: {
      ...config.connection,
      ...(customConfig.connection || {})
    }
  };

  const bot = mineflayer.createBot(mergedConfig.connection);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);

  const controller = createController(bot, { Movements, goals, config: mergedConfig });
  controller.start();

  return { bot, controller };
}

if (require.main === module) {
  startBot();
}

module.exports = {
  startBot
};