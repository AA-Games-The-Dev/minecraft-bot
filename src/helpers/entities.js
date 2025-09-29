function createEntityHelpers(bot, { visionRange }) {
  function isHostileMob(entity) {
    return (
      (entity.type === 'hostile' || entity.type === 'mob') &&
      entity.displayName !== 'Armor Stand' &&
      entity.position.distanceTo(bot.entity.position) < visionRange
    );
  }

  function isHostileMobNearby() {
    return bot.nearestEntity(isHostileMob) !== null;
  }

  function getNearestPlayerEntity() {
    let nearest = null;
    let minDist = Infinity;

    for (const [name, player] of Object.entries(bot.players)) {
      if (!player.entity || name === bot.username) continue;
      const distance = player.entity.position.distanceTo(bot.entity.position);
      if (distance < minDist) {
        minDist = distance;
        nearest = player.entity;
      }
    }

    return nearest;
  }

  function getBestLookTarget() {
    const entities = Object.values(bot.entities);
    const players = Object.values(bot.players).filter(p => p.entity);
    let nearest = null;
    let minDist = Infinity;

    const checkTarget = (position) => {
      const distance = bot.entity.position.distanceTo(position);
      if (distance < minDist && distance <= visionRange) {
        minDist = distance;
        nearest = position;
      }
    };

    for (const entity of entities) {
      if (['hostile', 'mob'].includes(entity.type)) {
        const position = entity.position.clone();
        position.y += entity.height || 1.6;
        checkTarget(position);
      }
      if (entity.name === 'item') {
        const position = entity.position.clone();
        position.y += 0.5;
        checkTarget(position);
      }
    }

    for (const player of players) {
      if (player.username === bot.username) continue;
      const position = player.entity.position.clone();
      position.y += 1.6;
      checkTarget(position);
    }

    return nearest;
  }

  return {
    getBestLookTarget,
    getNearestPlayerEntity,
    isHostileMob,
    isHostileMobNearby
  };
}

module.exports = createEntityHelpers;