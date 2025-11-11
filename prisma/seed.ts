import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Contas (idempotente)
  await prisma.account.upsert({
    where: { name: 'Conta Corrente' },
    update: {},
    create: { name: 'Conta Corrente', type: 'corrente' }
  });

  await prisma.account.upsert({
    where: { name: 'Cartão Visa' },
    update: {},
    create: { name: 'Cartão Visa', type: 'cartao' }
  });

  // Categorias (idempotente)
  await prisma.category.upsert({
    where: { name: 'Salário' },
    update: { kind: 'INCOME' },
    create: { name: 'Salário', kind: 'INCOME' }
  });

  await prisma.category.upsert({
    where: { name: 'Mercado' },
    update: { kind: 'EXPENSE' },
    create: { name: 'Mercado', kind: 'EXPENSE' }
  });

  await prisma.category.upsert({
    where: { name: 'Transporte' },
    update: { kind: 'EXPENSE' },
    create: { name: 'Transporte', kind: 'EXPENSE' }
  });

  await prisma.category.upsert({
    where: { name: 'Lazer' },
    update: { kind: 'EXPENSE' },
    create: { name: 'Lazer', kind: 'EXPENSE' }
  });
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
