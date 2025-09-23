const createEnvironmentHelpers = require('./environment');
const createEntityHelpers = require('./entities');

function createHelpers(bot, config) {
  const environment = createEnvironmentHelpers(bot);
  const entities = createEntityHelpers(bot, { visionRange: config.visionRange });

  return {
    environment,
    entities
  };
}

module.exports = createHelpers;
