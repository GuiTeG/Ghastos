// src/pages/api/diag-sheets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { appendToSheet } from '../../lib/sheets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { updatedRange, rowNumber } = await appendToSheet([
      '99999',                      // id (coluna A)
      new Date().toISOString(),     // createdAt (B)
      '2025-11-10',                 // date (C)
      'DIAG TEST',                  // description (D)
      1.23,                         // amount (E)
      'INCOME',                     // type (F)
      'Conta Corrente',             // account (G)
      'Outros',                     // category (H)
    ]);
    res.json({ ok: true, updatedRange, rowNumber });
  } catch (e: any) {
    console.error('DIAG SHEETS ERROR:', e);
    res.status(500).json({ ok: false, message: e?.message || String(e) });
  }
}
