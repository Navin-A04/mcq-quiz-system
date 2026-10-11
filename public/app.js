const $ = s => document.querySelector(s);
let token = localStorage.getItem('token'), timer, attempt, qi = 0, answers = {}, mode = 'login';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
function show(id) {
  document.querySelectorAll('section').forEach(s => s.hidden = s.id !== id);
  $('#logout').hidden = !token;
}

// ---- Login / Register ----
$('#toggle').onclick = () => {
  mode = mode === 'login' ? 'register' : 'login';
  $('#name').hidden = mode === 'login';
  $('#authBtn').textContent = mode === 'login' ? 'Login' : 'Register';
  $('#toggle').textContent = mode === 'login' ? 'New here? Register' : 'Have an account? Login';
};
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  try {
    const d = await api('/' + mode, 'POST', { name: $('#name').value, email: $('#email').value, password: $('#password').value });
    token = d.token; localStorage.setItem('token', token); $('#authErr').textContent = '';
    loadQuizzes();
    showWelcome(d.name);
  } catch (err) { $('#authErr').textContent = err.message; }
};
$('#logout').onclick = () => { localStorage.removeItem('token'); token = null; show('auth'); };

// ---- Quiz list ----
async function loadQuizzes() {
  try {
    const qs = await api('/quizzes');
    show('quizzes');
    $('#quizList').innerHTML = qs.map(q => `<div class="card"><h3>${esc(q.title)}</h3>
      <p>${q.questions} questions, ${q.time_limit_sec / 60} minutes</p>
      <button onclick="startQuiz(${q.id})">Start quiz</button></div>`).join('');
    const rs = await api('/results');
    $('#history').innerHTML = rs.length
      ? rs.map(r => `<tr><td>${esc(r.title)}</td><td>${r.score}/${r.total}</td><td>${new Date(r.submitted_at).toLocaleString()}</td></tr>`).join('')
      : '<tr><td colspan="3">No attempts yet. Start a quiz above.</td></tr>';
  } catch { localStorage.removeItem('token'); token = null; show('auth'); }
}

// ---- Taking the quiz ----
async function startQuiz(id) {
  attempt = await api(`/quizzes/${id}/start`, 'POST');
  qi = 0; answers = {}; show('quiz');
  let left = attempt.time_limit_sec;
  clearInterval(timer);
  const tick = () => {
    $('#timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('#timer').classList.toggle('low', left <= 30);
    if (left-- <= 0) submit();
  };
  tick(); timer = setInterval(tick, 1000); render();
}
function render() {
  const q = attempt.questions[qi], n = attempt.questions.length;
  $('#progress').textContent = `Question ${qi + 1} of ${n}`;
  $('#question').innerHTML = `<h2>${esc(q.text)}</h2>` + q.options.map(o =>
    `<label class="opt"><input type="radio" name="o" ${answers[q.id] == o.id ? 'checked' : ''}
      onchange="answers[${q.id}]=${o.id}"> ${esc(o.text)}</label>`).join('');
  $('#prev').disabled = qi === 0;
  $('#next').hidden = qi === n - 1;
  $('#submit').hidden = qi !== n - 1;
}
$('#prev').onclick = () => { qi--; render(); };
$('#next').onclick = () => { qi++; render(); };
$('#submit').onclick = () => submit();

async function submit() {
  clearInterval(timer);
  const r = await api(`/attempts/${attempt.attemptId}/submit`, 'POST', { answers });
  show('result');
  $('#score').textContent = `${r.score} / ${r.total}`;
  $('#feedback').textContent = `${r.percent}%. ${r.feedback}`;
  $('#review').innerHTML = r.review.map(x =>
    `<div class="rev ${x.correct ? 'ok' : 'bad'}">${esc(x.text)}${x.correct ? '' : `<br><small>Correct answer: ${esc(x.answer)}</small>`}</div>`).join('');
}
$('#home').onclick = loadQuizzes;
function showWelcome(name) {
  $('#welcomeTitle').textContent = `Welcome, ${name}`;
  $('#welcome').showModal();
}
$('#welcomeClose').onclick = () => $('#welcome').close(); 
token ? loadQuizzes() : show('auth');
