/**
 * WhatsApp + Typebot Bridge — Consultório Dra. Bruna
 * Servidor webhook que conecta o WhatsApp Cloud API ao Typebot (gratuito)
 */

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÃO (via variáveis de ambiente) ───────────────────────────────
const VERIFY_TOKEN     = process.env.VERIFY_TOKEN     || 'consultorio_dra_bruna';
const WHATSAPP_TOKEN   = process.env.WHATSAPP_TOKEN;   // Token do Meta
const PHONE_NUMBER_ID  = process.env.PHONE_NUMBER_ID;  // ID do número WhatsApp
const TYPEBOT_ID       = process.env.TYPEBOT_ID;       // ID do typebot publicado
const TYPEBOT_API_URL  = 'https://typebot.io/api/v1';

// ─── SESSÕES (em memória — adequado para baixo volume) ───────────────────────
// Formato: { [numeroWhatsApp]: { sessionId, ultimaAtividade } }
const sessoes = {};

// Limpa sessões com mais de 24 horas para liberar memória
setInterval(() => {
  const limite = Date.now() - 24 * 60 * 60 * 1000;
  for (const num in sessoes) {
    if (sessoes[num].ultimaAtividade < limite) delete sessoes[num];
  }
}, 60 * 60 * 1000); // Roda a cada hora

// ─── VERIFICAÇÃO DO WEBHOOK (Meta exige essa etapa) ─────────────────────────
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso');
    return res.status(200).send(challenge);
  }
  console.warn('⚠️ Falha na verificação do webhook');
  res.sendStatus(403);
});

// ─── RECEBE MENSAGENS DO WHATSAPP ────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Responde imediatamente para não dar timeout no Meta
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;

  const mensagem = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!mensagem) return;

  const de   = mensagem.from;          // Número do paciente
  const tipo = mensagem.type;

  let textoPaciente = '';

  if (tipo === 'text') {
    textoPaciente = mensagem.text.body;
  } else if (tipo === 'interactive') {
    // Botão ou lista selecionada
    textoPaciente =
      mensagem.interactive?.button_reply?.title ||
      mensagem.interactive?.list_reply?.title ||
      '';
  } else {
    // Tipo não suportado (áudio, imagem, etc.)
    await enviarWhatsApp(de, 'Olá! Por enquanto só consigo ler mensagens de texto. Por favor, escreva sua mensagem. 😊');
    return;
  }

  if (!textoPaciente.trim()) return;

  console.log(`📩 [${de}] "${textoPaciente}"`);

  try {
    let respostaTypebot;

    if (sessoes[de]?.sessionId) {
      // ── Continua conversa existente ──
      respostaTypebot = await continuarTypebot(sessoes[de].sessionId, textoPaciente);
    } else {
      // ── Inicia nova conversa ──
      respostaTypebot = await iniciarTypebot(textoPaciente, de);
    }

    // Atualiza sessão
    if (respostaTypebot.sessionId) {
      sessoes[de] = {
        sessionId: respostaTypebot.sessionId,
        ultimaAtividade: Date.now()
      };
    }

    // Envia as mensagens de resposta do Typebot
    const mensagens = respostaTypebot.messages || [];
    for (const msg of mensagens) {
      const texto = extrairTexto(msg);
      if (texto) {
        await enviarWhatsApp(de, texto);
        await esperar(500); // Pequena pausa entre mensagens
      }
    }

    // Se a conversa terminou, remove a sessão
    if (respostaTypebot.status === 'ended') {
      delete sessoes[de];
      console.log(`🏁 Conversa com ${de} finalizada`);
    }

  } catch (erro) {
    console.error(`❌ Erro ao processar mensagem de ${de}:`, erro.message);
    await enviarWhatsApp(de, 'Desculpe, houve um erro temporário. Por favor, tente novamente em instantes.');
    delete sessoes[de]; // Reseta a sessão em caso de erro
  }
});

// ─── FUNÇÕES DO TYPEBOT API ──────────────────────────────────────────────────

async function iniciarTypebot(mensagem, telefone) {
  const { data } = await axios.post(
    `${TYPEBOT_API_URL}/typebots/${TYPEBOT_ID}/startChat`,
    {
      message: mensagem,
      prefilledVariables: {
        telefone: telefone,
        canal: 'whatsapp'
      }
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
  console.log(`🚀 Nova sessão iniciada: ${data.sessionId}`);
  return data;
}

async function continuarTypebot(sessionId, mensagem) {
  const { data } = await axios.post(
    `${TYPEBOT_API_URL}/sessions/${sessionId}/continueChat`,
    { message: mensagem },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return data;
}

// ─── ENVIO DE MENSAGEM WHATSAPP ──────────────────────────────────────────────

async function enviarWhatsApp(para, texto) {
  if (!texto.trim()) return;

  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto, preview_url: false }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  console.log(`📤 Enviado para ${para}: "${texto.substring(0, 50)}..."`);
}

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

function extrairTexto(mensagem) {
  if (!mensagem) return '';

  // Formato richText do Typebot
  if (mensagem.type === 'text' && mensagem.content?.richText) {
    return mensagem.content.richText
      .map(bloco => {
        if (bloco.type === 'p' || !bloco.type) {
          return (bloco.children || [])
            .map(filho => filho.text || '')
            .join('');
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  // Formato texto simples
  if (mensagem.type === 'text' && typeof mensagem.content === 'string') {
    return mensagem.content.trim();
  }

  return '';
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── HEALTH CHECK (para manter o servidor ativo no Render) ───────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servico: 'WhatsApp-Typebot Bridge — Consultório Dra. Bruna',
    sessoesAtivas: Object.keys(sessoes).length,
    versao: '1.0.0'
  });
});

// ─── INICIA O SERVIDOR ───────────────────────────────────────────────────────
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`🏥 Servidor do Consultório Dra. Bruna rodando na porta ${PORTA}`);
  console.log(`📱 Phone Number ID: ${PHONE_NUMBER_ID || '⚠️ NÃO CONFIGURADO'}`);
  console.log(`🤖 Typebot ID: ${TYPEBOT_ID || '⚠️ NÃO CONFIGURADO'}`);
});
