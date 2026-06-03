/**
 * ManEng BI — Script de Sincronização Bidirecional
 * Google Sheets (base - unico) <-> Firebase Firestore
 *
 * Executado diariamente via GitHub Actions às 02h00 (BRT)
 *
 * Secrets necessários (configurar em GitHub → Settings → Secrets):
 *   GOOGLE_CREDENTIALS  : conteúdo do arquivo JSON da Service Account Google
 *   FIREBASE_CREDENTIALS: conteúdo do arquivo JSON da Service Account Firebase Admin
 *   SPREADSHEET_ID      : ID da planilha Google Sheets
 */

const { google }        = require("googleapis");
const admin             = require("firebase-admin");

// ── Configuração ──────────────────────────────────────────────
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE";
const ABA_BASE       = "base - unico";
const ABA_CLIENTES   = "base - cliente";

// ── Inicialização ─────────────────────────────────────────────
const googleCreds   = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const firebaseCreds = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({ credential: admin.credential.cert(firebaseCreds) });
const db = admin.firestore();

const auth = new google.auth.GoogleAuth({
  credentials: googleCreds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function main() {
  console.log("=== ManEng Sync iniciado:", new Date().toISOString(), "===");
  const sheetsClient = await google.sheets({ version: "v4", auth }).spreadsheets;

  // 1. LER SHEETS → FIRESTORE
  await sincronizarSheetsParaFirestore(sheetsClient);

  // 2. ESCREVER FIRESTORE → SHEETS (registros com syncPendente=true)
  await sincronizarFirestoreParaSheets(sheetsClient);

  console.log("=== Sync concluído ===");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────
// PARTE 1: Sheets → Firestore
// ─────────────────────────────────────────────────────────────
async function sincronizarSheetsParaFirestore(sheets) {
  console.log("\n[1/2] Lendo Google Sheets...");

  // Lê aba base - unico
  const resBase = await sheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${ABA_BASE}'!A:Z` });
  const linhas = resBase.data.values || [];
  if (linhas.length < 2) { console.log("Nenhum dado em base - unico"); return; }

  // Descobre cabeçalho (primeira linha não vazia)
  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());
  const dados  = linhas.slice(headerIdx + 1).filter(r => r.some(c => c));

  console.log(`  Colunas: ${header.join(", ")}`);
  console.log(`  Registros: ${dados.length}`);

  // Mapeamento de colunas
  const col = (nome) => header.indexOf(nome);
  const C = {
    SIGLA:        col("SIGLA"),
    CLIENTE:      col("CLIENTE"),
    SUPERVISAO:   col("SUPERVISÃO"),
    ESTADO:       col("ESTADO"),
    PCM:          col("PCM"),
    COORDENADOR:  col("COORDENADOR"),
    MES:          col("MÊS"),
    TIPO:         col("TIPO DE MANUTENÇÃO"),
    STATUS:       col("STATUS"),
    PMOC:         col("PMOC 2026"),
    ANO:          col("ANO"),
    DATA_INICIO:  col("DATA DE INICIO"),
    DATA_TERMINO: col("DATA DE TÉRMINO"),
    PERIODICIDADE:col("PERIODICIDADE")
  };

  // Busca registros atuais no Firestore
  const snap = await db.collection("ordens_servico").get();
  const existentes = {};
  snap.forEach(d => {
    const data = d.data();
    const chave = `${data.sigla}|${data.cliente}|${data.mes}|${data.ano}`;
    existentes[chave] = { id: d.id, ...data };
  });

  const batch = db.batch();
  let novos = 0, atualizados = 0;

  for (const row of dados) {
    const get = (idx) => idx >= 0 ? (row[idx] || "").toString().trim() : "";
    const sigla   = get(C.SIGLA);
    const cliente = get(C.CLIENTE);
    const mes     = get(C.MES);
    const ano     = get(C.ANO);
    if (!sigla && !cliente) continue;

    const chave = `${sigla}|${cliente}|${mes}|${ano}`;
    const statusRaw = get(C.STATUS).toUpperCase().trim();
    const novosDados = {
      sigla, cliente, mes, ano,
      supervisao:     get(C.SUPERVISAO),
      estado:         get(C.ESTADO),
      pcm:            get(C.PCM),
      coordenador:    get(C.COORDENADOR),
      tipoManutencao: get(C.TIPO),
      status:         statusRaw || "PROGRAMADA",
      pmoc2026:       get(C.PMOC),
      periodicidade:  get(C.PERIODICIDADE),
      dataInicio:     parseData(get(C.DATA_INICIO)),
      dataTermino:    parseData(get(C.DATA_TERMINO)),
      ultimaSync:     admin.firestore.FieldValue.serverTimestamp(),
      syncPendente:   false
    };

    if (existentes[chave]) {
      const ex = existentes[chave];
      // Não sobrescreve campos editados manualmente no sistema
      if (!ex.alteradoManualmente) {
        batch.update(db.collection("ordens_servico").doc(ex.id), novosDados);
        atualizados++;
      }
    } else {
      const ref = db.collection("ordens_servico").doc();
      batch.set(ref, { ...novosDados, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
      novos++;
    }
  }

  await batch.commit();
  console.log(`  ✓ ${novos} novos, ${atualizados} atualizados no Firestore`);
}

// ─────────────────────────────────────────────────────────────
// PARTE 2: Firestore → Sheets (write-back)
// ─────────────────────────────────────────────────────────────
async function sincronizarFirestoreParaSheets(sheets) {
  console.log("\n[2/2] Escrevendo alterações de volta ao Sheets...");

  const snap = await db.collection("ordens_servico").where("syncPendente", "==", true).get();
  if (snap.empty) { console.log("  Nenhuma alteração pendente."); return; }

  // Busca todas as linhas do Sheets para localizar onde atualizar
  const resBase = await sheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${ABA_BASE}'!A:Z` });
  const linhas = resBase.data.values || [];
  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());

  const C = {
    SIGLA: header.indexOf("SIGLA"), CLIENTE: header.indexOf("CLIENTE"),
    STATUS: header.indexOf("STATUS"), MES: header.indexOf("MÊS"), ANO: header.indexOf("ANO"),
    DATA_INICIO: header.indexOf("DATA DE INICIO"), DATA_TERMINO: header.indexOf("DATA DE TÉRMINO"),
    PERIODICIDADE: header.indexOf("PERIODICIDADE")
  };

  const updates = [];
  const batch = db.batch();

  snap.forEach(docSnap => {
    const d = docSnap.data();
    // Encontra a linha correspondente no Sheets
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const row = linhas[i];
      const rowSigla   = (row[C.SIGLA]   || "").trim();
      const rowCliente = (row[C.CLIENTE] || "").trim();
      const rowMes     = (row[C.MES]     || "").trim();
      const rowAno     = (row[C.ANO]     || "").trim();
      if (rowSigla === d.sigla && rowCliente === d.cliente && rowMes === d.mes && String(rowAno) === String(d.ano)) {
        const rowNum = i + 1; // 1-indexed
        if (C.STATUS >= 0)       updates.push({ range: `'${ABA_BASE}'!${colLetra(C.STATUS)}${rowNum}`,       values: [[d.status||""]] });
        if (C.DATA_INICIO >= 0 && d.dataInicio) updates.push({ range: `'${ABA_BASE}'!${colLetra(C.DATA_INICIO)}${rowNum}`, values: [[fmtDataBR(d.dataInicio)]] });
        if (C.DATA_TERMINO >= 0 && d.dataTermino) updates.push({ range: `'${ABA_BASE}'!${colLetra(C.DATA_TERMINO)}${rowNum}`, values: [[fmtDataBR(d.dataTermino)]] });
        if (C.PERIODICIDADE >= 0 && d.periodicidade) updates.push({ range: `'${ABA_BASE}'!${colLetra(C.PERIODICIDADE)}${rowNum}`, values: [[d.periodicidade||""]] });
        break;
      }
    }
    batch.update(db.collection("ordens_servico").doc(docSnap.id), { syncPendente: false });
  });

  if (updates.length > 0) {
    await sheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates }
    });
  }

  await batch.commit();
  console.log(`  ✓ ${snap.size} registros gravados de volta ao Sheets`);
}

// ─── Helpers ──────────────────────────────────────────────────
function parseData(str) {
  if (!str) return null;
  try {
    // Ignora valores claramente inválidos
    if (str.toString().trim() === "" || str.toString().trim() === "0") return null;
    
    // Trata número serial do Excel (ex: 44927)
    const num = Number(str);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
    }
    
    // Trata dd/mm/yyyy ou yyyy-mm-dd
    let partes;
    if (str.includes("/")) partes = str.split("/").reverse();
    else partes = str.split("-");
    const d = new Date(`${partes[0]}-${String(partes[1]).padStart(2,"0")}-${String(partes[2]).padStart(2,"0")}`);
    if (isNaN(d.getTime())) return null;
    return admin.firestore.Timestamp.fromDate(d);
  } catch(e) {
    return null;
  }
}
