// src/pages/api/accounts/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma'; // 3 níveis

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });

  if (req.method === 'DELETE') {
    try {
      await prisma.account.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(400).json({
        error: 'Não foi possível excluir. Verifique se há lançamentos nessa conta.'
      });
    }
  }

  res.setHeader('Allow', ['DELETE']);
  res.status(405).end();
}
