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

async function sincronizarSheetsParaFirestore(sheets) {
  console.log("\n[1/2] Lendo Google Sheets...");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${ABA_BASE}'!A:Z`
  });
  const linhas = res.data.values || [];
  if (linhas.length < 2) { console.log("Nenhum dado."); return; }

  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header    = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());
  const dados     = linhas.slice(headerIdx + 1).filter(r => r.some(c => c));
  console.log(`  Registros no Sheets: ${dados.length}`);

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

  // Carrega existentes indexados por chave
  console.log("  Carregando Firestore...");
  const snap = await db.collection("ordens_servico").get();
  const existentes = {};
  snap.forEach(d => {
    const data = d.data();
    existentes[`${data.sigla}|${data.cliente}|${data.mes}|${data.ano}`] = { id: d.id, ...data };
  });
  console.log(`  Registros no Firestore: ${snap.size}`);

  const LOTE = 400;
  const opsNovos = [], opsUpdate = [];

  for (const row of dados) {
    const get = (idx) => idx >= 0 ? (row[idx] ||
