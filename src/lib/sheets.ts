// src/lib/sheets.ts
import { google } from 'googleapis';

const SHEETS_ID = process.env.SHEETS_ID!;
const SHEETS_TAB = process.env.SHEETS_TAB ?? 'Lancamentos';

function getAuth() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!SHEETS_ID || !SHEETS_TAB || !keyFile) {
    throw new Error('Configure SHEETS_ID, SHEETS_TAB e GOOGLE_APPLICATION_CREDENTIALS no .env.local');
  }
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function client() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// cache do sheetId (necessário para delete por linha)
let cachedSheetId: number | null = null;
async function getSheetId(): Promise<number> {
  if (cachedSheetId !== null) return cachedSheetId;
  const api = client();
  const resp = await api.spreadsheets.get({
    spreadsheetId: SHEETS_ID,
    fields: 'sheets.properties(sheetId,title)',
  });
  const target = resp.data.sheets?.find(s => s.properties?.title === SHEETS_TAB);
  if (!target?.properties?.sheetId) {
    throw new Error(`Aba "${SHEETS_TAB}" não encontrada no spreadsheet`);
  }
  cachedSheetId = target.properties.sheetId;
  return cachedSheetId!;
}

export async function appendToSheet(values: any[]) {
  const api = client();
  const range = `'${SHEETS_TAB.replace(/'/g, "''")}'`; // apenas o nome da aba
  const resp = await api.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    includeValuesInResponse: false,
    requestBody: { majorDimension: 'ROWS', values: [values] },
  });
  const updatedRange = resp.data.updates?.updatedRange ?? '';
  const rowNumber = Number(updatedRange.split('!')[1]?.match(/\d+/)?.[0] || 0);
  return { updatedRange, rowNumber };
}

export async function findRowByFirstCell(firstCellValue: string) {
  const api = client();
  const resp = await api.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: `'${SHEETS_TAB.replace(/'/g, "''")}'!A:A`,
    majorDimension: 'ROWS',
  });
  const rows = resp.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? '').toString() === firstCellValue) {
      return i + 1; // 1-based
    }
  }
  return null;
}

export async function deleteRowByNumber(rowNumber: number) {
  const api = client();
  const sheetId = await getSheetId();
  const startIndex = rowNumber - 1; // 0-based
  await api.spreadsheets.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        },
      ],
    },
  });
}

export async function deleteRowByFirstCell(firstCellValue: string) {
  const rowNumber = await findRowByFirstCell(firstCellValue);
  if (!rowNumber) return false;      // não achou no Sheets (segue sem erro)
  await deleteRowByNumber(rowNumber);
  return true;
}
