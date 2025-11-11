// src/pages/api/transactions/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { deleteRowByFirstCell } from '../../../lib/sheets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

  if (req.method === 'DELETE') {
    // 1) Apaga do banco
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return res.status(404).json({ error: 'not_found' });

    await prisma.transaction.delete({ where: { id } });

    // 2) Tenta apagar do Sheets pela Coluna A (id)
    try {
      const ok = await deleteRowByFirstCell(String(id));
      return res.status(200).json({ ok: true, sheetDeleted: ok });
    } catch (e) {
      console.error('Sheets delete error:', e);
      // Não falha a API se o Sheets falhar — dado principal já foi removido do DB
      return res.status(200).json({ ok: true, sheetDeleted: false });
    }
  }

  return res.status(405).end();
}
