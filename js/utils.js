// ============================================================
// ManEng BI — Utilitários
// ============================================================

// Retorna chip de status colorido
function statusChip(status) {
  const cfg = STATUS_CONFIG[status] || { cor: "#999", texto: "#fff", icone: "•" };
  return `<span class="status-chip" style="background:${cfg.cor};color:${cfg.texto}">${cfg.icone} ${status}</span>`;
}

// Calcula próxima data de manutenção
function proximaData(ultimaData, periodicidade) {
  if (!ultimaData || !periodicidade) return null;
  const dias = PERIODICIDADES[periodicidade.toUpperCase()] || 30;
  const d = new Date(ultimaData);
  d.setDate(d.getDate() + dias);
  return d;
}

// Formata data para exibição
function fmtData(ts) {
  if (!ts) return "—";
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  return d.toLocaleDateString("pt-BR");
}

// Formata data/hora
function fmtDateTime(ts) {
  if (!ts) return "—";
  let d;
  if (ts.toDate) d = ts.toDate();
  else d = new Date(ts);
  return d.toLocaleString("pt-BR");
}

// Exporta dados para Excel
function exportarExcel(dados, nomeArquivo, cabecalho) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dados, { header: cabecalho });
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Mostra notificação toast
function toast(msg, tipo = "sucesso") {
  const t = document.createElement("div");
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}

// Cria modal genérico
function abrirModal(titulo, conteudo, botoes = []) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${titulo}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">${conteudo}</div>
      <div class="modal-footer">
        ${botoes.map(b => `<button class="btn ${b.classe||''}" onclick="${b.acao}">${b.label}</button>`).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// Verifica se OS está em atraso
function verificarAtraso(os) {
  if (!os.dataTermino) return false;
  const hoje = new Date();
  const termino = os.dataTermino.toDate ? os.dataTermino.toDate() : new Date(os.dataTermino);
  const statusAtivos = ["PROGRAMADA", "EM EXECUÇÃO", "CONFORME CRONOGRAMA"];
  return statusAtivos.includes(os.status) && termino < hoje;
}

// Filtra array de OS por critérios
function filtrarOS(lista, filtros) {
  return lista.filter(os => {
    if (filtros.supervisor && os.supervisao !== filtros.supervisor) return false;
    if (filtros.coordenador && os.coordenador !== filtros.coordenador) return false;
    if (filtros.mes && os.mes !== filtros.mes) return false;
    if (filtros.ano && String(os.ano) !== String(filtros.ano)) return false;
    if (filtros.sigla && os.sigla !== filtros.sigla) return false;
    if (filtros.estado && os.estado !== filtros.estado) return false;
    if (filtros.status && os.status !== filtros.status) return false;
    return true;
  });
}

// Popula select com opções únicas de uma lista
function popularSelect(selectId, lista, campo, placeholder = "Todos") {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const valores = [...new Set(lista.map(i => i[campo]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    valores.map(v => `<option value="${v}">${v}</option>`).join("");
}

// Calcula indicadores a partir de lista de OS
function calcularIndicadores(lista) {
  const total = lista.length;
  const concluidas = lista.filter(o => ["CONCLUIDA","VALIDADA","AUDITADA","FATURADA","CONFORME CRONOGRAMA"].includes(o.status)).length;
  const emAtraso = lista.filter(o => o.status === "EM ATRASO").length;
  const emExecucao = lista.filter(o => o.status === "EM EXECUÇÃO").length;
  const programadas = lista.filter(o => o.status === "PROGRAMADA").length;
  const semEquipe = lista.filter(o => o.status === "SEM EQUIPE").length;
  const taxaConclusao = total > 0 ? ((concluidas / total) * 100).toFixed(2) : 0;

  // Cronograma
  const alteradas = lista.filter(o => o.alteradoManualmente).length;
  const cumpridas = total - alteradas;
  const pctCumprido = total > 0 ? ((cumpridas / total) * 100).toFixed(2) : 0;
  const pctAlterado = total > 0 ? (100 - pctCumprido).toFixed(2) : 0;

  return { total, concluidas, emAtraso, emExecucao, programadas, semEquipe,
    taxaConclusao, pctCumprido, pctAlterado };
}

// Agrupa OS por supervisor
function porSupervisor(lista) {
  const mapa = {};
  lista.forEach(os => {
    const s = os.supervisao || "Sem Supervisor";
    if (!mapa[s]) mapa[s] = { supervisao: s, programadas: 0, concluidas: 0, emExecucao: 0, emAtraso: 0, semEquipe: 0 };
    if (os.status === "PROGRAMADA") mapa[s].programadas++;
    else if (["CONCLUIDA","VALIDADA","AUDITADA","FATURADA","CONFORME CRONOGRAMA"].includes(os.status)) mapa[s].concluidas++;
    else if (os.status === "EM EXECUÇÃO") mapa[s].emExecucao++;
    else if (os.status === "EM ATRASO") mapa[s].emAtraso++;
    else if (os.status === "SEM EQUIPE") mapa[s].semEquipe++;
  });
  return Object.values(mapa).sort((a,b) => b.concluidas - a.concluidas);
}
