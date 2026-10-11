require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(express.json());
app.use(express.static('public'));

const wrap = f => (req, res) => f(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const sign = u => jwt.sign({ id: u.id, name: u.name }, process.env.JWT_SECRET, { expiresIn: '8h' });
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again' }); }
};

// ---- Auth ----
app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Fill in name, email and password' });
  try {
    const r = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name',
      [name, email, await bcrypt.hash(password, 10)]);
    res.json({ token: sign(r.rows[0]), name });
  } catch { res.status(400).json({ error: 'That email is already registered' }); }
}));

app.post('/api/login', wrap(async (req, res) => {
  const u = (await pool.query('SELECT * FROM users WHERE email=$1', [req.body.email])).rows[0];
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(u), name: u.name });
}));

// ---- Quizzes ----
app.get('/api/quizzes', auth, wrap(async (req, res) => {
  res.json((await pool.query(`SELECT id,title,time_limit_sec,
    (SELECT COUNT(*) FROM questions WHERE quiz_id=quizzes.id) AS questions FROM quizzes ORDER BY id`)).rows);
}));

app.post('/api/quizzes/:id/start', auth, wrap(async (req, res) => {
  const quiz = (await pool.query('SELECT * FROM quizzes WHERE id=$1', [req.params.id])).rows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const at = await pool.query('INSERT INTO attempts(user_id,quiz_id) VALUES($1,$2) RETURNING id', [req.user.id, quiz.id]);
  // Correct answers are never sent to the browser
  const qs = await pool.query(`SELECT q.id,q.text,
      json_agg(json_build_object('id',o.id,'text',o.text) ORDER BY random()) AS options
    FROM questions q JOIN options o ON o.question_id=q.id
    WHERE q.quiz_id=$1 GROUP BY q.id ORDER BY random()`, [quiz.id]);
  res.json({ attemptId: at.rows[0].id, time_limit_sec: quiz.time_limit_sec, questions: qs.rows });
}));

app.post('/api/attempts/:id/submit', auth, wrap(async (req, res) => {
  const a = (await pool.query(`SELECT a.*, q.time_limit_sec FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
    WHERE a.id=$1 AND a.user_id=$2 AND a.submitted_at IS NULL`, [req.params.id, req.user.id])).rows[0];
  if (!a) return res.status(404).json({ error: 'Attempt not found or already submitted' });
  // Server-side time check (15s grace) so the timer can't be cheated
  const late = (Date.now() - new Date(a.started_at)) / 1000 > a.time_limit_sec + 15;
  const answers = late ? {} : (req.body.answers || {});
  const qs = (await pool.query(`SELECT q.id,q.text,o.id AS oid,o.text AS otext FROM questions q
    JOIN options o ON o.question_id=q.id AND o.is_correct WHERE q.quiz_id=$1 ORDER BY q.id`, [a.quiz_id])).rows;
  const review = qs.map(q => ({ text: q.text, answer: q.otext, correct: answers[q.id] == q.oid }));
  const score = review.filter(r => r.correct).length, total = qs.length;
  const percent = Math.round(score * 100 / total);
  await pool.query('UPDATE attempts SET submitted_at=now(), score=$1, total=$2 WHERE id=$3', [score, total, a.id]);
  res.json({ score, total, percent, review,
    feedback: percent >= 80 ? 'Excellent work.' : percent >= 50 ? 'Good effort. Review the missed questions.' : 'Needs practice. Check the answers below.' });
}));

app.get('/api/results', auth, wrap(async (req, res) => {
  res.json((await pool.query(`SELECT a.score,a.total,a.submitted_at,q.title FROM attempts a
    JOIN quizzes q ON q.id=a.quiz_id WHERE a.user_id=$1 AND a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC LIMIT 10`, [req.user.id])).rows);
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Quiz running at http://localhost:${port}`));
