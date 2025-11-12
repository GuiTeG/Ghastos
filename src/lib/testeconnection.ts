import { prisma } from './prisma'; // Ambos estão na mesma pasta agora


async function testConnection() {
  try {
    const accounts = await prisma.account.findMany(); // Fazendo uma consulta simples
    console.log('Contas:', accounts);
  } catch (error) {
    console.error('Erro ao se conectar ao banco:', error);
  } finally {
    await prisma.$disconnect(); // Desconecta do banco após o teste
  }
}

testConnection();
