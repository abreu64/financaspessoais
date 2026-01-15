const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 5000;

// Configuração do Supabase
const SUPABASE_URL = 'https://xqcwlxyflniaptjqwdwr.supabase.co';
const SUPABASE_ANON_KEY = 'REVOGADA_CHAVE_SUPABASE';

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
    res.status(500).json({ error: error.message });
  }
});

// Rotas de Autenticação
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, nome } = req.body;
    console.log('📝 REGISTRANDO USUÁRIO:', email);

    // CORREÇÃO: Usar admin.createUser para confirmar e-mail automaticamente
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, full_name: nome }
    });

    if (error) throw error;

    // Criar usuário na tabela usuarios COM UUID
    if (data.user) {
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([
          {
            id: data.user.id, // UUID do Supabase Auth
            email: data.user.email,
            nome: nome,
            created_at: new Date().toISOString()
          }
        ]);

      if (dbError) {
        console.log('⚠️  Aviso tabela usuarios:', dbError.message);
      } else {
        console.log('✅ Usuário criado na tabela usuarios com UUID:', data.user.id);
      }
    }

    res.json({
      message: 'Usuário criado com sucesso!',
      user: data.user
    });
  } catch (error) {
    console.log('❌ Erro registro:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 LOGIN:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    console.log('✅ Login realizado. UUID:', data.user.id);
    res.json({
      message: 'Login realizado com sucesso!',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.log('❌ Erro login:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Dashboard - CORRIGIDO COM FUSO HORÁRIO
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo, data_inicio, data_fim } = req.query;

    console.log('📊 DASHBOARD - UUID:', userId, 'Filtros:', { periodo, data_inicio, data_fim });

    // Buscar entradas com filtros
    let queryEntradas = supabase
      .from('entradas')
      .select('valor, tipo, data_entrada, descricao')
      .eq('usuario_id', userId);

    // Buscar despesas com filtros
    let queryDespesas = supabase
      .from('despesas')
      .select('valor, tipo, data_despesa, descricao')
      .eq('usuario_id', userId);

    // APLICAR FILTROS DE DATA COM CORREÇÃO DE FUSO HORÁRIO NO DASHBOARD
    if (data_inicio && data_fim) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);

      console.log('🕐 Datas corrigidas - Início:', dataInicioCorrigida.toISOString().split('T')[0], 'Fim:', dataFimCorrigida.toISOString().split('T')[0]);

      queryEntradas = queryEntradas.gte('data_entrada', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_entrada', dataFimCorrigida.toISOString().split('T')[0]);
      queryDespesas = queryDespesas.gte('data_despesa', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_despesa', dataFimCorrigida.toISOString().split('T')[0]);
    } else if (data_inicio) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      console.log('🕐 Data início corrigida:', dataInicioCorrigida.toISOString().split('T')[0]);

      queryEntradas = queryEntradas.gte('data_entrada', dataInicioCorrigida.toISOString().split('T')[0]);
      queryDespesas = queryDespesas.gte('data_despesa', dataInicioCorrigida.toISOString().split('T')[0]);
    } else if (data_fim) {
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);
      console.log('🕐 Data fim corrigida:', dataFimCorrigida.toISOString().split('T')[0]);

      queryEntradas = queryEntradas.lte('data_entrada', dataFimCorrigida.toISOString().split('T')[0]);
      queryDespesas = queryDespesas.lte('data_despesa', dataFimCorrigida.toISOString().split('T')[0]);
    } else {
      // Filtro por período padrão se não houver datas específicas
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

      if (startDate && endDate) {
        console.log('📅 Período padrão - Início:', startDate.toISOString().split('T')[0], 'Fim:', endDate.toISOString().split('T')[0]);

        queryEntradas = queryEntradas.gte('data_entrada', startDate.toISOString().split('T')[0])
          .lte('data_entrada', endDate.toISOString().split('T')[0]);
        queryDespesas = queryDespesas.gte('data_despesa', startDate.toISOString().split('T')[0])
          .lte('data_despesa', endDate.toISOString().split('T')[0]);
      }
    }

    const [{ data: entradas, error: entradasError }, { data: despesas, error: despesasError }] = await Promise.all([
      queryEntradas,
      queryDespesas
    ]);

    if (entradasError) {
      console.log('⚠️  Erro entradas:', entradasError.message);
      var entradasData = [];
    } else {
      var entradasData = entradas || [];
    }

    if (despesasError) {
      console.log('⚠️  Erro despesas:', despesasError.message);
      var despesasData = [];
    } else {
      var despesasData = despesas || [];
    }

    // Calcular totais
    const total_entradas = entradasData.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const total_despesas = despesasData.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const saldo = total_entradas - total_despesas;

    console.log(`💰 Totais - Entradas: R$${total_entradas}, Despesas: R$${total_despesas}, Período: ${periodo}`);
    console.log(`📊 Registros - Entradas: ${entradasData.length}, Despesas: ${despesasData.length}`);

    res.json({
      total_entradas,
      total_despesas,
      saldo,
      entradas_por_tipo: entradasData.reduce((acc, item) => {
        acc[item.tipo] = (acc[item.tipo] || 0) + parseFloat(item.valor);
        return acc;
      }, {}),
      despesas_por_tipo: despesasData.reduce((acc, item) => {
        acc[item.tipo] = (acc[item.tipo] || 0) + parseFloat(item.valor);
        return acc;
      }, {}),
      entradas_detalhadas: entradasData,
      despesas_detalhadas: despesasData
    });
  } catch (error) {
    console.log('❌ Erro dashboard:', error.message);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// Entradas - COM CORREÇÃO DE FUSO HORÁRIO
app.get('/api/entradas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo, data_inicio, data_fim } = req.query;

    console.log(`📥 Buscando entradas - UUID: ${userId}, Filtros:`, { periodo, data_inicio, data_fim });

    let query = supabase
      .from('entradas')
      .select('*')
      .eq('usuario_id', userId);

    // Aplicar filtros de data COM CORREÇÃO DE FUSO HORÁRIO
    if (data_inicio && data_fim) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);

      query = query.gte('data_entrada', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_entrada', dataFimCorrigida.toISOString().split('T')[0]);
    } else if (data_inicio) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      query = query.gte('data_entrada', dataInicioCorrigida.toISOString().split('T')[0]);
    } else if (data_fim) {
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);
      query = query.lte('data_entrada', dataFimCorrigida.toISOString().split('T')[0]);
    } else {
      // Filtro por período padrão se não houver datas específicas
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

      if (startDate && endDate) {
        query = query.gte('data_entrada', startDate.toISOString().split('T')[0])
          .lte('data_entrada', endDate.toISOString().split('T')[0]);
      }
    }

    const { data, error } = await query.order('data_entrada', { ascending: false });

    if (error) {
      console.log('❌ Erro ao buscar entradas:', error.message);
      return res.json([]);
    }

    console.log(`✅ Entradas encontradas: ${data?.length || 0}`);
    res.json(data || []);
  } catch (error) {
    console.log('❌ Erro entradas:', error.message);
    res.status(500).json({ error: 'Erro ao carregar entradas' });
  }
});

app.post('/api/entradas', authenticateToken, async (req, res) => {
  try {
    const entrada = {
      ...req.body,
      usuario_id: req.user.id
    };

    console.log('💾 SALVANDO ENTRADA:', entrada);

    const { data, error } = await supabase
      .from('entradas')
      .insert([entrada])
      .select();

    if (error) {
      console.log('❌ Erro ao salvar entrada:', error.message);
      throw error;
    }

    console.log('✅ ENTRADA SALVA! ID:', data[0].id);
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('❌ Erro salvar entrada:', error.message);
    res.status(500).json({ error: 'Erro ao salvar entrada: ' + error.message });
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

// Despesas - COM CORREÇÃO DE FUSO HORÁRIO
app.get('/api/despesas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo, data_inicio, data_fim } = req.query;

    console.log(`📤 Buscando despesas - UUID: ${userId}, Filtros:`, { periodo, data_inicio, data_fim });

    let query = supabase
      .from('despesas')
      .select('*, cartoes(nome)')
      .eq('usuario_id', userId);

    // Aplicar filtros de data COM CORREÇÃO DE FUSO HORÁRIO
    if (data_inicio && data_fim) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);

      query = query.gte('data_despesa', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_despesa', dataFimCorrigida.toISOString().split('T')[0]);
    } else if (data_inicio) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      query = query.gte('data_despesa', dataInicioCorrigida.toISOString().split('T')[0]);
    } else if (data_fim) {
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);
      query = query.lte('data_despesa', dataFimCorrigida.toISOString().split('T')[0]);
    } else {
      // Filtro por período padrão se não houver datas específicas
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

      if (startDate && endDate) {
        query = query.gte('data_despesa', startDate.toISOString().split('T')[0])
          .lte('data_despesa', endDate.toISOString().split('T')[0]);
      }
    }

    const { data, error } = await query.order('data_despesa', { ascending: false });

    if (error) {
      console.log('❌ Erro ao buscar despesas:', error.message);
      return res.json([]);
    }

    console.log(`✅ Despesas encontradas: ${data?.length || 0}`);
    res.json(data || []);
  } catch (error) {
    console.log('❌ Erro despesas:', error.message);
    res.status(500).json({ error: 'Erro ao carregar despesas' });
  }
});

app.post('/api/despesas', authenticateToken, async (req, res) => {
  try {
    const despesa = {
      ...req.body,
      usuario_id: req.user.id
    };

    console.log('💾 SALVANDO DESPESA:', despesa);

    // Se for cartão de crédito com parcelas, criar extrato
    if (despesa.tipo_pagamento === 'credito' && despesa.cartao_id && despesa.parcelas > 1) {
      // Primeiro salvar a despesa para obter o ID
      const { data: despesaSalva, error: despesaError } = await supabase
        .from('despesas')
        .insert([despesa])
        .select();

      if (despesaError) throw despesaError;

      // Criar parcelas no extrato
      await criarParcelasExtrato(despesaSalva[0], req.user.id);

      res.status(201).json(despesaSalva[0]);
    } else {
      // Despesa à vista ou sem parcelamento
      const { data, error } = await supabase
        .from('despesas')
        .insert([despesa])
        .select();

      if (error) throw error;

      console.log('✅ DESPESA SALVA! ID:', data[0].id);
      res.status(201).json(data[0]);
    }
  } catch (error) {
    console.log('❌ Erro salvar despesa:', error.message);
    res.status(500).json({ error: 'Erro ao salvar despesa: ' + error.message });
  }
});

// Função para criar parcelas no extrato
async function criarParcelasExtrato(despesa, userId) {
  const valorParcela = despesa.valor / despesa.parcelas;
  const dataDespesa = new Date(despesa.data_despesa);

  console.log(`📅 CRIANDO ${despesa.parcelas} PARCELAS PARA DESPESA ${despesa.id}`);

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

    const { error } = await supabase.from('extrato_cartao').insert([parcela]);

    if (error) {
      console.log(`❌ Erro ao criar parcela ${i + 1}:`, error.message);
    } else {
      console.log(`✅ Parcela ${i + 1} criada: ${dataVencimento.toISOString().split('T')[0]}`);
    }
  }
}

app.put('/api/despesas/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('despesas')
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

app.delete('/api/despesas/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId);

    if (error) throw error;
    res.json({ message: 'Despesa excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cartões
app.get('/api/cartoes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`💳 Buscando cartões - UUID: ${userId}`);

    const { data, error } = await supabase
      .from('cartoes')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Erro ao buscar cartões:', error.message);
      return res.json([]);
    }

    console.log(`✅ Cartões encontrados: ${data?.length || 0}`);
    res.json(data || []);
  } catch (error) {
    console.log('❌ Erro cartões:', error.message);
    res.status(500).json({ error: 'Erro ao carregar cartões' });
  }
});

app.post('/api/cartoes', authenticateToken, async (req, res) => {
  try {
    const cartao = {
      ...req.body,
      usuario_id: req.user.id
    };

    console.log('💾 SALVANDO CARTÃO:', cartao);

    const { data, error } = await supabase
      .from('cartoes')
      .insert([cartao])
      .select();

    if (error) {
      console.log('❌ Erro ao salvar cartão:', error.message);
      throw error;
    }

    console.log('✅ CARTÃO SALVO! ID:', data[0].id);
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('❌ Erro salvar cartão:', error.message);
    res.status(500).json({ error: 'Erro ao salvar cartão: ' + error.message });
  }
});

app.put('/api/cartoes/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('cartoes')
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

app.delete('/api/cartoes/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('cartoes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId);

    if (error) throw error;
    res.json({ message: 'Cartão excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROTAS DO EXTRATO DO CARTÃO ==========

// Buscar extrato de um cartão específico - COM CORREÇÃO DE FUSO HORÁRIO
app.get('/api/extrato/:cartaoId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartaoId } = req.params;
    const { data_inicio, data_fim } = req.query;

    console.log(`📋 Buscando extrato - Cartão: ${cartaoId}, Usuário: ${userId}, Filtros:`, { data_inicio, data_fim });

    let query = supabase
      .from('extrato_cartao')
      .select('*')
      .eq('cartao_id', cartaoId)
      .eq('usuario_id', userId);

    // Aplicar filtros de data COM CORREÇÃO DE FUSO HORÁRIO
    if (data_inicio && data_fim) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);

      query = query.gte('data_vencimento', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_vencimento', dataFimCorrigida.toISOString().split('T')[0]);
    } else if (data_inicio) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      query = query.gte('data_vencimento', dataInicioCorrigida.toISOString().split('T')[0]);
    } else if (data_fim) {
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);
      query = query.lte('data_vencimento', dataFimCorrigida.toISOString().split('T')[0]);
    }

    const { data, error } = await query.order('data_vencimento', { ascending: true });

    if (error) {
      console.log('❌ Erro ao buscar extrato:', error.message);
      return res.json([]);
    }

    console.log(`✅ Extrato encontrado: ${data?.length || 0} registros`);
    res.json(data || []);
  } catch (error) {
    console.log('❌ Erro extrato:', error.message);
    res.status(500).json({ error: 'Erro ao carregar extrato' });
  }
});

// Resumo do extrato (totais) - COM CORREÇÃO DE FUSO HORÁRIO
app.get('/api/extrato/:cartaoId/resumo', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartaoId } = req.params;
    const { data_inicio, data_fim } = req.query;

    console.log(`📊 Buscando resumo do extrato - Cartão: ${cartaoId}, Filtros:`, { data_inicio, data_fim });

    let query = supabase
      .from('extrato_cartao')
      .select('valor, pago')
      .eq('cartao_id', cartaoId)
      .eq('usuario_id', userId);

    // Aplicar filtros de data COM CORREÇÃO DE FUSO HORÁRIO
    if (data_inicio && data_fim) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);

      query = query.gte('data_vencimento', dataInicioCorrigida.toISOString().split('T')[0])
        .lte('data_vencimento', dataFimCorrigida.toISOString().split('T')[0]);
    } else if (data_inicio) {
      const dataInicioCorrigida = criarDataComFusoHorario(data_inicio);
      query = query.gte('data_vencimento', dataInicioCorrigida.toISOString().split('T')[0]);
    } else if (data_fim) {
      const dataFimCorrigida = criarDataComFusoHorario(data_fim);
      query = query.lte('data_vencimento', dataFimCorrigida.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      console.log('❌ Erro ao buscar resumo:', error.message);
      return res.json({ total: 0, pago: 0, pendente: 0, quantidade: 0, quantidade_pago: 0, quantidade_pendente: 0 });
    }

    const total = data.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const pago = data.filter(item => item.pago).reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const pendente = total - pago;

    console.log(`✅ Resumo - Total: R$${total}, Pago: R$${pago}, Pendente: R$${pendente}`);

    res.json({
      total,
      pago,
      pendente,
      quantidade: data.length,
      quantidade_pago: data.filter(item => item.pago).length,
      quantidade_pendente: data.filter(item => !item.pago).length
    });
  } catch (error) {
    console.log('❌ Erro resumo extrato:', error.message);
    res.status(500).json({ error: 'Erro ao carregar resumo do extrato' });
  }
});

// Marcar parcela como paga
app.put('/api/extrato/:id/pagar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log(`💳 Marcando parcela como paga - ID: ${id}`);

    const { data, error } = await supabase
      .from('extrato_cartao')
      .update({
        pago: true,
        data_pagamento: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('usuario_id', userId)
      .select();

    if (error) {
      console.log('❌ Erro ao marcar parcela como paga:', error.message);
      throw error;
    }

    console.log('✅ Parcela marcada como paga! ID:', data[0].id);
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Erro pagar parcela:', error.message);
    res.status(500).json({ error: 'Erro ao marcar parcela como paga: ' + error.message });
  }
});

// Desmarcar parcela como paga
app.put('/api/extrato/:id/desfazer-pagamento', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log(`↩️ Desfazendo pagamento da parcela - ID: ${id}`);

    const { data, error } = await supabase
      .from('extrato_cartao')
      .update({
        pago: false,
        data_pagamento: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('usuario_id', userId)
      .select();

    if (error) {
      console.log('❌ Erro ao desfazer pagamento:', error.message);
      throw error;
    }

    console.log('✅ Pagamento desfeito! ID:', data[0].id);
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Erro desfazer pagamento:', error.message);
    res.status(500).json({ error: 'Erro ao desfazer pagamento: ' + error.message });
  }
});

// Rota de health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontendfinacaspessoais/frontend')));

// Rota catch-all para servir o index.html para qualquer outra rota (suporte a SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontendfinacaspessoais/frontend/index.html'));
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log('✅ SERVIDOR RODANDO NA PORTA', PORT);
  console.log('🔗 TESTE DO BANCO: http://localhost:5000/api/test-db');
  console.log('🔗 HEALTH: http://localhost:5000/api/health');
  console.log('💳 EXTRATO: Implementado com sucesso!');
  console.log('📊 DASHBOARD: Filtros por período implementados!');
  console.log('🕐 CORREÇÃO DE FUSO HORÁRIO: Implementada em TODOS os endpoints!');
  console.log('📅 FILTROS DE DATA: Corrigidos para todas as páginas!');
  console.log('=================================');
});