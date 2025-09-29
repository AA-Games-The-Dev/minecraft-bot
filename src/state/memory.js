function createMemory() {
  return {
    lastAction: null,
    lastSpeaker: null,
    lastItemGiven: null
  };
}

module.exports = createMemory;
