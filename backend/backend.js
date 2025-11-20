// server.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Rotas de Autenticação
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, nome } = req.body;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome }
      }
    });

    if (error) throw error;
    res.json({ message: 'Usuário criado com sucesso', user: data.user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    res.json({ 
      message: 'Login realizado com sucesso', 
      user: data.user,
      session: data.session 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rotas de Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Buscar entradas do mês atual
    const { data: entradas, error: entradasError } = await supabase
      .from('entradas')
      .select('valor, tipo')
      .eq('usuario_id', userId)
      .gte('data_entrada', `${currentYear}-${currentMonth}-01`)
      .lte('data_entrada', `${currentYear}-${currentMonth}-31`);

    if (entradasError) throw entradasError;

    // Buscar despesas do mês atual
    const { data: despesas, error: despesasError } = await supabase
      .from('despesas')
      .select('valor, tipo')
      .eq('usuario_id', userId)
      .gte('data_despesa', `${currentYear}-${currentMonth}-01`)
      .lte('data_despesa', `${currentYear}-${currentMonth}-31`);

    if (despesasError) throw despesasError;

    // Calcular totais
    const total_entradas = entradas.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const total_despesas = despesas.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const saldo = total_entradas - total_despesas;

    // Agrupar por tipo
    const entradas_por_tipo = entradas.reduce((acc, item) => {
      acc[item.tipo] = (acc[item.tipo] || 0) + parseFloat(item.valor);
      return acc;
    }, {});

    const despesas_por_tipo = despesas.reduce((acc, item) => {
      acc[item.tipo] = (acc[item.tipo] || 0) + parseFloat(item.valor);
      return acc;
    }, {});

    res.json({
      total_entradas,
      total_despesas,
      saldo,
      entradas_por_tipo,
      despesas_por_tipo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de Entradas
app.get('/api/entradas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo } = req.query;
    
    let startDate, endDate;
    const now = new Date();
    
    switch (periodo) {
      case 'hoje':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'semana':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'mes':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'ano':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const { data, error } = await supabase
      .from('entradas')
      .select('*')
      .eq('usuario_id', userId)
      .gte('data_entrada', startDate.toISOString().split('T')[0])
      .lte('data_entrada', endDate.toISOString().split('T')[0])
      .order('data_entrada', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/entradas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const entrada = { ...req.body, usuario_id: userId };

    const { data, error } = await supabase
      .from('entradas')
      .insert([entrada])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/entradas/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('entradas')
      .update(req.body)
      .eq('id', id)
      .eq('usuario_id', userId)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/entradas/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('entradas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId);

    if (error) throw error;
    res.json({ message: 'Entrada excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de Despesas
app.get('/api/despesas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo } = req.query;
    
    let startDate, endDate;
    const now = new Date();
    
    switch (periodo) {
      case 'hoje':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'semana':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'mes':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'ano':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const { data, error } = await supabase
      .from('despesas')
      .select('*, cartoes(nome)')
      .eq('usuario_id', userId)
      .gte('data_despesa', startDate.toISOString().split('T')[0])
      .lte('data_despesa', endDate.toISOString().split('T')[0])
      .order('data_despesa', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/despesas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const despesa = { ...req.body, usuario_id: userId };

    // Se for cartão de crédito, criar parcelas no extrato
    if (despesa.tipo_pagamento === 'credito' && despesa.cartao_id && despesa.parcelas > 1) {
      await criarParcelasExtrato(despesa, userId);
    }

    const { data, error } = await supabase
      .from('despesas')
      .insert([despesa])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Função para criar parcelas no extrato
async function criarParcelasExtrato(despesa, userId) {
  const valorParcela = despesa.valor / despesa.parcelas;
  const dataDespesa = new Date(despesa.data_despesa);

  for (let i = 0; i < despesa.parcelas; i++) {
    const dataVencimento = new Date(dataDespesa);
    dataVencimento.setMonth(dataVencimento.getMonth() + i);

    const parcela = {
      cartao_id: despesa.cartao_id,
      despesa_id: despesa.id,
      descricao: `${despesa.descricao || 'Despesa'} (${i + 1}/${despesa.parcelas})`,
      valor: valorParcela,
      data_vencimento: dataVencimento.toISOString().split('T')[0],
      parcela_numero: i + 1,
      total_parcelas: despesa.parcelas,
      pago: false,
      usuario_id: userId
    };

    await supabase.from('extrato_cartao').insert([parcela]);
  }
}

// Rotas de Cartões
app.get('/api/cartoes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('cartoes')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cartoes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const cartao = { ...req.body, usuario_id: userId };

    const { data, error } = await supabase
      .from('cartoes')
      .insert([cartao])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de Extrato do Cartão
app.get('/api/extrato/:cartaoId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartaoId } = req.params;

    const { data, error } = await supabase
      .from('extrato_cartao')
      .select('*')
      .eq('cartao_id', cartaoId)
      .eq('usuario_id', userId)
      .order('data_vencimento', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});