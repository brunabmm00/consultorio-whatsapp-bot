# Deploy Gratuito — Consultório Dra. Bruna WhatsApp Bot

## Pré-requisitos
- Conta no GitHub (gratuita): github.com
- Conta no Render.com (gratuita): render.com
- Typebot publicado com ID em mãos

---

## PASSO 1 — Criar Typebot e obter o ID

1. No Typebot (app.typebot.com), crie um novo typebot
2. Monte o fluxo de atendimento
3. Clique em **Publish** (Publicar)
4. Anote o ID do typebot — está na URL:
   `https://app.typebot.com/typebots/**SEU_ID**/edit`

---

## PASSO 2 — Publicar código no GitHub

1. Acesse github.com e faça login
2. Clique em **New repository**
3. Nome: `consultorio-whatsapp-bot`
4. Marque **Private** (mantém suas credenciais seguras)
5. Clique **Create repository**
6. Na pasta `webhook-server`, arraste todos os arquivos para o GitHub
   (ou use o botão "uploading an existing file")

---

## PASSO 3 — Deploy no Render.com

1. Acesse render.com e crie conta com o Gmail
2. Clique **New > Web Service**
3. Conecte seu GitHub e selecione o repositório `consultorio-whatsapp-bot`
4. Configure:
   - **Name:** consultorio-dra-bruna-bot
   - **Region:** Oregon (US West) ou São Paulo se disponível
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

5. Em **Environment Variables**, adicione:

| Key | Value |
|-----|-------|
| `VERIFY_TOKEN` | `consultorio_dra_bruna` |
| `WHATSAPP_TOKEN` | (seu token do Meta) |
| `PHONE_NUMBER_ID` | `1142240842304994` |
| `TYPEBOT_ID` | (ID do seu typebot) |

6. Clique **Create Web Service**
7. Aguarde o deploy (2-3 minutos)
8. Copie a URL gerada — ex: `https://consultorio-dra-bruna-bot.onrender.com`

---

## PASSO 4 — Configurar Webhook no Meta

1. Acesse developers.facebook.com
2. Seu App > WhatsApp > Configuração
3. Em **Webhook**, clique **Editar**:
   - **URL do callback:** `https://consultorio-dra-bruna-bot.onrender.com/webhook`
   - **Token de verificação:** `consultorio_dra_bruna`
4. Clique **Verificar e salvar**
5. Assine o campo: **messages**

---

## PASSO 5 — Manter servidor sempre ativo (IMPORTANTE)

O Render gratuito dorme após 15min sem requisições. Para evitar isso:

1. Acesse uptimerobot.com (gratuito)
2. Crie conta e clique **Add New Monitor**
3. Tipo: **HTTP(s)**
4. URL: `https://consultorio-dra-bruna-bot.onrender.com/`
5. Intervalo: **5 minutos**
6. Clique **Create Monitor**

Isso mantém o servidor ativo 24/7 gratuitamente! ✅

---

## PASSO 6 — Testar

Envie uma mensagem para o número +55 35 9927-7760 pelo WhatsApp e veja a resposta automática!

---

## Credenciais do Consultório

- **Phone Number ID:** 1142240842304994
- **WABA ID:** 36733038872962057
- **Número:** +55 35 9927-7760
- **Verify Token:** consultorio_dra_bruna

⚠️ O token de acesso atual expira em 24h (gerado em 17/05/2026).
Para token permanente, gere via System User no Meta Business Suite.
