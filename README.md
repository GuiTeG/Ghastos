# Gastos – Forms → Sheets → Webhook → Plataforma

Demo completo para alimentar um mini app de gastos a partir de **Google Forms**.
- Forms salva na **Google Sheets**
- Apps Script dispara POST a cada resposta
- API Next.js grava via **Prisma** (SQLite local)
- Front lista as transações e mostra somatórios

## 1) Rodar local
```bash
npm i
cp .env.example .env
npx prisma migrate dev --name init
npm run seed   # cria contas/categorias
npm run dev
```

Abra http://localhost:3000

## 2) Webhook (URL)
Local: `http://localhost:3000/api/hook/new-transaction`  
Produção (Vercel): `https://SEU-APP.vercel.app/api/hook/new-transaction`

Defina `WEBHOOK_SECRET` no `.env` e igual no Apps Script.

## 3) Google Apps Script (na Planilha)
Crie um projeto e cole o arquivo `apps-script/Code.gs` (nesta pasta).  
Crie trigger: **On form submit**.

## 4) Deploy (Vercel)
- Suba para GitHub
- Vercel → New Project → importe repo
- Variáveis: `WEBHOOK_SECRET`
- Deploy

## 5) Testar sem Forms
```bash
curl -X POST http://localhost:3000/api/hook/new-transaction  -H "Content-Type: application/json"  -d '{"date":"2025-11-10","description":"Teste","amount":-123.45,"type":"EXPENSE","category":"Mercado","account":"Conta Corrente","secret":"supersecreto"}'
```

Pronto! A transação aparecerá na tela em até 4s.
