const { google } = require("googleapis");
const admin      = require("firebase-admin");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE";
const ABA_BASE       = "base - unico";
const ANO_ATUAL      = String(new Date().getFullYear());

const googleCreds   = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const firebaseCreds = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({ credential: admin.credential.cert(firebaseCreds) });
const db = admin.firestore();

const auth = new google.auth.GoogleAuth({
  credentials: googleCreds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function main() {
  console.log(`=== ManEng Sync ${ANO_ATUAL} iniciado: ${new Date().toISOString()} ===`);
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

  // Filtra apenas registros do ano atual
  const ANO_COL = header.indexOf("ANO");
  const dados   = linhas.slice(headerIdx + 1).filter(r =>
    r.some(c => c) && String(r[ANO_COL] || "").trim() === ANO_ATUAL
  );
  console.log(`  Registros ${ANO_ATUAL} no Sheets: ${dados.length}`);

  const C = {
    SIGLA: header.indexOf("SIGLA"), CLIENTE: header.indexOf("CLIENTE"),
    SUPERVISAO: header.indexOf("SUPERVISÃO"), ESTADO: header.indexOf("ESTADO"),
    PCM: header.indexOf("PCM"), COORDENADOR: header.indexOf("COORDENADOR"),
    MES: header.indexOf("MÊS"), TIPO: header.indexOf("TIPO DE MANUTENÇÃO"),
    STATUS: header.indexOf("STATUS"), PMOC: header.indexOf("PMOC 2026"),
    ANO: header.indexOf("ANO"), DATA_INICIO: header.indexOf("DATA DE INICIO"),
    DATA_TERMINO: header.indexOf("DATA DE TÉRMINO"), PERIODICIDADE: header.indexOf("PERIODICIDADE")
  };

  // Carrega apenas registros do ano atual do Firestore
  console.log(`  Carregando Firestore (${ANO_ATUAL})...`);
  const snap = await db.collection("ordens_servico").where("ano", "==", ANO_ATUAL).get();
  const existentes = {};
  snap.forEach(d => {
    const data = d.data();
    existentes[`${data.sigla}|${data.cliente}|${data.mes}|${data.ano}`] = { id: d.id, ...data };
  });
  console.log(`  Registros ${ANO_ATUAL} no Firestore: ${snap.size}`);

  const LOTE = 400;
  const ops = [];
  let novos = 0, atualizados = 0;

  for (const row of dados) {
    const get = (idx) => idx >= 0 ? (row[idx] || "").toString().trim() : "";
    const sigla = get(C.SIGLA), cliente = get(C.CLIENTE);
    const mes   = get(C.MES),   ano     = get(C.ANO);
    if (!sigla && !cliente) continue;

    const chave  = `${sigla}|${cliente}|${mes}|${ano}`;
    const status = get(C.STATUS).toUpperCase().trim() || "PROGRAMADA";

    const novosDados = {
      sigla, cliente, mes, ano,
      supervisao: get(C.SUPERVISAO), estado: get(C.ESTADO),
      pcm: get(C.PCM), coordenador: get(C.COORDENADOR),
      tipoManutencao: get(C.TIPO), status,
      pmoc2026: get(C.PMOC), periodicidade: get(C.PERIODICIDADE),
      dataInicio:  parseData(get(C.DATA_INICIO)),
      dataTermino: parseData(get(C.DATA_TERMINO)),
      ultimaSync:  admin.firestore.FieldValue.serverTimestamp(),
      syncPendente: false
    };

    if (!existentes[chave]) {
      ops.push({ type:"set", ref: db.collection("ordens_servico").doc(),
        data: { ...novosDados, criadoEm: admin.firestore.FieldValue.serverTimestamp() } });
      novos++;
    } else if (!existentes[chave].alteradoManualmente && existentes[chave].status !== status) {
      ops.push({ type:"update", ref: db.collection("ordens_servico").doc(existentes[chave].id), data: novosDados });
      atualizados++;
    }
  }

  console.log(`  Novos: ${novos} | Atualizados: ${atualizados}`);

  for (let i = 0; i < ops.length; i += LOTE) {
    const batch = db.batch();
    ops.slice(i, i + LOTE).forEach(op =>
      op.type === "set" ? batch.set(op.ref, op.data) : batch.update(op.ref, op.data)
    );
    await batch.commit();
    console.log(`  Lote ${Math.floor(i/LOTE)+1}: ${Math.min(i+LOTE,ops.length)}/${ops.length}`);
  }
  console.log("  Sheets → Firestore concluído");
}

async function sincronizarFirestoreParaSheets(sheets) {
  console.log("\n[2/2] Write-back...");
  const snap = await db.collection("ordens_servico")
    .where("syncPendente","==",true).where("ano","==",ANO_ATUAL).get();
  if (snap.empty) { console.log("  Nenhuma alteração pendente."); return; }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `'${ABA_BASE}'!A:Z`
  });
  const linhas    = res.data.values || [];
  const headerIdx = linhas.findIndex(r => r.some(c => c.toString().trim().length > 0));
  const header    = linhas[headerIdx].map(h => h.toString().trim().toUpperCase());
  const C = {
    SIGLA: header.indexOf("SIGLA"), CLIENTE: header.indexOf("CLIENTE"),
    MES: header.indexOf("MÊS"), ANO: header.indexOf("ANO"),
    STATUS: header.indexOf("STATUS"),
    DATA_INICIO: header.indexOf("DATA DE INICIO"),
    DATA_TERMINO: header.indexOf("DATA DE TÉRMINO"),
    PERIODICIDADE: header.indexOf("PERIODICIDADE")
  };

  const updates = [];
  const batchFS = db.batch();
  snap.forEach(docSnap => {
    const d = docSnap.data();
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const row = linhas[i];
      if ((row[C.SIGLA]||"").trim()===d.sigla &&
          (row[C.CLIENTE]||"").trim()===d.cliente &&
          (row[C.MES]||"").trim()===d.mes &&
          String(row[C.ANO]||"").trim()===String(d.ano)) {
        const r = i+1;
        if (C.STATUS>=0&&d.status) updates.push({range:`'${ABA_BASE}'!${col(C.STATUS)}${r}`,values:[[d.status]]});
        if (C.DATA_INICIO>=0&&d.dataInicio) updates.push({range:`'${ABA_BASE}'!${col(C.DATA_INICIO)}${r}`,values:[[fmt(d.dataInicio)]]});
        if (C.DATA_TERMINO>=0&&d.dataTermino) updates.push({range:`'${ABA_BASE}'!${col(C.DATA_TERMINO)}${r}`,values:[[fmt(d.dataTermino)]]});
        if (C.PERIODICIDADE>=0&&d.periodicidade) updates.push({range:`'${ABA_BASE}'!${col(C.PERIODICIDADE)}${r}`,values:[[d.periodicidade]]});
        break;
      }
    }
    batchFS.update(db.collection("ordens_servico").doc(docSnap.id),{syncPendente:false});
  });

  if (updates.length>0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption:"USER_ENTERED", data:updates }
    });
    console.log(`  ${updates.length} células atualizadas`);
  }
  await batchFS.commit();
  console.log("  Write-back concluído");
}

function parseData(str) {
  if (!str) return null;
  try {
    if (!str.toString().trim()||str.toString().trim()==="0") return null;
    const num = Number(str);
    if (!isNaN(num)&&num>1000&&num<100000) {
      const d = new Date((num-25569)*86400*1000);
      if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
    }
    let p = str.includes("/") ? str.split("/").reverse() : str.split("-");
    const d = new Date(`${p[0]}-${String(p[1]).padStart(2,"0")}-${String(p[2]).padStart(2,"0")}`);
    return isNaN(d.getTime()) ? null : admin.firestore.Timestamp.fromDate(d);
  } catch(e) { return null; }
}

function fmt(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR");
}

function col(idx) {
  let s=""; idx++;
  while(idx>0){s=String.fromCharCode(64+(idx%26||26))+s;idx=Math.floor((idx-1)/26);}
  return s;
}

main().catch(e=>{console.error("ERRO:",e);process.exit(1);});
