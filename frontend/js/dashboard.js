// Gerenciamento do Dashboard
class Dashboard {
  static charts = {};

  static async loadData() {
    try {
      console.log('Carregando dados do dashboard...');
      
      // Obter filtros
      const periodo = document.getElementById('filtroPeriodoDashboard')?.value || 'mes';
      const dataInicio = document.getElementById('filtroDataInicioDashboard')?.value || '';
      const dataFim = document.getElementById('filtroDataFimDashboard')?.value || '';
      const visualizacao = document.getElementById('filtroVisualizacaoDashboard')?.value || 'resumo';
      
      // Construir query string
      let queryString = `periodo=${periodo}`;
      if (dataInicio) queryString += `&data_inicio=${dataInicio}`;
      if (dataFim) queryString += `&data_fim=${dataFim}`;
      
      const data = await Utils.apiCall(`/dashboard?${queryString}`);
      console.log('Dados do dashboard:', data);
      this.updateCards(data);
      this.updateCharts(data);
      
      // Mostrar/ocultar tabela detalhada
      this.toggleTabelaDetalhada(visualizacao);
      
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      // Usar dados de exemplo em caso de erro
      const dadosExemplo = {
        total_entradas: 0,
        total_despesas: 0,
        saldo: 0,
        entradas_por_tipo: {},
        despesas_por_tipo: {}
      };
      this.updateCards(dadosExemplo);
      this.updateCharts(dadosExemplo);
    }
  }

  static updateCards(data) {
    console.log('Atualizando cards com:', data);
    const totalEntradasEl = document.getElementById('total-entradas');
    const totalDespesasEl = document.getElementById('total-despesas');
    const saldoTotalEl = document.getElementById('saldo-total');
    
    if (totalEntradasEl) totalEntradasEl.textContent = Utils.formatCurrency(data.total_entradas);
    if (totalDespesasEl) totalDespesasEl.textContent = Utils.formatCurrency(data.total_despesas);
    if (saldoTotalEl) saldoTotalEl.textContent = Utils.formatCurrency(data.saldo);
  }

  static updateCharts(data) {
    console.log('Atualizando gráficos com:', data);
    this.createEntradasChart(data.entradas_por_tipo || {});
    this.createDespesasChart(data.despesas_por_tipo || {});
  }

  static createEntradasChart(entradasPorTipo) {
    const ctx = document.getElementById('graficoEntradas');
    if (!ctx) {
      console.log('Canvas graficoEntradas não encontrado');
      return;
    }

    const context = ctx.getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (this.charts.entradas) {
      this.charts.entradas.destroy();
    }

    const labels = Object.keys(entradasPorTipo);
    const values = Object.values(entradasPorTipo);

    console.log('Criando gráfico de entradas:', { labels, values });

    if (labels.length === 0) {
      context.fillStyle = '#ccc';
      context.font = '16px Arial';
      context.textAlign = 'center';
      context.fillText('Sem dados disponíveis', ctx.width / 2, ctx.height / 2);
      return;
    }

    this.charts.entradas = new Chart(context, {
      type: 'doughnut',
      data: {
        labels: labels.map(label => this.formatTipoLabel(label)),
        datasets: [{
          data: values,
          backgroundColor: [
            '#3498db', '#2ecc71', '#9b59b6', '#f1c40f',
            '#e74c3c', '#1abc9c', '#34495e', '#d35400'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Distribuição de Entradas'
          }
        }
      }
    });
  }

  static createDespesasChart(despesasPorTipo) {
    const ctx = document.getElementById('graficoDespesas');
    if (!ctx) {
      console.log('Canvas graficoDespesas não encontrado');
      return;
    }

    const context = ctx.getContext('2d');
    
    if (this.charts.despesas) {
      this.charts.despesas.destroy();
    }

    const labels = Object.keys(despesasPorTipo);
    const values = Object.values(despesasPorTipo);

    console.log('Criando gráfico de despesas:', { labels, values });

    if (labels.length === 0) {
      context.fillStyle = '#ccc';
      context.font = '16px Arial';
      context.textAlign = 'center';
      context.fillText('Sem dados disponíveis', ctx.width / 2, ctx.height / 2);
      return;
    }

    this.charts.despesas = new Chart(context, {
      type: 'pie',
      data: {
        labels: labels.map(label => this.formatTipoLabel(label)),
        datasets: [{
          data: values,
          backgroundColor: [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
            '#9b59b6', '#1abc9c', '#34495e', '#d35400'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Distribuição de Despesas'
          }
        }
      }
    });
  }

  static formatTipoLabel(tipo) {
    const labels = {
      'salario': 'Salário',
      'freelance': 'Freelance',
      'rendimentos': 'Rendimentos',
      'poupanca': 'Poupança',
      'extra': 'Trabalhos Extras',
      'alimentacao': 'Alimentação',
      'transporte': 'Transporte',
      'lazer': 'Lazer',
      'compras': 'Compras',
      'farmacia': 'Farmácia',
      'educacao': 'Educação',
      'academia': 'Academia'
    };
    return labels[tipo] || tipo;
  }

  // Aplicar filtros
  static aplicarFiltros() {
    this.loadData();
  }

  // Limpar filtros
  static limparFiltros() {
    document.getElementById('filtroPeriodoDashboard').value = 'mes';
    document.getElementById('filtroDataInicioDashboard').value = '';
    document.getElementById('filtroDataFimDashboard').value = '';
    document.getElementById('filtroVisualizacaoDashboard').value = 'resumo';
    this.loadData();
  }

  // Mostrar/ocultar tabela detalhada
  static toggleTabelaDetalhada(visualizacao) {
    const tabelaDetalhada = document.getElementById('tabelaDetalhadaDashboard');
    if (tabelaDetalhada) {
      if (visualizacao === 'detalhado') {
        tabelaDetalhada.classList.remove('d-none');
        this.carregarTabelaDetalhada();
      } else {
        tabelaDetalhada.classList.add('d-none');
      }
    }
  }

  // Carregar tabela detalhada
  static async carregarTabelaDetalhada() {
    try {
      // Obter dados detalhados
      const periodo = document.getElementById('filtroPeriodoDashboard')?.value || 'mes';
      const dataInicio = document.getElementById('filtroDataInicioDashboard')?.value || '';
      const dataFim = document.getElementById('filtroDataFimDashboard')?.value || '';
      
      let queryString = `periodo=${periodo}`;
      if (dataInicio) queryString += `&data_inicio=${dataInicio}`;
      if (dataFim) queryString += `&data_fim=${dataFim}`;
      
      // Buscar entradas e despesas detalhadas
      const [entradas, despesas] = await Promise.all([
        Utils.apiCall(`/entradas?${queryString}`),
        Utils.apiCall(`/despesas?${queryString}`)
      ]);

      this.renderTabelaDetalhada(entradas, despesas);
    } catch (error) {
      console.error('Erro ao carregar tabela detalhada:', error);
    }
  }

  static renderTabelaDetalhada(entradas, despesas) {
    const container = document.getElementById('tabelaDetalhadaConteudo');
    if (!container) return;

    container.innerHTML = '';

    // Combinar e ordenar dados
    const todosDados = [
      ...(entradas || []).map(item => ({
        ...item,
        tipo: 'entrada',
        categoria: this.formatTipoLabel(item.tipo),
        data: item.data_entrada,
        valor: parseFloat(item.valor)
      })),
      ...(despesas || []).map(item => ({
        ...item,
        tipo: 'despesa',
        categoria: this.formatTipoLabel(item.tipo),
        data: item.data_despesa,
        valor: parseFloat(item.valor) * -1 // Valores negativos para despesas
      }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    if (todosDados.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-inbox display-4 d-block mb-2"></i>
            Nenhum registro encontrado
          </td>
        </tr>
      `;
      return;
    }

    todosDados.forEach(item => {
      const row = document.createElement('tr');
      const valorClass = item.valor >= 0 ? 'text-success' : 'text-danger';
      const valorPrefix = item.valor >= 0 ? '+' : '';
      
      row.innerHTML = `
        <td>${Utils.formatDate(item.data)}</td>
        <td>
          <span class="badge ${item.tipo === 'entrada' ? 'bg-success' : 'bg-danger'}">
            ${item.tipo === 'entrada' ? 'Entrada' : 'Despesa'}
          </span>
        </td>
        <td>${item.descricao || '-'}</td>
        <td class="${valorClass} fw-bold">${valorPrefix}${Utils.formatCurrency(Math.abs(item.valor))}</td>
        <td>${item.categoria}</td>
      `;
      container.appendChild(row);
    });
  }
}

// Event listeners para dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Filtro de período
  const filtroPeriodo = document.getElementById('filtroPeriodoDashboard');
  if (filtroPeriodo) {
    filtroPeriodo.addEventListener('change', (e) => {
      // Se for personalizado, mostrar campos de data
      const dataInicio = document.getElementById('filtroDataInicioDashboard');
      const dataFim = document.getElementById('filtroDataFimDashboard');
      
      if (e.target.value === 'personalizado') {
        dataInicio.style.display = 'block';
        dataFim.style.display = 'block';
      } else {
        dataInicio.style.display = 'none';
        dataFim.style.display = 'none';
        Dashboard.loadData();
      }
    });
  }

  // Filtros de data
  const filtroDataInicio = document.getElementById('filtroDataInicioDashboard');
  const filtroDataFim = document.getElementById('filtroDataFimDashboard');
  
  if (filtroDataInicio) {
    filtroDataInicio.addEventListener('change', () => {
      Dashboard.aplicarFiltros();
    });
  }
  
  if (filtroDataFim) {
    filtroDataFim.addEventListener('change', () => {
      Dashboard.aplicarFiltros();
    });
  }

  // Filtro de visualização
  const filtroVisualizacao = document.getElementById('filtroVisualizacaoDashboard');
  if (filtroVisualizacao) {
    filtroVisualizacao.addEventListener('change', (e) => {
      Dashboard.toggleTabelaDetalhada(e.target.value);
    });
  }
});