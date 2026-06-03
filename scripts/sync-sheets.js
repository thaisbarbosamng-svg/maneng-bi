/**
 * ManEng BI — Script de Sincronização Bidirecional
 * Google Sheets (base - unico) <-> Firebase Firestore
 *
 * Executado diariamente via GitHub Actions às 02h00 (BRT)
 */

const { google } = require("googleapis");
const admin      = require("firebase-admin");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE";
const ABA_BASE       = "base - unico";

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
  const sheets = google.sheets({ version: "v4", auth });

  await sincronizarSheetsParaFirestore(sheets);
  await sincronizarFirestoreParaSheets(sheets);

  console.log("=== Sync concluído ===");
  process.exit(0);
}

// ─── PARTE 1: Sheets → Firestore ─────────────────────────────
async function sincronizarSheetsParaFirestore(sheets) {
  console.log("\n[1/2] Lendo Google Sheets...");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${ABA_BASE}'!A:Z`
  });

  const linhas = res.data.values || [];
  if (linhas.length < 2) { console.log("Nenhum dado encontrado."); return; }

  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header    = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());
  const dados     = linhas.slice(headerIdx + 1).filter(r => r.some(c => c));

  console.log(`  Colunas: ${header.join(", ")}`);
  console.log(`  Registros: ${dados.length}`);

  const C = {
    SIGLA:         header.indexOf("SIGLA"),
    CLIENTE:       header.indexOf("CLIENTE"),
    SUPERVISAO:    header.indexOf("SUPERVISÃO"),
    ESTADO:        header.indexOf("ESTADO"),
    PCM:           header.indexOf("PCM"),
    COORDENADOR:   header.indexOf("COORDENADOR"),
    MES:           header.indexOf("MÊS"),
    TIPO:          header.indexOf("TIPO DE MANUTENÇÃO"),
    STATUS:        header.indexOf("STATUS"),
    PMOC:          header.indexOf("PMOC 2026"),
    ANO:           header.indexOf("ANO"),
    DATA_INICIO:   header.indexOf("DATA DE INICIO"),
    DATA_TERMINO:  header.indexOf("DATA DE TÉRMINO"),
    PERIODICIDADE: header.indexOf("PERIODICIDADE")
  };

  // Busca registros existentes no Firestore
  console.log("  Carregando registros existentes no Firestore...");
  const snap = await db.collection("ordens_servico").get();
  const existentes = {};
  snap.forEach(d => {
    const data = d.data();
    const chave = `${data.sigla}|${data.cliente}|${data.mes}|${data.ano}`;
    existentes[chave] = { id: d.id, ...data };
  });
  console.log(`  Registros existentes: ${snap.size}`);

  // Monta operações
  const LOTE = 400;
  const ops = [];
  let novos = 0, atualizados = 0, ignorados = 0;

  for (const row of dados) {
    const get = (idx) => idx >= 0 ? (row[idx] || "").toString().trim() : "";
    const sigla   = get(C.SIGLA);
    const cliente = get(C.CLIENTE);
    const mes     = get(C.MES);
    const ano     = get(C.ANO);
    if (!sigla && !cliente) continue;

    const chave     = `${sigla}|${cliente}|${mes}|${ano}`;
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
      if (!existentes[chave].alteradoManualmente) {
        ops.push({ type: "update", ref: db.collection("ordens_servico").doc(existentes[chave].id), data: novosDados });
        atualizados++;
      } else {
        ignorados++;
      }
    } else {
      ops.push({
        type: "set",
        ref: db.collection("ordens_servico").doc(),
        data: { ...novosDados, criadoEm: admin.firestore.FieldValue.serverTimestamp() }
      });
      novos++;
    }
  }

  console.log(`  Operações: ${novos} novos, ${atualizados} atualizados, ${ignorados} ignorados`);

  // Commit em lotes de 400
  for (let i = 0; i < ops.length; i += LOTE) {
    const batch = db.batch();
    ops.slice(i, i + LOTE).forEach(op => {
      if (op.type === "update") batch.update(op.ref, op.data);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
    console.log(`  ✓ Lote ${Math.floor(i / LOTE) + 1}: ${Math.min(i + LOTE, ops.length)}/${ops.length}`);
  }

  console.log(`  ✅ Sincronização Sheets → Firestore concluída`);
}

// ─── PARTE 2: Firestore → Sheets (write-back) ────────────────
async function sincronizarFirestoreParaSheets(sheets) {
  console.log("\n[2/2] Escrevendo alterações de volta ao Sheets...");

  const snap = await db.collection("ordens_servico")
    .where("syncPendente", "==", true).get();

  if (snap.empty) { console.log("  Nenhuma alteração pendente."); return; }
  console.log(`  ${snap.size} registros para escrever no Sheets`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${ABA_BASE}'!A:Z`
  });

  const linhas    = res.data.values || [];
  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header    = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());

  const C = {
    SIGLA:         header.indexOf("SIGLA"),
    CLIENTE:       header.indexOf("CLIENTE"),
    MES:           header.indexOf("MÊS"),
    ANO:           header.indexOf("ANO"),
    STATUS:        header.indexOf("STATUS"),
    DATA_INICIO:   header.indexOf("DATA DE INICIO"),
    DATA_TERMINO:  header.indexOf("DATA DE TÉRMINO"),
    PERIODICIDADE: header.indexOf("PERIODICIDADE")
  };

  const updates = [];
  const batchFS = db.batch();

  snap.forEach(docSnap => {
    const d = docSnap.data();
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const row = linhas[i];
      if (
        (row[C.SIGLA]   || "").trim() === d.sigla   &&
        (row[C.CLIENTE] || "").trim() === d.cliente  &&
        (row[C.MES]     || "").trim() === d.mes      &&
        String(row[C.ANO] || "").trim() === String(d.ano)
      ) {
        const rowNum = i + 1;
        if (C.STATUS >= 0 && d.status)
          updates.push({ range: `'${ABA_BASE}'!${colLetra(C.STATUS)}${rowNum}`, values: [[d.status]] });
        if (C.DATA_INICIO >= 0 && d.dataInicio)
          updates.push({ range: `'${ABA_BASE}'!${colLetra(C.DATA_INICIO)}${rowNum}`, values: [[fmtDataBR(d.dataInicio)]] });
        if (C.DATA_TERMINO >= 0 && d.dataTermino)
          updates.push({ range: `'${ABA_BASE}'!${colLetra(C.DATA_TERMINO)}${rowNum}`, values: [[fmtDataBR(d.dataTermino)]] });
        if (C.PERIODICIDADE >= 0 && d.periodicidade)
          updates.push({ range: `'${ABA_BASE}'!${colLetra(C.PERIODICIDADE)}${rowNum}`, values: [[d.periodicidade]] });
        break;
      }
    }
    batchFS.update(db.collection("ordens_servico").doc(docSnap.id), { syncPendente: false });
  });

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates }
    });
    console.log(`  ✓ ${updates.length} células atualizadas no Sheets`);
  }

  await batchFS.commit();
  console.log(`  ✅ Write-back concluído`);
}

// ─── Helpers ─────────────────────────────────────────────────
function parseData(str) {
  if (!str) return null;
  try {
    if (str.toString().trim() === "" || str.toString().trim() === "0") return null;
    const num = Number(str);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
    }
    let partes;
    if (str.includes("/")) partes = str.split("/").reverse();
    else partes = str.split("-");
    const d = new Date(`${partes[0]}-${String(partes[1]).padStart(2,"0")}-${String(partes[2]).padStart(2,"0")}`);
    if (isNaN(d.getTime())) return null;
    return admin.firestore.Timestamp.fromDate(d);
  } catch(e) { return null; }
}

function fmtDataBR(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR");
}

function colLetra(idx) {
  let s = ""; idx++;
  while (idx > 0) {
    s = String.fromCharCode(64 + (idx % 26 || 26)) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

main().catch(e => { console.error("ERRO:", e); process.exit(1); });
