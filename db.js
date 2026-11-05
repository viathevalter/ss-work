const fs = require('fs');
const path = require('path');
const os = require('os');

const seedPath = path.join(__dirname, 'data', 'seed.json');
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const runtimePath = isVercel
  ? path.join(os.tmpdir(), 'ss_work_db.json')
  : path.join(__dirname, 'data', 'ss_work_db.json');

let memoryStore = null;

function loadStore() {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(runtimePath)) {
      memoryStore = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
      return memoryStore;
    }
  } catch (_) {}

  try {
    memoryStore = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch (_) {
    memoryStore = { empresas: [], trabalhadores: [], comunicacoes: [] };
  }
  saveStore(memoryStore);
  return memoryStore;
}

function saveStore(data) {
  memoryStore = data;
  try {
    fs.writeFileSync(runtimePath, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (_) {}
}

function nextId(arr) {
  return arr.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

module.exports = {
  loadStore,
  saveStore,
  nextId
};
