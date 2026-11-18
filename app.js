/* Banco Demo – simulador ficticio para CyberGuard Cloud. JavaScript puro. */
'use strict';

/* ================= CONFIGURACIÓN (ajusta aquí si tu API difiere) ================= */
const CONFIG = {
  API_URL: 'http://localhost:8080/api/events',
  SOURCE: 'BANK_SIMULATION',
  DEFAULT_IP: '192.168.1.50',      // IP ficticia del cliente demo (el navegador no puede conocer su IP real)
  ATTACKER_IP: '203.0.113.45',     // Rango de documentación (RFC 5737), no es una IP real
  TIMEOUT_MS: 5000,
  TRANSFER_LIMIT: 5000,
  MAX_ATTEMPTS: 5
};

/* ================= MODO DE EJECUCIÓN =================
   laboratorio: la página se sirve desde localhost / 127.0.0.1 (Live Server) -> envía eventos a la API local.
   público: cualquier otro origen (GitHub Pages, file://...) -> todo se simula en el navegador y
   NO se hace ninguna petición de red. */
const MODE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'lab' : 'public';

/* Construye el cuerpo JSON. Si tu endpoint espera otros nombres de campo,
   cámbialos SOLO aquí. "source" se envía como campo y como prefijo en la
   descripción: si el backend ignora campos desconocidos, el origen sigue visible. */
function buildPayload(ev) {
  return {
    eventType: ev.eventType,
    username: ev.username,
    sourceIp: ev.sourceIp,
    severity: ev.severity,
    description: '[' + CONFIG.SOURCE + '] ' + ev.description,
    source: CONFIG.SOURCE
  };
}

/* ================= ESTADO ================= */
const DEMO_USER = { username: 'cliente_demo', password: 'Demo1234' };
const state = {
  user: null,
  balance: 8500.00,
  failedLogins: 0,
  profile: { name: 'Carla Ríos Demo', email: 'carla.demo@bancodemo.test', phone: '999 000 111' },
  movements: [
    { date: '2026-11-17', type: 'Depósito',      desc: 'Abono de sueldo ficticio',   amount:  3200.00, status: 'Completado' },
    { date: '2026-11-15', type: 'Pago',          desc: 'Servicio de internet',       amount:  -129.90, status: 'Completado' },
    { date: '2026-11-12', type: 'Transferencia', desc: 'Envío a cuenta ficticia',    amount:  -450.00, status: 'Completado' },
    { date: '2026-11-10', type: 'Retiro',        desc: 'Cajero demo',                amount:  -200.00, status: 'Completado' },
    { date: '2026-11-05', type: 'Depósito',      desc: 'Reembolso de comercio demo', amount:    85.50, status: 'Completado' }
  ]
};

/* ================= UTILIDADES ================= */
const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? '-' : '') + 'S/ ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Todo texto de usuario se inserta con textContent (nunca innerHTML).
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
function showMsg(node, text, ok) {
  node.textContent = text;
  node.className = 'msg ' + (ok ? 'ok' : 'bad');
  node.hidden = false;
}

/* ================= ENVÍO DE EVENTOS ================= */
function setApiStatus(ok, text) {
  const box = $('api-status');
  box.classList.remove('ok', 'fail');
  box.classList.add(ok ? 'ok' : 'fail');
  $('api-status-text').textContent = text;
  setBanner(ok ? 'ok' : 'fail');
}

const BANNER_TEXT = {
  public: 'Banco Demo es una plataforma ficticia de demostración. Modo público: los datos son ficticios y las simulaciones se ejecutan solo en tu navegador; no se envía información a ningún servidor.',
  lab: 'Banco Demo es una plataforma ficticia. Modo laboratorio: los eventos se enviarán a CyberGuard Cloud (API local).',
  ok: 'Banco Demo es una plataforma ficticia. Modo laboratorio: conectado a CyberGuard Cloud (API local).',
  fail: 'Banco Demo es una plataforma ficticia. Modo laboratorio no conectado: no se pudo contactar con la API local. Inicia cyberguard-api en el puerto 8080.'
};
function setBanner(kind) {
  document.querySelectorAll('.mode-banner').forEach((b) => {
    b.textContent = BANNER_TEXT[kind];
    b.className = 'mode-banner ' + (kind === 'fail' ? 'fail' : kind === 'public' ? 'public' : 'lab');
  });
}
function note(r) {
  if (r.local) return 'Evento simulado localmente (demostración: no se envía a ningún servidor).';
  return r.ok ? 'Evento registrado en CyberGuard Cloud local.' : 'Modo laboratorio no conectado: evento NO enviado (' + r.error + ').';
}

function logEvent(ev, result) {
  const li = el('li');
  li.append(
    el('span', new Date().toLocaleTimeString('es-PE'), 'muted small'),
    el('span', ev.eventType, 'tag'),
    el('span', ev.severity, 'tag'),
    el('span', result.local ? 'demo local (no enviado)' : result.ok ? 'enviado ' + result.status : 'error: ' + result.error, 'tag ' + (result.local ? '' : result.ok ? 'sent' : 'fail')),
    el('span', clip(ev.description, 90))
  );
  const list = $('event-log');
  list.prepend(li);
  while (list.children.length > 40) list.lastChild.remove();
}

async function sendEvent(ev) {
  const event = Object.assign({ username: state.user || 'anonimo', sourceIp: CONFIG.DEFAULT_IP }, ev);
  if (MODE !== 'lab') {                      // modo público: nunca se llama a fetch
    const local = { ok: true, local: true, status: 'demo' };
    logEvent(event, local);
    return local;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
  let result;
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(event)),
      signal: ctrl.signal
    });
    result = res.ok ? { ok: true, status: res.status }
                    : { ok: false, error: 'HTTP ' + res.status };
  } catch (err) {
    result = { ok: false, error: err.name === 'AbortError' ? 'tiempo agotado' : 'sin conexión / CORS' };
  } finally {
    clearTimeout(timer);
  }
  setApiStatus(result.ok, result.ok ? 'Laboratorio conectado' : 'Laboratorio no conectado'); 
  logEvent(event, result);
  return result;
}

/* ================= NAVEGACIÓN ================= */
const TITLES = { dashboard: 'Panel principal', transfers: 'Transferencias', movements: 'Movimientos', profile: 'Perfil', admin: 'Administración', lab: 'Laboratorio de pruebas' };

function go(section) {
  if (!state.user) return;
  document.querySelectorAll('.section').forEach((s) => (s.hidden = true));
  $('sec-' + section).hidden = false;
  document.querySelectorAll('.nav-item[data-section]').forEach((b) =>
    b.classList.toggle('active', b.dataset.section === section));
  $('topbar-title').textContent = TITLES[section];
  $('sidebar').classList.remove('open');
  if (section === 'admin') {
    sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', severity: 'HIGH', description: 'Intento de acceso a la sección restringida Administración' });
  }
}

/* ================= RENDER ================= */
function renderMovements() {
  const body = $('movements-body');
  body.replaceChildren();
  state.movements.forEach((m) => {
    const tr = el('tr');
    const st = el('td'); st.append(el('span', m.status, 'badge ' + (m.status === 'Completado' ? 'ok' : m.status === 'Rechazado' ? 'bad' : 'warn')));
    tr.append(el('td', m.date), el('td', m.type), el('td', m.desc), el('td', money(m.amount), 'r ' + (m.amount < 0 ? 'neg' : 'pos')), st);
    body.append(tr);
  });
  const list = $('recent-list');
  list.replaceChildren();
  state.movements.slice(0, 4).forEach((m) => {
    const li = el('li');
    li.append(el('span', m.desc), el('span', money(m.amount), m.amount < 0 ? 'neg' : 'pos'));
    list.append(li);
  });
}
function renderProfile() {
  $('p-name').value = state.profile.name;
  $('p-email').value = state.profile.email;
  $('p-phone').value = state.profile.phone;
  $('welcome-name').textContent = state.profile.name.split(' ')[0];
}
function addMovement(m) {
  state.movements.unshift(Object.assign({ date: new Date().toISOString().slice(0, 10) }, m));
  renderMovements();
}

/* ================= VALIDACIÓN (lista blanca; el backend debe repetirla) ================= */
const SQLI = /('|")\s*(or|and)\s+.+=|;\s*(drop|delete|insert|update)\b|\bunion\s+select\b|--\s*$|\/\*/i;
const XSS  = /<\s*\/?\s*(script|img|iframe|svg|object|embed)\b|on\w+\s*=|javascript:/i;
const isSuspicious = (s) => SQLI.test(s) || XSS.test(s);
const ACCOUNT_RE = /^\d{3}-\d{7}-\d-\d{2}$/;

/* ================= LOGIN / LOGOUT ================= */
async function onLogin(e) {
  e.preventDefault();
  const u = $('username').value.trim();
  const p = $('password').value;
  const err = $('login-error');
  err.hidden = true;

  if (!u || !p) { err.textContent = 'Completa usuario y contraseña.'; err.hidden = false; return; }
  if (!/^[A-Za-z0-9_]{3,40}$/.test(u)) {
    err.textContent = 'Usuario no válido.'; err.hidden = false;
    sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', username: 'invalido', severity: 'MEDIUM', description: 'Formato de usuario inválido en el login: ' + clip(u, 40) });
    return;
  }
  if (state.failedLogins >= CONFIG.MAX_ATTEMPTS) {
    err.textContent = 'Cuenta bloqueada temporalmente por demasiados intentos (recarga la página para reiniciar la demo).'; err.hidden = false;
    return;
  }
  if (u === DEMO_USER.username && p === DEMO_USER.password) {
    state.user = u; state.failedLogins = 0;
    $('password').value = '';
    $('login-view').hidden = true; $('app-view').hidden = false;
    renderProfile(); renderMovements(); go('dashboard');
    sendEvent({ eventType: 'LOGIN_SUCCESS', username: u, severity: 'LOW', description: 'Inicio de sesión exitoso' });
  } else {
    state.failedLogins++;
    err.textContent = 'Usuario o contraseña incorrectos (' + state.failedLogins + '/' + CONFIG.MAX_ATTEMPTS + ').'; err.hidden = false;
    sendEvent({ eventType: 'LOGIN_FAILURE', username: u, severity: state.failedLogins >= 3 ? 'HIGH' : 'MEDIUM', description: 'Intento de inicio de sesión fallido #' + state.failedLogins });
  }
}
function onLogout() {
  const u = state.user;
  sendEvent({ eventType: 'LOGOUT', username: u, severity: 'LOW', description: 'Cierre de sesión' });
  state.user = null;
  $('app-view').hidden = true; $('login-view').hidden = false;
  $('username').value = '';
}

/* ================= OPERACIONES ================= */
function onBalance() {
  $('balance-amount').textContent = money(state.balance);
  sendEvent({ eventType: 'BALANCE_INQUIRY', severity: 'LOW', description: 'Consulta de saldo' });
}

function onTransfer(e) {
  e.preventDefault();
  const msg = $('transfer-msg');
  const dest = $('t-dest').value.trim();
  const amount = Number($('t-amount').value);
  const desc = $('t-desc').value.trim();

  if (!ACCOUNT_RE.test(dest)) return showMsg(msg, 'Cuenta de destino inválida. Formato: 191-1234567-0-99', false);
  if (!(amount > 0)) return showMsg(msg, 'Ingresa un monto mayor a cero.', false);
  if (!desc) return showMsg(msg, 'Ingresa una descripción.', false);
  if (isSuspicious(desc)) {
    sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', severity: 'HIGH', description: 'Entrada sospechosa bloqueada en descripción de transferencia: ' + clip(desc, 80) });
    return showMsg(msg, 'Descripción rechazada por contener caracteres no permitidos.', false);
  }
  if (amount > CONFIG.TRANSFER_LIMIT) {
    addMovement({ type: 'Transferencia', desc: desc, amount: -amount, status: 'Rechazado' });
    sendEvent({ eventType: 'TRANSACTION_SIMULATED', severity: 'HIGH', description: 'Transferencia rechazada: ' + money(amount) + ' excede el límite de ' + money(CONFIG.TRANSFER_LIMIT) });
    return showMsg(msg, 'Monto superior al límite permitido. Operación rechazada.', false);
  }
  if (amount > state.balance) return showMsg(msg, 'Saldo insuficiente.', false);

  state.balance -= amount;
  addMovement({ type: 'Transferencia', desc: desc, amount: -amount, status: 'Completado' });
  sendEvent({ eventType: 'TRANSACTION_SIMULATED', severity: amount > 2500 ? 'MEDIUM' : 'LOW', description: 'Transferencia simulada de ' + money(amount) + ' a ' + dest });
  showMsg(msg, 'Transferencia simulada de ' + money(amount) + ' realizada. Código: SIM-' + Date.now().toString(36).toUpperCase(), true);
  $('balance-amount').textContent = 'S/ ••••';
  e.target.reset();
}

function onProfile(e) {
  e.preventDefault();
  const msg = $('profile-msg');
  const name = $('p-name').value.trim(), email = $('p-email').value.trim(), phone = $('p-phone').value.trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^[\d\s+()-]{6,20}$/.test(phone)) return showMsg(msg, 'Revisa nombre, correo y teléfono.', false);
  if ([name, email, phone].some(isSuspicious)) {
    sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', severity: 'HIGH', description: 'Entrada sospechosa bloqueada en perfil' });
    return showMsg(msg, 'Datos rechazados por contener caracteres no permitidos.', false);
  }
  state.profile = { name, email, phone };
  $('welcome-name').textContent = name.split(' ')[0];
  sendEvent({ eventType: 'PROFILE_CHANGE', severity: 'MEDIUM', description: 'Datos de perfil actualizados (simulado)' });
  showMsg(msg, 'Cambios guardados (simulado).', true);
}

/* ================= LABORATORIO ================= */
const out = (t) => { $('lab-output').textContent = t; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIMS = {
  async bruteforce() {
    out('Enviando 5 intentos fallidos…');
    let ok = 0;
    for (let i = 1; i <= 5; i++) {
      const r = await sendEvent({ eventType: 'LOGIN_FAILURE', username: 'cliente_demo', sourceIp: CONFIG.ATTACKER_IP, severity: i >= 3 ? 'HIGH' : 'MEDIUM', description: 'Simulación de fuerza bruta: intento fallido ' + i + '/5' });
      if (r.ok) ok++;
      await sleep(250);
    }
    out('Simulación 1 completa. ' + (MODE === 'lab' ? 'Eventos aceptados por la API: ' + ok + '/5.' + (ok < 5 ? ' Modo laboratorio no conectado.' : '') : '5 intentos simulados localmente (demostración, no se envía nada).'));
  },
  async restricted() {
    const r = await sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', sourceIp: CONFIG.ATTACKER_IP, severity: 'HIGH', description: 'Simulación: acceso a /admin sin permisos' });
    out('Acceso denegado. ' + note(r));
  },
  async overlimit() {
    const amt = CONFIG.TRANSFER_LIMIT * 4;
    const r = await sendEvent({ eventType: 'TRANSACTION_SIMULATED', severity: 'HIGH', description: 'Simulación: transferencia de ' + money(amt) + ' sobre el límite de ' + money(CONFIG.TRANSFER_LIMIT) + ' (rechazada)' });
    out('Transferencia de ' + money(amt) + ' rechazada por límite. ' + note(r));
  },
  async otheraccount() {
    const r = await sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', severity: 'CRITICAL', description: 'Simulación: intento de modificar datos de la cuenta ficticia 191-9999999-0-00 (no pertenece al usuario)' });
    out('Modificación denegada: la cuenta no pertenece a la sesión. ' + note(r));
  },
  async sql() {
    const probe = "' OR '1'='1' --";
    const blocked = isSuspicious(probe);
    const r = await sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', sourceIp: CONFIG.ATTACKER_IP, severity: 'HIGH', description: 'Simulación: cadena SQL sospechosa rechazada (no se ejecutó SQL): ' + probe });
    out('Entrada recibida (solo texto): ' + probe + '\nResultado: ' + (blocked ? 'RECHAZADA, no se ejecuta ninguna consulta.' : 'no detectada') + '\n' + note(r));
  },
  async xss() {
    const probe = "<script>alert('xss')</script>";
    const r = await sendEvent({ eventType: 'UNAUTHORIZED_ACCESS', sourceIp: CONFIG.ATTACKER_IP, severity: 'HIGH', description: 'Simulación: cadena XSS mostrada como texto, no ejecutada: ' + probe });
    out('Entrada mostrada como texto (no se interpreta HTML):\n' + probe + '\n' + note(r));
  }
};

async function runSim(btn) {
  const fn = SIMS[btn.dataset.sim];
  if (!fn) return;
  document.querySelectorAll('.btn.lab').forEach((b) => (b.disabled = true));
  try { await fn(); } finally { document.querySelectorAll('.btn.lab').forEach((b) => (b.disabled = false)); }
}

/* ================= INICIO ================= */
document.addEventListener('DOMContentLoaded', () => {
  if (MODE === 'lab') {
    setBanner('lab');
    $('api-status-text').textContent = 'Laboratorio: sin probar';
    $('lab-intro').textContent = 'Simulaciones controladas. Solo envían eventos a tu API local (cyberguard-api); no atacan ningún sistema.';
  } else {
    setBanner('public');
    $('api-status-text').textContent = 'Modo público (demo)';
    $('lab-intro').textContent = 'Demostración: las simulaciones se ejecutan solo en tu navegador con datos ficticios. No se envía nada a ningún servidor.';
  }
  $('login-form').addEventListener('submit', onLogin);
  $('logout-btn').addEventListener('click', onLogout);
  $('balance-btn').addEventListener('click', onBalance);
  $('transfer-form').addEventListener('submit', onTransfer);
  $('profile-form').addEventListener('submit', onProfile);
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.querySelectorAll('.nav-item[data-section]').forEach((b) => b.addEventListener('click', () => go(b.dataset.section)));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  document.querySelectorAll('.btn.lab').forEach((b) => b.addEventListener('click', () => runSim(b)));
});
