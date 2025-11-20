// Gerenciamento de Despesas
class Despesas {
  static currentData = [];

  static async loadData() {
    try {
      console.log('Carregando despesas...');
      
      // Obter filtros
      const periodo = document.getElementById('filtroPeriodoDespesas')?.value || 'mes';
      const dataInicio = document.getElementById('filtroDataInicioDespesas')?.value || '';
      const dataFim = document.getElementById('filtroDataFimDespesas')?.value || '';
      
      // Construir query string
      let queryString = `periodo=${periodo}`;
      if (dataInicio) queryString += `&data_inicio=${dataInicio}`;
      if (dataFim) queryString += `&data_fim=${dataFim}`;
      
      const data = await Utils.apiCall(`/despesas?${queryString}`);
      console.log('Despesas carregadas:', data);
      this.currentData = Array.isArray(data) ? data : [];
      this.renderTable(this.currentData);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      this.currentData = [];
      this.renderTable([]);
    }
  }

  static renderTable(data) {
    const tbody = document.getElementById('tabelaDespesas');
    if (!tbody) {
      console.log('Tabela de despesas não encontrada');
      return;
    }

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            <i class="bi bi-inbox display-4 d-block mb-2"></i>
            Nenhuma despesa registrada
          </td>
        </tr>
      `;
      return;
    }

    data.forEach(despesa => {
      const row = document.createElement('tr');
      const parcelasInfo = despesa.parcelas > 1 ? ` (${despesa.parcelas}x)` : '';
      
      row.innerHTML = `
        <td>${Utils.formatDate(despesa.data_despesa)}</td>
        <td>${this.getTipoLabel(despesa.tipo)}</td>
        <td class="text-danger fw-bold">${Utils.formatCurrency(despesa.valor)}${parcelasInfo}</td>
        <td>${this.getFormaPagamentoLabel(despesa.tipo_pagamento)}</td>
        <td>${despesa.local || '-'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="Despesas.editar(${despesa.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="Despesas.excluir(${despesa.id})">
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
      'compras': 'Compras',
      'farmacia': 'Farmácia',
      'educacao': 'Educação',
      'lazer': 'Lazer',
      'academia': 'Academia',
      'transporte': 'Transporte',
      'alimentacao': 'Alimentação'
    };
    return tipos[tipo] || tipo;
  }

  static getFormaPagamentoLabel(forma) {
    const formas = {
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito',
      'pix': 'PIX',
      'dinheiro': 'Dinheiro'
    };
    return formas[forma] || forma;
  }

  static async salvar() {
    const form = document.getElementById('formDespesa');
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.valor = parseFloat(data.valor);
    data.parcelas = parseInt(data.parcelas) || 1;

    // Se não for cartão de crédito, remover cartao_id
    if (data.tipo_pagamento !== 'credito') {
      delete data.cartao_id;
    }

    try {
      await Utils.apiCall('/despesas', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      Utils.showToast('Despesa salva com sucesso!', 'success');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalDespesa'));
      if (modal) modal.hide();
      
      form.reset();
      this.loadData();
      Dashboard.loadData();
    } catch (error) {
      Utils.showToast('Erro ao salvar despesa', 'danger');
    }
  }

  static editar(id) {
    const despesa = this.currentData.find(d => d.id === id);
    if (despesa) {
      const form = document.getElementById('formDespesa');
      Object.keys(despesa).forEach(key => {
        if (form.elements[key]) {
          form.elements[key].value = despesa[key];
        }
      });

      // Mostrar/ocultar campo de cartão baseado no tipo de pagamento
      const campoCartao = document.getElementById('campoCartao');
      if (despesa.tipo_pagamento === 'credito') {
        campoCartao.style.display = 'block';
        this.carregarCartoes(despesa.cartao_id);
      } else {
        campoCartao.style.display = 'none';
      }

      const modal = new bootstrap.Modal(document.getElementById('modalDespesa'));
      modal.show();

      const salvarBtn = document.getElementById('salvarDespesa');
      salvarBtn.onclick = () => this.atualizar(id);
    }
  }

  static async carregarCartoes(cartaoSelecionado = null) {
    try {
      const data = await Utils.apiCall('/cartoes');
      const selectCartao = document.querySelector('select[name="cartao_id"]');
      
      if (selectCartao && data) {
        selectCartao.innerHTML = '<option value="">Selecione o cartão...</option>';
        data.forEach(cartao => {
          const option = document.createElement('option');
          option.value = cartao.id;
          option.textContent = `${cartao.nome} (${cartao.bandeira})`;
          option.selected = cartao.id === cartaoSelecionado;
          selectCartao.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cartões:', error);
    }
  }

  static async atualizar(id) {
    const form = document.getElementById('formDespesa');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.valor = parseFloat(data.valor);
    data.parcelas = parseInt(data.parcelas) || 1;

    try {
      await Utils.apiCall(`/despesas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      Utils.showToast('Despesa atualizada com sucesso!', 'success');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalDespesa'));
      if (modal) modal.hide();
      
      form.reset();
      this.loadData();
      Dashboard.loadData();
      
      // Restaurar comportamento padrão do botão
      const salvarBtn = document.getElementById('salvarDespesa');
      salvarBtn.onclick = () => this.salvar();
    } catch (error) {
      Utils.showToast('Erro ao atualizar despesa', 'danger');
    }
  }

  static async excluir(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await Utils.apiCall(`/despesas/${id}`, {
          method: 'DELETE'
        });

        Utils.showToast('Despesa excluída com sucesso!', 'success');
        this.loadData();
        Dashboard.loadData();
      } catch (error) {
        Utils.showToast('Erro ao excluir despesa', 'danger');
      }
    }
  }

  // Aplicar filtros
  static aplicarFiltros() {
    this.loadData();
  }

  // Limpar filtros de data
  static limparFiltrosData() {
    document.getElementById('filtroDataInicioDespesas').value = '';
    document.getElementById('filtroDataFimDespesas').value = '';
    this.loadData();
  }
}

// Event listeners para despesas
document.addEventListener('DOMContentLoaded', () => {
  const filtroPeriodo = document.getElementById('filtroPeriodoDespesas');
  if (filtroPeriodo) {
    filtroPeriodo.addEventListener('change', () => {
      Despesas.loadData();
    });
  }

  // Filtros de data
  const filtroDataInicio = document.getElementById('filtroDataInicioDespesas');
  const filtroDataFim = document.getElementById('filtroDataFimDespesas');
  
  if (filtroDataInicio) {
    filtroDataInicio.addEventListener('change', () => {
      Despesas.aplicarFiltros();
    });
  }
  
  if (filtroDataFim) {
    filtroDataFim.addEventListener('change', () => {
      Despesas.aplicarFiltros();
    });
  }

  // Botão limpar filtros
  const btnLimparFiltros = document.getElementById('btnLimparFiltrosDespesas');
  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
      Despesas.limparFiltrosData();
    });
  }

  const salvarBtn = document.getElementById('salvarDespesa');
  if (salvarBtn) {
    salvarBtn.addEventListener('click', () => {
      Despesas.salvar();
    });
  }

  // Controle do campo de cartão baseado no tipo de pagamento
  const tipoPagamentoSelect = document.querySelector('select[name="tipo_pagamento"]');
  const campoCartao = document.getElementById('campoCartao');
  
  if (tipoPagamentoSelect && campoCartao) {
    tipoPagamentoSelect.addEventListener('change', (e) => {
      if (e.target.value === 'credito') {
        campoCartao.style.display = 'block';
        Despesas.carregarCartoes();
      } else {
        campoCartao.style.display = 'none';
      }
    });
  }

  const modalDespesa = document.getElementById('modalDespesa');
  if (modalDespesa) {
    modalDespesa.addEventListener('hidden.bs.modal', () => {
      const form = document.getElementById('formDespesa');
      if (form) form.reset();
      
      const salvarBtn = document.getElementById('salvarDespesa');
      if (salvarBtn) {
        salvarBtn.onclick = () => Despesas.salvar();
      }
      
      // Ocultar campo de cartão ao fechar modal
      if (campoCartao) {
        campoCartao.style.display = 'none';
      }
    });
  }
});