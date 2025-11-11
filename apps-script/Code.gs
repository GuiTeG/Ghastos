// apps-script/Code.gs
const WEBHOOK_URL = 'https://SEU-APP.vercel.app/api/hook/new-transaction'; // troque pela sua
const WEBHOOK_SECRET = 'supersecreto';

function onFormSubmit(e) {
  try {
    const sheet = e.range.getSheet();
    const header = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const rowIdx = e.range.getRow();
    const row = sheet.getRange(rowIdx,1,1,sheet.getLastColumn()).getValues()[0];
    const record = {};
    header.forEach((h, i) => record[h] = row[i]);

    const payload = {
      date: toIso(record['Data'] || record['Timestamp'] || record['Date']),
      description: String(record['Descrição'] || record['Descricao'] || record['Description'] || ''),
      amount: parseFloat(String(record['Valor'] || record['Amount'] || '0').replace(',','.')),
      type: String(record['Tipo'] || 'EXPENSE').toUpperCase(),
      category: String(record['Categoria'] || 'Outros'),
      account: String(record['Conta'] || 'Conta Corrente'),
      secret: WEBHOOK_SECRET
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log(res.getResponseCode() + ' ' + res.getContentText());
  } catch (err) {
    Logger.log('Erro onFormSubmit: ' + err);
  }
}

function toIso(v) {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return new Date(v).toISOString().slice(0,10);
  const m = String(v).match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return new Date(v).toISOString().slice(0,10);
}
