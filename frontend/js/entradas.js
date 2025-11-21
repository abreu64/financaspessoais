// Gerenciamento de Entradas - CORRIGIDO
class Entradas {
  static currentData = [];

  static async loadData() {
    try {
      console.log('Carregando entradas...');
      
      // Obter filtros
      const periodo = document.getElementById('filtroPeriodoEntradas')?.value || 'mes';
      const dataInicio = document.getElementById('filtroDataInicioEntradas')?.value || '';
      const dataFim = document.getElementById('filtroDataFimEntradas')?.value || '';
      
      // Construir query string
      let queryString = `periodo=${periodo}`;
      if (dataInicio) queryString += `&data_inicio=${dataInicio}`;
      if (dataFim) queryString += `&data_fim=${dataFim}`;
      
      // CORREÇÃO: Adicionar /api na URL
      const data = await Utils.apiCall(`/api/entradas?${queryString}`);
      console.log('Entradas carregadas:', data);
      this.currentData = Array.isArray(data) ? data : [];
      this.renderTable(this.currentData);
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
      this.currentData = [];
      this.renderTable([]);
    }
  }

  static renderTable(data) {
    const tbody = document.getElementById('tabelaEntradas');
    if (!tbody) {
      console.log('Tabela de entradas não encontrada');
      return;
    }

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-inbox display-4 d-block mb-2"></i>
            Nenhuma entrada registrada
          </td>
        </tr>
      `;
      return;
    }

    data.forEach(entrada => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${Utils.formatDate(entrada.data_entrada)}</td>
        <td>${this.getTipoLabel(entrada.tipo)}</td>
        <td class="text-success fw-bold">${Utils.formatCurrency(entrada.valor)}</td>
        <td>${this.getFormaRecebimentoLabel(entrada.forma_recebimento)}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="Entradas.editar(${entrada.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="Entradas.excluir(${entrada.id})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  static getTipoLabel(tipo) {
    const tipos = {
      'salario': 'Salário',
      'freelance': 'Freelance',
      'rendimentos': 'Rendimentos',
      'poupanca': 'Poupança',
      'extra': 'Trabalhos Extras'
    };
    return tipos[tipo] || tipo;
  }

  static getFormaRecebimentoLabel(forma) {
    const formas = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'cheque': 'Cheque'
    };
    return formas[forma] || forma;
  }

  static async salvar() {
    const form = document.getElementById('formEntrada');
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.valor = parseFloat(data.valor);

    try {
      // CORREÇÃO: Adicionar /api na URL
      await Utils.apiCall('/api/entradas', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      Utils.showToast('Entrada salva com sucesso!', 'success');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEntrada'));
      if (modal) modal.hide();
      
      form.reset();
      this.loadData();
      Dashboard.loadData();
    } catch (error) {
      Utils.showToast('Erro ao salvar entrada', 'danger');
    }
  }

  static editar(id) {
    const entrada = this.currentData.find(e => e.id === id);
    if (entrada) {
      const form = document.getElementById('formEntrada');
      Object.keys(entrada).forEach(key => {
        if (form.elements[key]) {
          form.elements[key].value = entrada[key];
        }
      });

      const modal = new bootstrap.Modal(document.getElementById('modalEntrada'));
      modal.show();

      const salvarBtn = document.getElementById('salvarEntrada');
      salvarBtn.onclick = () => this.atualizar(id);
    }
  }

  static async atualizar(id) {
    const form = document.getElementById('formEntrada');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.valor = parseFloat(data.valor);

    try {
      // CORREÇÃO: Adicionar /api na URL
      await Utils.apiCall(`/api/entradas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      Utils.showToast('Entrada atualizada com sucesso!', 'success');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEntrada'));
      if (modal) modal.hide();
      
      form.reset();
      this.loadData();
      Dashboard.loadData();
      
      // Restaurar comportamento padrão do botão
      const salvarBtn = document.getElementById('salvarEntrada');
      salvarBtn.onclick = () => this.salvar();
    } catch (error) {
      Utils.showToast('Erro ao atualizar entrada', 'danger');
    }
  }

  static async excluir(id) {
    if (confirm('Tem certeza que deseja excluir esta entrada?')) {
      try {
        // CORREÇÃO: Adicionar /api na URL
        await Utils.apiCall(`/api/entradas/${id}`, {
          method: 'DELETE'
        });

        Utils.showToast('Entrada excluída com sucesso!', 'success');
        this.loadData();
        Dashboard.loadData();
      } catch (error) {
        Utils.showToast('Erro ao excluir entrada', 'danger');
      }
    }
  }

  // Aplicar filtros
  static aplicarFiltros() {
    this.loadData();
  }

  // Limpar filtros de data
  static limparFiltrosData() {
    document.getElementById('filtroDataInicioEntradas').value = '';
    document.getElementById('filtroDataFimEntradas').value = '';
    this.loadData();
  }
}

// Event listeners para entradas
document.addEventListener('DOMContentLoaded', () => {
  // Filtro de período
  const filtroPeriodo = document.getElementById('filtroPeriodoEntradas');
  if (filtroPeriodo) {
    filtroPeriodo.addEventListener('change', () => {
      Entradas.loadData();
    });
  }

  // Filtros de data
  const filtroDataInicio = document.getElementById('filtroDataInicioEntradas');
  const filtroDataFim = document.getElementById('filtroDataFimEntradas');
  
  if (filtroDataInicio) {
    filtroDataInicio.addEventListener('change', () => {
      Entradas.aplicarFiltros();
    });
  }
  
  if (filtroDataFim) {
    filtroDataFim.addEventListener('change', () => {
      Entradas.aplicarFiltros();
    });
  }

  // Botão limpar filtros
  const btnLimparFiltros = document.getElementById('btnLimparFiltrosEntradas');
  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
      Entradas.limparFiltrosData();
    });
  }

  // Salvar entrada
  const salvarBtn = document.getElementById('salvarEntrada');
  if (salvarBtn) {
    salvarBtn.addEventListener('click', () => {
      Entradas.salvar();
    });
  }

  // Limpar formulário ao fechar modal
  const modalEntrada = document.getElementById('modalEntrada');
  if (modalEntrada) {
    modalEntrada.addEventListener('hidden.bs.modal', () => {
      const form = document.getElementById('formEntrada');
      if (form) form.reset();
      
      const salvarBtn = document.getElementById('salvarEntrada');
      if (salvarBtn) {
        salvarBtn.onclick = () => Entradas.salvar();
      }
    });
  }
});