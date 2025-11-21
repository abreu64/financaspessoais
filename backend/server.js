const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 5000;

// Configuração do Supabase
const SUPABASE_URL = 'https://xqcwlxyflniaptjqwdwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3dseHlmbG5pYXB0anF3ZHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2ODQyNywiZXhwIjoyMDc4NTQ0NDI3fQ.S8W6m0T90KtkNRX8oDDHuXXHTVpczqGC-OckYJD5odY';

console.log('🚀 INICIANDO SERVIDOR...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Supabase conectado!');

// Middleware CORS CONFIGURADO CORRETAMENTE
app.use(cors({
    origin: [
        "https://financaspessoaisfrontend.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:5500"
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Erro de autenticação' });
  }
};

// Função para criar datas com fuso horário correto
function criarDataComFusoHorario(dataString) {
  if (!dataString) return null;
  // Adiciona o timezone para garantir que a data seja interpretada corretamente
  return new Date(dataString + 'T00:00:00-03:00');
}

// Rota de teste do banco
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🧪 TESTANDO TABELAS...');
    
    const tabelas = ['usuarios', 'entradas', 'despesas', 'cartoes', 'extrato_cartao'];
    const resultados = {};

    for (const tabela of tabelas) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .limit(2);

      resultados[tabela] = {
        existe: !error,
        registros: data ? data.length : 0,
        erro: error?.message,
        estrutura: data && data.length > 0 ? Object.keys(data[0]) : []
      };
      
      console.log(`📊 ${tabela}: ${data ? data.length : 0} registros`);
      if (error) console.log(`   Erro: ${error.message}`);
    }

    res.json({
      message: 'TESTE DE BANCO',
      tabelas: resultados
    });

  } catch (error) {
   