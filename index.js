const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Rate limiting básico
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});
app.use(limiter);

// DB (arquivo local)
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Criar tabela
db.prepare(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )
`).run();

// Utilitários
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
function validateEmail(email){ return typeof email === 'string' && emailRe.test(email.trim()); }
function sanitize(s){ return (s && String(s).trim()) || ''; }

// Endpoints
app.post('/subscribe', (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!validateEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    const sname = sanitize(name).slice(0, 200);
    const semail = sanitize(email).toLowerCase().slice(0, 320);

    const insert = db.prepare('INSERT INTO contacts (name, email, created_at) VALUES (?, ?, ?)');
    try {
      const info = insert.run(sname, semail, Date.now());
      return res.status(201).json({ id: info.lastInsertRowid, name: sname, email: semail });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

app.get('/contacts', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, email, created_at FROM contacts ORDER BY created_at DESC').all();
    return res.json(rows.map(r => ({ id: r.id, name: r.name, email: r.email, createdAt: r.created_at })));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post('/delete', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!validateEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    const semail = sanitize(email).toLowerCase();
    const info = db.prepare('DELETE FROM contacts WHERE email = ?').run(semail);
    if (info.changes === 0) return res.status(404).json({ error: 'E-mail não encontrado.' });
    return res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ouvindo na porta ${PORT}`));
