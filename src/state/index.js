const createMemory = require('./memory');

function createState() {
  return {
    currentMode: 'idle',
    movements: null,
    lastReplyTime: 0,
    blockAutoDecisionUntil: 0,
    busy: false,
    task: null,
    memory: createMemory()
  };
}

module.exports = {
  createState
};
