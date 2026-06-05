let auth, currentUser = null, currentUserData = null;

function initFirebase() {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
}

function requireAuth(callback) {
  initFirebase();
  auth.onAuthStateChanged(user => {
    if (!user) { window.location.href = "/maneng-bi/login.html"; return; }
    currentUser = user;
    currentUserData = { nome: user.displayName || user.email.split("@")[0], email: user.email, perfil: "admin", status: "ativo" };
    if (callback) callback(currentUserData);
  });
}

async function logout() {
  await auth.signOut();
  window.location.href = "/maneng-bi/login.html";
}

function renderMenu(paginaAtiva) {
  const nome = currentUserData?.nome || "";
  document.getElementById("sidebar").innerHTML = `
    <div class="sidebar-user">
      <div class="user-avatar">${nome.charAt(0).toUpperCase()}</div>
      <div><div class="user-name">${nome}</div><div class="user-role">Administrador</div></div>
    </div>
    <nav class="sidebar-nav">
      <a href="/maneng-bi/dashboard.html"  class="${paginaAtiva==='dashboard' ?'active':''}"><span class="nav-icon">📊</span> Dashboard</a>
      <a href="/maneng-bi/cronograma.html" class="${paginaAtiva==='cronograma'?'active':''}"><span class="nav-icon">📅</span> Cronograma</a>
      <a href="/maneng-bi/os.html"         class="${paginaAtiva==='os'        ?'active':''}"><span class="nav-icon">🔧</span> Ordens de Serviço</a>
      <a href="/maneng-bi/clientes.html"   class="${paginaAtiva==='clientes'  ?'active':''}"><span class="nav-icon">🏪</span> Clientes</a>
      <a href="/maneng-bi/equipes.html"    class="${paginaAtiva==='equipes'   ?'active':''}"><span class="nav-icon">👥</span> Equipes</a>
      <a href="/maneng-bi/alertas.html"    class="${paginaAtiva==='alertas'   ?'active':''}" style="color:#FF9900"><span class="nav-icon">⚠️</span> Alertas</a>
      <a href="/maneng-bi/auditoria.html"  class="${paginaAtiva==='auditoria' ?'active':''}"><span class="nav-icon">🔍</span> Auditoria</a>
    </nav>
    <div class="sidebar-footer"><button onclick="logout()" class="btn-logout">Sair</button></div>`;
}

async function carregarDados() {
  const resp = await fetch("/maneng-bi/data/ordens_servico.json?t=" + Date.now());
  if (!resp.ok) throw new Error("Arquivo de dados não encontrado. Execute a sincronização no GitHub Actions.");
  const json = await resp.json();
  return json.registros || [];
}

function normalizarStatus(s) {
  if (!s) return "PROGRAMADO";
  const m = {"PROGRAMADA":"PROGRAMADO","CONCLUIDO":"CONCLUIDA","VALIDADO":"VALIDADA","AUDITADO":"AUDITADA","FATURADO":"FATURADA"};
  const u = s.toString().trim().toUpperCase();
  return m[u] || u;
}

function statusChip(status) {
  const st = normalizarStatus(status);
  const cfg = STATUS_CONFIG[st] || { cor: "#999", texto: "#fff" };
  return `<span class="status-chip" style="background:${cfg.cor};color:${cfg.texto}">${st}</span>`;
}

function fmtData(str) { return str || "—"; }

function calcularIndicadores(lista) {
  const total = lista.length;
  const OK    = ["CONCLUIDA","VALIDADA","AUDITADA","FATURADA","CONFORME CRONOGRAMA"];
  const PROG  = ["PROGRAMADA","PROGRAMADO"];
  const EX    = ["EM EXECUÇÃO","EM EXECUCAO"];
  const concluidas  = lista.filter(o => OK.includes(normalizarStatus(o.status))).length;
  const emAtraso    = lista.filter(o => normalizarStatus(o.status) === "EM ATRASO").length;
  const emExecucao  = lista.filter(o => EX.includes(normalizarStatus(o.status))).length;
  const programadas = lista.filter(o => PROG.includes(normalizarStatus(o.status))).length;
  const semEquipe   = lista.filter(o => normalizarStatus(o.status) === "SEM EQUIPE").length;
  const taxaConclusao = total > 0 ? ((concluidas / total) * 100).toFixed(2) : 0;
  return { total, concluidas, emAtraso, emExecucao, programadas, semEquipe, taxaConclusao, pctCumprido: 100, pctAlterado: 0 };
}

function porSupervisor(lista) {
  const OK = ["CONCLUIDA","VALIDADA","AUDITADA","FATURADA","CONFORME CRONOGRAMA"];
  const m  = {};
  lista.forEach(os => {
    const s = os.supervisao || "Sem Supervisor";
    if (!m[s]) m[s] = { supervisao: s, programadas:0, concluidas:0, emExecucao:0, emAtraso:0, semEquipe:0 };
    const st = normalizarStatus(os.status);
    if (["PROGRAMADA","PROGRAMADO"].includes(st)) m[s].programadas++;
    else if (OK.includes(st)) m[s].concluidas++;
    else if (["EM EXECUÇÃO","EM EXECUCAO"].includes(st)) m[s].emExecucao++;
    else if (st === "EM ATRASO") m[s].emAtraso++;
    else if (st === "SEM EQUIPE") m[s].semEquipe++;
  });
  return Object.values(m).sort((a,b) => b.concluidas - a.concluidas);
}

function popularSelect(id, lista, campo, ph) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const v = [...new Set(lista.map(i => i[campo]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${ph}</option>` + v.map(x => `<option value="${x}">${x}</option>`).join("");
}

function exportarExcel(dados, nome) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Dados");
  XLSX.writeFile(wb, `${nome}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function toast(msg, tipo="sucesso") {
  const t = document.createElement("div");
  t.className = `toast toast-${tipo}`; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}
