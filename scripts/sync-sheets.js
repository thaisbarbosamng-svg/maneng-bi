/**
 * ManEng BI — Sync Google Sheets → JSON (sem Firestore)
 * Roda via GitHub Actions diariamente às 02h BRT
 * Salva os dados em data/ordens_servico.json e commita no repo
 */

const { google } = require("googleapis");
const fs   = require("fs");
const path = require("path");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE";
const ABA_BASE       = "base - unico";
const ANO_ATUAL      = String(new Date().getFullYear());

const googleCreds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials: googleCreds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

async function main() {
  console.log("=== ManEng Sync iniciado:", new Date().toISOString(), "===");
  const sheets = google.sheets({ version: "v4", auth });

  const registros = await lerSheets(sheets);

  // Garante que pasta data/ existe
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Salva JSON
  const output = {
    ultimaSync: new Date().toISOString(),
    ano:        ANO_ATUAL,
    total:      registros.length,
    registros
  };
  fs.writeFileSync(
    path.join(dataDir, "ordens_servico.json"),
    JSON.stringify(output)
  );
  console.log(`=== ${registros.length} registros salvos em data/ordens_servico.json ===`);
  process.exit(0);
}

async function lerSheets(sheets) {
  console.log("[1/1] Lendo Google Sheets...");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${ABA_BASE}'!A:Z`
  });

  const linhas = res.data.values || [];
  if (linhas.length < 2) { console.log("Nenhum dado."); return []; }

  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header    = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());

  // Filtra apenas ano atual
  const ANO_COL = header.indexOf("ANO");
  const dados   = linhas.slice(headerIdx + 1).filter(r =>
    r.some(c => c) && String(r[ANO_COL] || "").trim() === ANO_ATUAL
  );

  console.log(`  Total de registros ${ANO_ATUAL}: ${dados.length}`);

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

  const get = (row, idx) => idx >= 0 ? (row[idx] || "").toString().trim() : "";

  return dados.map((row, i) => ({
    id:             `os_${i}`,
    sigla:          get(row, C.SIGLA),
    cliente:        get(row, C.CLIENTE),
    supervisao:     get(row, C.SUPERVISAO),
    estado:         get(row, C.ESTADO),
    pcm:            get(row, C.PCM),
    coordenador:    get(row, C.COORDENADOR),
    mes:            get(row, C.MES).toUpperCase().split("/")[0].trim(),
    tipoManutencao: get(row, C.TIPO),
    status:         get(row, C.STATUS).toUpperCase().trim() || "PROGRAMADA",
    pmoc2026:       get(row, C.PMOC),
    ano:            get(row, C.ANO),
    dataInicio:     get(row, C.DATA_INICIO),
    dataTermino:    get(row, C.DATA_TERMINO),
    periodicidade:  get(row, C.PERIODICIDADE).toUpperCase()
  })).filter(r => r.sigla || r.cliente);
}

main().catch(e => { console.error("ERRO:", e); process.exit(1); });
