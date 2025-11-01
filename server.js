const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    votes: {},
    progress: {},
    notes: {},
    publicNotes: {},
    ranking: {}
  }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve frontend files

// votes
app.get('/api/votes', (req, res) => {
  res.json(readDB().votes || {});
});
app.post('/api/votes', (req, res) => {
  const { user, house, cat } = req.body;
  if (!user || !house || !cat) return res.status(400).json({ error: 'missing' });
  const db = readDB();
  db.votes[house] = db.votes[house] || {};
  db.votes[house][cat] = db.votes[house][cat] || { count: 0, voters: [] };
  if (db.votes[house][cat].voters.includes(user)) {
    return res.status(409).json({ ok: false, message: 'already voted' });
  }
  db.votes[house][cat].voters.push(user);
  db.votes[house][cat].count = (db.votes[house][cat].count || 0) + 1;
  writeDB(db);
  res.json({ ok: true, votes: db.votes[house][cat] });
});
app.get('/api/top', (req, res) => {
  const limit = parseInt(req.query.limit || '5', 10);
  const db = readDB();
  const totals = {};
  // include houses with zero if requested by client-side
  Object.entries(db.votes || {}).forEach(([house, byCat]) => {
    totals[house] = Object.values(byCat).reduce((s,c)=> s + (c.count||0), 0);
  });
  const arr = Object.entries(totals).sort((a,b)=> b[1] - a[1]).slice(0, limit);
  res.json(arr);
});

// progress
app.get('/api/progress/:user', (req, res) => {
  const db = readDB();
  res.json(db.progress[req.params.user] || []);
});
app.post('/api/progress/:user', (req, res) => {
  const houses = Array.isArray(req.body.houses) ? req.body.houses : [];
  const db = readDB();
  db.progress[req.params.user] = houses;
  writeDB(db);
  res.json({ ok: true });
});

// notes (per-user) + public notes
app.get('/api/notes/:user', (req, res) => {
  const db = readDB();
  res.json(db.notes[req.params.user] || {});
});
app.post('/api/notes/:user', (req, res) => {
  const data = req.body || {};
  const db = readDB();
  db.notes[req.params.user] = data;
  writeDB(db);
  res.json({ ok: true });
});
app.get('/api/publicNotes', (req, res) => {
  const db = readDB();
  res.json(db.publicNotes || {});
});
app.post('/api/publicNotes', (req, res) => {
  const { house, category, text, user } = req.body;
  if (!house || !category || !text || !user) return res.status(400).json({ error: 'missing' });
  const db = readDB();
  db.publicNotes[house] = db.publicNotes[house] || {};
  db.publicNotes[house][category] = db.publicNotes[house][category] || [];
  db.publicNotes[house][category].push({ user, text, date: Date.now() });
  writeDB(db);
  res.json({ ok: true });
});

// ranking
app.get('/api/ranking', (req, res) => {
  const db = readDB();
  res.json(db.ranking || {});
});
app.post('/api/ranking', (req, res) => {
  const { user, score } = req.body;
  if (!user || typeof score !== 'number') return res.status(400).json({ error: 'missing' });
  const db = readDB();
  db.ranking[user] = score;
  writeDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));