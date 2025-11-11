// src/pages/api/new.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { appendToSheet } from '../../lib/sheets';

const Body = z.object({
  date: z.string().min(1), // "YYYY-MM-DD"
  description: z.string().min(1),
  amount: z.preprocess((v) => {
    if (typeof v === 'string') return Number(v.replace(',', '.'));
    return typeof v === 'number' ? v : NaN;
  }, z.number().finite()),
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().min(1).default('Outros'),
  account: z.string().min(1).default('Conta Corrente'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.flatten());
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  const { date, description, amount, type, category, account } = parsed.data;

  // garante sinal conforme o tipo
  const normalizedAmount =
    type === 'EXPENSE' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

  // salva yyyy-mm-dd como UTC 00:00:00 (evita offset)
  const [y, m, d] = date.split('-').map(Number);
  const whenUTC = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));

  const [cat, acc] = await Promise.all([
    prisma.category.upsert({
      where: { name: category },
      update: { kind: type },
      create: { name: category, kind: type },
    }),
    prisma.account.upsert({
      where: { name: account },
      update: {},
      create: { name: account, type: 'corrente' },
    }),
  ]);

  const tx = await prisma.transaction.create({
    data: {
      date: whenUTC,
      description,
      amount: normalizedAmount,
      type,
      categoryId: cat.id,
      accountId: acc.id,
    },
  });

  // grava também no Google Sheets (ID na coluna A)
  try {
    // Suporta os dois modos: arquivo JSON OU email/key
    const hasJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasKeyPair = !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY);
    if (process.env.SHEETS_ID && (hasJson || hasKeyPair)) {
      console.log('[NEW] append rows to sheets', {
        tab: process.env.SHEETS_TAB,
        id: tx.id,
        mode: hasJson ? 'json' : 'env-key',
      });
      await appendToSheet([
        String(tx.id),             // A: id
        new Date().toISOString(),  // B: createdAt
        date,                      // C: date (YYYY-MM-DD)
        description,               // D
        normalizedAmount,          // E
        type,                      // F
        account,                   // G
        category,                  // H
      ]);
    }
  } catch (e) {
    console.error('Sheets append error:', e);
    // segue mesmo que a planilha falhe — dado principal fica no DB
  }

  return res.status(201).json({ ok: true, id: tx.id });
}
