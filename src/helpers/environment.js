const { Vec3 } = require('vec3');

function createEnvironmentHelpers(bot) {
  async function ensureBlockNearby({ findNamePart, invItemName, searchRange = 4 }) {
    const matching = (block) => block?.name?.includes(findNamePart);
    let block = bot.findBlock({
      matching,
      maxDistance: searchRange
    });
    if (block) return block;

    const item = bot.inventory.items().find(i => i.name === invItemName);
    if (!item) return null;

    const feetPos = bot.entity.position.offset(0, -1, 0).floored();
    const feetBlock = bot.blockAt(feetPos);
    if (!feetBlock) return null;

    try {
      await bot.equip(item, 'hand');
    } catch (error) {
      // ignore equip issues and try to place anyway
    }

    const visited = new Set();
    const candidates = [];
    const effectiveRange = Math.max(1, searchRange);
    const horizontalLimit = Math.max(1, Math.ceil(effectiveRange));

    const addCandidates = (dy, weight) => {
      for (let dx = -horizontalLimit; dx <= horizontalLimit; dx++) {
        for (let dz = -horizontalLimit; dz <= horizontalLimit; dz++) {
          if (dx === 0 && dz === 0) continue;

          const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
          if (horizontalDistance > effectiveRange) continue;

          const pos = feetPos.offset(dx, dy, dz);
          const key = `${pos.x},${pos.y},${pos.z}`;
          if (visited.has(key)) continue;
          visited.add(key);

          candidates.push({
            pos,
            score: horizontalDistance + weight
          });
        }
      }
    };

    addCandidates(0, 0);
    addCandidates(-1, 0.5);
    addCandidates(1, 0.75);

    candidates.sort((a, b) => a.score - b.score);

    const isSolidBase = (block) => block && block.boundingBox === 'block' && block.type !== 0;
    const isReplaceable = (block) => !block || block.type === 0 || block.boundingBox === 'empty';

    for (const { pos } of candidates) {
      const baseBlock = bot.blockAt(pos);
      if (!isSolidBase(baseBlock)) continue;

      const baseName = baseBlock.name || '';
      if (baseName.includes('water') || baseName.includes('lava')) continue;

      const targetPos = pos.offset(0, 1, 0);
      const targetBlock = bot.blockAt(targetPos);
      if (!isReplaceable(targetBlock)) continue;

      const targetName = targetBlock?.name || '';
      if (targetName.includes('water') || targetName.includes('lava')) continue;

      const placeCenter = baseBlock.position.offset(0.5, 1, 0.5);
      if (bot.entity.position.distanceTo(placeCenter) > 4.5) continue;

      try {
        await bot.lookAt(placeCenter, true).catch(() => {});
        await bot.placeBlock(baseBlock, new Vec3(0, 1, 0));
        await bot.waitForTicks(8);

        const placedBlock = bot.blockAt(targetPos);
        if (matching(placedBlock)) return placedBlock;

        block = bot.findBlock({ matching, maxDistance: searchRange });
        if (block) return block;
      } catch (error) {
        // unable to place here, try next candidate
      }
    }

    return bot.findBlock({ matching, maxDistance: searchRange }) || null;
  }

  return {
    ensureBlockNearby
  };
}

module.exports = createEnvironmentHelpers;
