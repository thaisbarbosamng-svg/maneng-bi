const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD1qnw-aV9NBkbSUweb_Y2ozu3HSCIuGGk",
  authDomain:        "maneng-bi.firebaseapp.com",
  projectId:         "maneng-bi",
  storageBucket:     "maneng-bi.firebasestorage.app",
  messagingSenderId: "739217936097",
  appId:             "1:739217936097:web:4a72b3b20f50ee6c6931a0"
};

const STATUS_CONFIG = {
  "PROGRAMADA":                    { cor: "#4DA6FF", texto: "#fff" },
  "PROGRAMADO":                    { cor: "#4DA6FF", texto: "#fff" },
  "EM EXECUÇÃO":                   { cor: "#FF9900", texto: "#fff" },
  "CONCLUIDA":                     { cor: "#70AD47", texto: "#fff" },
  "CONCLUIDO":                     { cor: "#70AD47", texto: "#fff" },
  "VALIDADA":                      { cor: "#00B050", texto: "#fff" },
  "CONFORME CRONOGRAMA":           { cor: "#92D050", texto: "#333" },
  "EM ATRASO":                     { cor: "#C00000", texto: "#fff" },
  "REPROVADO":                     { cor: "#FF0000", texto: "#fff" },
  "AUDITADA":                      { cor: "#00B0A0", texto: "#fff" },
  "FATURADA":                      { cor: "#002060", texto: "#fff" },
  "LOJA FECHADA":                  { cor: "#808080", texto: "#fff" },
  "LOJA EM REFORMA":               { cor: "#A6A6A6", texto: "#fff" },
  "DISTRATO DE CONTRATO":          { cor: "#404040", texto: "#fff" },
  "DISTRATO":                      { cor: "#404040", texto: "#fff" },
  "NÃO POSSUI GALERIA NESTA LOJA": { cor: "#BFBFBF", texto: "#333" },
  "RESIDENTE":                     { cor: "#7030A0", texto: "#fff" },
  "SEM EQUIPE":                    { cor: "#843C0C", texto: "#fff" }
};

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
               "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

const PERIODICIDADES = { "MENSAL":30,"BIMESTRAL":60,"TRIMESTRAL":90,"SEMESTRAL":180,"ANUAL":365 };
