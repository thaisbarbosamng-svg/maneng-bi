const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1qnw-aV9NBkbSUweb_Y2ozu3HSCIuGGk",
  authDomain: "maneng-bi.firebaseapp.com",
  projectId: "maneng-bi",
  storageBucket: "maneng-bi.firebasestorage.app",
  messagingSenderId: "739217936097",
  appId: "1:739217936097:web:4a72b3b20f50ee6c6931a0"
};

const SPREADSHEET_ID = "1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE";

const STATUS_CONFIG = {
  "PROGRAMADA":                    { cor: "#4DA6FF", texto: "#fff", icone: "📋" },
  "PROGRAMADO":                    { cor: "#4DA6FF", texto: "#fff", icone: "📋" },
  "EM EXECUÇÃO":                   { cor: "#FF9900", texto: "#fff", icone: "🔧" },
  "CONCLUIDA":                     { cor: "#70AD47", texto: "#fff", icone: "✅" },
  "CONCLUIDO":                     { cor: "#70AD47", texto: "#fff", icone: "✅" },
  "VALIDADA":                      { cor: "#00B050", texto: "#fff", icone: "✔️" },
  "CONFORME CRONOGRAMA":           { cor: "#92D050", texto: "#333", icone: "📅" },
  "EM ATRASO":                     { cor: "#C00000", texto: "#fff", icone: "⏰" },
  "REPROVADO":                     { cor: "#FF0000", texto: "#fff", icone: "❌" },
  "AUDITADA":                      { cor: "#00B0A0", texto: "#fff", icone: "🔍" },
  "FATURADA":                      { cor: "#002060", texto: "#fff", icone: "💰" },
  "LOJA FECHADA":                  { cor: "#808080", texto: "#fff", icone: "🔒" },
  "LOJA EM REFORMA":               { cor: "#A6A6A6", texto: "#fff", icone: "🏗️" },
  "DISTRATO DE CONTRATO":          { cor: "#404040", texto: "#fff", icone: "📵" },
  "DISTRATO":                      { cor: "#404040", texto: "#fff", icone: "📵" },
  "NÃO POSSUI GALERIA NESTA LOJA": { cor: "#BFBFBF", texto: "#333", icone: "🚫" },
  "RESIDENTE":                     { cor: "#7030A0", texto: "#fff", icone: "🏠" },
  "SEM EQUIPE":                    { cor: "#843C0C", texto: "#fff", icone: "👥" },
  "ALTERADO":                      { cor: "#2E75B6", texto: "#fff", icone: "✏️" }
};

const STATUS_TRANSITIONS = {
  "PROGRAMADA":       ["EM EXECUÇÃO","LOJA FECHADA","LOJA EM REFORMA","DISTRATO DE CONTRATO","NÃO POSSUI GALERIA NESTA LOJA","SEM EQUIPE"],
  "PROGRAMADO":       ["EM EXECUÇÃO","LOJA FECHADA","LOJA EM REFORMA","DISTRATO DE CONTRATO","NÃO POSSUI GALERIA NESTA LOJA","SEM EQUIPE"],
  "EM EXECUÇÃO":      ["CONCLUIDA","EM ATRASO","LOJA FECHADA","LOJA EM REFORMA"],
  "CONCLUIDA":        ["VALIDADA"],
  "CONCLUIDO":        ["VALIDADA"],
  "VALIDADA":         ["AUDITADA","REPROVADO"],
  "AUDITADA":         ["FATURADA"],
  "CONFORME CRONOGRAMA": ["VALIDADA","AUDITADA"],
  "EM ATRASO":        ["EM EXECUÇÃO","CONCLUIDA"],
  "REPROVADO":        ["EM EXECUÇÃO"]
};

const TRANSITION_ROLES = {
  "PROGRAMADA->EM EXECUÇÃO":    ["supervisor","pcm","coordenador","admin"],
  "PROGRAMADO->EM EXECUÇÃO":    ["supervisor","pcm","coordenador","admin"],
  "EM EXECUÇÃO->CONCLUIDA":     ["supervisor","pcm","coordenador","admin"],
  "CONCLUIDA->VALIDADA":        ["supervisor","admin"],
  "CONCLUIDO->VALIDADA":        ["supervisor","admin"],
  "VALIDADA->AUDITADA":         ["auditor","admin"],
  "AUDITADA->FATURADA":         ["auditor","admin"],
  "VALIDADA->REPROVADO":        ["auditor","admin"],
  "REPROVADO->EM EXECUÇÃO":     ["supervisor","pcm","coordenador","admin"],
  "EM ATRASO->EM EXECUÇÃO":     ["supervisor","pcm","coordenador","admin"]
};

const PERFIS = {
  admin:       { label: "Administrador", nivel: 5 },
  coordenador: { label: "Coordenador",   nivel: 4 },
  pcm:         { label: "PCM",           nivel: 3 },
  auditor:     { label: "Auditor",       nivel: 3 },
  supervisor:  { label: "Supervisor",    nivel: 2 },
  operador:    { label: "Operador",      nivel: 1 }
};

const PERIODICIDADES = {
  "MENSAL": 30, "BIMESTRAL": 60, "TRIMESTRAL": 90, "SEMESTRAL": 180, "ANUAL": 365
};

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
               "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
