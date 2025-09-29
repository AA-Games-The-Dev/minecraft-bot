const { Vec3 } = require('vec3');

function createEnvironmentHelpers(bot) {
  async function ensureBlockNearby({ findNamePart, invItemName, searchRange = 4 }) {
    let block = bot.findBlock({
      matching: b => b.name.includes(findNamePart),
      maxDistance: searchRange
    });
    if (block) return block;

    const item = bot.inventory.items().find(i => i.name === invItemName);
    if (!item) return null;

    const base = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (!base) return null;

    try {
      await bot.equip(item, 'hand');
    } catch (error) {
      // ignore equip issues and try to place anyway
    }

    const offsets = [
      new Vec3(0, 1, 0),
      new Vec3(1, 1, 0),
      new Vec3(-1, 1, 0),
      new Vec3(0, 1, 1),
      new Vec3(0, 1, -1)
    ];

    for (const offset of offsets) {
      try {
        await bot.placeBlock(base, offset);
        await bot.waitForTicks(8);
        block = bot.findBlock({
          matching: b => b.name.includes(findNamePart),
          maxDistance: searchRange
        });
        if (block) return block;
      } catch (error) {
        // try next offset
      }
    }

    return null;
  }

  return {
    ensureBlockNearby
  };
}

module.exports = createEnvironmentHelpers;
