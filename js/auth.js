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
      <a href="/maneng-bi/auditoria.html"  class="${paginaAtiva==='auditoria' ?'active':''}"><span class="nav-icon">🔍</span> Auditoria</a>
    </nav>
    <div class="sidebar-footer"><button
