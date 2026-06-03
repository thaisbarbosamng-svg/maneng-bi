// ============================================================
// ManEng BI — Autenticação e Controle de Acesso
// ============================================================

let db, auth, currentUser = null, currentUserData = null;

function initFirebase() {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  db   = firebase.firestore();
  auth = firebase.auth();
}

// Redireciona se não logado
function requireAuth(callback) {
  initFirebase();
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "/maneng-bi/login.html";
      return;
    }
    currentUser = user;
    const snap = await db.collection("usuarios").doc(user.uid).get();
    if (!snap.exists) {
      // auto-cadastro: cria perfil pendente
      await db.collection("usuarios").doc(user.uid).set({
        nome: user.displayName || user.email.split("@")[0],
        email: user.email,
        perfil: "operador",
        status: "pendente",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Cadastro realizado! Aguarde aprovação do administrador.");
      await auth.signOut();
      window.location.href = "/maneng-bi/login.html";
      return;
    }
    currentUserData = snap.data();
    if (currentUserData.status === "pendente") {
      alert("Seu acesso ainda está pendente de aprovação.");
      await auth.signOut();
      window.location.href = "/maneng-bi/login.html";
      return;
    }
    if (currentUserData.status === "inativo") {
      alert("Seu acesso foi desativado. Entre em contato com o administrador.");
      await auth.signOut();
      window.location.href = "/maneng-bi/login.html";
      return;
    }
    if (callback) callback(currentUserData);
  });
}

// Verifica permissão mínima
function temPermissao(nivelMinimo) {
  if (!currentUserData) return false;
  const perfil = PERFIS[currentUserData.perfil];
  return perfil && perfil.nivel >= nivelMinimo;
}

// Verifica se pode fazer transição
function podeTransicionar(de, para) {
  if (!currentUserData) return false;
  const chave = `${de}->${para}`;
  const roles = TRANSITION_ROLES[chave] || [];
  return roles.includes(currentUserData.perfil);
}

// Logout
async function logout() {
  await auth.signOut();
  window.location.href = "/maneng-bi/login.html";
}

// Renderiza menu com usuário logado
function renderMenu(paginaAtiva) {
  const nome = currentUserData?.nome || currentUser?.email || "";
  const perfil = PERFIS[currentUserData?.perfil]?.label || currentUserData?.perfil || "";
  const menuHtml = `
    <div class="sidebar-user">
      <div class="user-avatar">${nome.charAt(0).toUpperCase()}</div>
      <div>
        <div class="user-name">${nome}</div>
        <div class="user-role">${perfil}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <a href="/maneng-bi/dashboard.html" class="${paginaAtiva==='dashboard'?'active':''}">
        <span class="nav-icon">📊</span> Dashboard
      </a>
      <a href="/maneng-bi/cronograma.html" class="${paginaAtiva==='cronograma'?'active':''}">
        <span class="nav-icon">📅</span> Cronograma
      </a>
      <a href="/maneng-bi/os.html" class="${paginaAtiva==='os'?'active':''}">
        <span class="nav-icon">🔧</span> Ordens de Serviço
      </a>
      <a href="/maneng-bi/clientes.html" class="${paginaAtiva==='clientes'?'active':''}">
        <span class="nav-icon">🏪</span> Clientes
      </a>
      <a href="/maneng-bi/equipes.html" class="${paginaAtiva==='equipes'?'active':''}">
        <span class="nav-icon">👥</span> Equipes
      </a>
      ${currentUserData?.perfil==='auditor'||currentUserData?.perfil==='admin'?`
      <a href="/maneng-bi/auditoria.html" class="${paginaAtiva==='auditoria'?'active':''}">
        <span class="nav-icon">🔍</span> Auditoria
      </a>`:''}
      ${currentUserData?.perfil==='admin'?`
      <a href="/maneng-bi/usuarios.html" class="${paginaAtiva==='usuarios'?'active':''}">
        <span class="nav-icon">👤</span> Usuários
      </a>`:''}
      <a href="/maneng-bi/logs.html" class="${paginaAtiva==='logs'?'active':''}">
        <span class="nav-icon">📋</span> Logs
      </a>
    </nav>
    <div class="sidebar-footer">
      <button onclick="logout()" class="btn-logout">Sair</button>
    </div>
  `;
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.innerHTML = menuHtml;
}

// Registra log de alteração
async function registrarLog(modulo, registroId, campo, valorAnterior, valorNovo) {
  if (!currentUser) return;
  await db.collection("logs").add({
    usuario: currentUserData?.nome || currentUser.email,
    usuarioId: currentUser.uid,
    modulo,
    registroId: registroId || "",
    campo,
    valorAnterior: String(valorAnterior || ""),
    valorNovo: String(valorNovo || ""),
    dataHora: firebase.firestore.FieldValue.serverTimestamp()
  });
}
