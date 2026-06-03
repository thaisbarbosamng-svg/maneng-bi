const STATUS_CONFIG = window.STATUS_CONFIG || (typeof STATUS_CONFIG !== 'undefined' ? STATUS_CONFIG : {});

function statusChip(status) {
  const cfg = (typeof STATUS_CONFIG !== 'undefined' ? STATUS_CONFIG[status] : null) || { cor: "#999", texto: "#fff", icone: "•" };
  return `<span class="status-chip" style="background:${cfg.cor};color:${cfg.texto}">${cfg.icone} ${status}</span>`;
}

function proximaData(ultimaData, periodicidade) {
  if (!ultimaData || !periodicidade) return null;
  const PERIODICIDADES = { "MENSAL":30,"BIMESTRAL":60,"TRIMESTRAL":90,"SEMESTRAL":180,"ANUAL":365 };
  const dias = PERIODICIDADES[periodicidade.toUpperCase()] || 30;
  const d = new Date(ultimaData); d.setDate(d.getDate() + dias); return d;
}

function fmtData(ts) {
  if (!ts) return "—";
  let d = ts.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
  return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR");
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  let d = ts.toDate ? ts.toDate() : new Date(ts);
  return isNaN(d) ? "—" : d.toLocaleString("pt-BR");
}

function exportarExcel(dados, nomeArquivo) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dados);
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function toast(msg, tipo = "sucesso") {
  const t = document.createElement("div");
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}

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
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function normalizarStatus(s) {
  if (!s) return "PROGRAMADA";
  const mapa = {
    "PROGRAMADO": "PROGRAMADA",
    "CONCLUIDO":  "CONCLUIDA",
    "VALIDADO":   "VALIDADA",
    "AUDITADO":   "AUDITADA",
    "FATURADO":   "FATURADA"
  };
  const upper = s.toString().trim().toUpperCase();
  return mapa[upper] || upper;
}

function filtrarOS(lista, filtros) {
  return lista.filter(os => {
    if (filtros.supervisor  && os.supervisao  !== filtros.supervisor)  return false;
    if (filtros.coordenador && os.coordenador !== filtros.coordenador) return false;
    if (filtros.mes         && os.mes         !== filtros.mes)         return false;
    if (filtros.ano         && String(os.ano) !== String(filtros.ano)) return false;
    if (filtros.sigla       && os.sigla       !== filtros.sigla)       return false;
    if (filtros.estado      && os.estado      !== filtros.estado)      return false;
    if (filtros.status      && normalizarStatus(os.status) !== normalizarStatus(filtros.status)) return false;
    return true;
  });
}

function popularSelect(selectId, lista, campo, placeholder = "Todos") {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const valores = [...new Set(lista.map(i => i[campo]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    valores.map(v => `<option value="${v}">${v}</option>`).join("");
}

function calcularIndicadores(lista) {
  const total = lista.length;
  const STATUS_CONCLUIDO  = ["CONCLUIDA","CONCLUIDO","VALIDADA","VALIDADO","AUDITADA","AUDITADO","FATURADA","FATURADO","CONFORME CRONOGRAMA"];
  const STATUS_PROGRAMADO = ["PROGRAMADA","PROGRAMADO"];
  const STATUS_EXECUCAO   = ["EM EXECUÇÃO","EM EXECUCAO"];
  const STATUS_ATRASO     = ["EM ATRASO"];
  const STATUS_SEM_EQUIPE = ["SEM EQUIPE"];

  const norm = (s) => normalizarStatus(s);
  const concluidas  = lista.filter(o => STATUS_CONCLUIDO.includes(norm(o.status))).length;
  const emAtraso    = lista.filter(o => STATUS_ATRASO.includes(norm(o.status))).length;
  const emExecucao  = lista.filter(o => STATUS_EXECUCAO.includes(norm(o.status))).length;
  const programadas = lista.filter(o => STATUS_PROGRAMADO.includes(norm(o.status))).length;
  const semEquipe   = lista.filter(o => STATUS_SEM_EQUIPE.includes(norm(o.status))).length;
  const taxaConclusao = total > 0 ? ((concluidas / total) * 100).toFixed(2) : 0;
  const alteradas   = lista.filter(o => o.alteradoManualmente).length;
  const pctCumprido = total > 0 ? ((( total - alteradas) / total) * 100).toFixed(2) : 0;
  const pctAlterado = total > 0 ? (100 - pctCumprido).toFixed(2) : 0;
  return { total, concluidas, emAtraso, emExecucao, programadas, semEquipe, taxaConclusao, pctCumprido, pctAlterado };
}

function porSupervisor(lista) {
  const STATUS_CONCLUIDO  = ["CONCLUIDA","CONCLUIDO","VALIDADA","VALIDADO","AUDITADA","FATURADA","CONFORME CRONOGRAMA"];
  const mapa = {};
  lista.forEach(os => {
    const s = os.supervisao || "Sem Supervisor";
    if (!mapa[s]) mapa[s] = { supervisao: s, programadas: 0, concluidas: 0, emExecucao: 0, emAtraso: 0, semEquipe: 0 };
    const st = normalizarStatus(os.status);
    if (["PROGRAMADA","PROGRAMADO"].includes(st)) mapa[s].programadas++;
    else if (STATUS_CONCLUIDO.includes(st)) mapa[s].concluidas++;
    else if (["EM EXECUÇÃO","EM EXECUCAO"].includes(st)) mapa[s].emExecucao++;
    else if (st === "EM ATRASO") mapa[s].emAtraso++;
    else if (st === "SEM EQUIPE") mapa[s].semEquipe++;
  });
  return Object.values(mapa).sort((a,b) => b.concluidas - a.concluidas);
}
