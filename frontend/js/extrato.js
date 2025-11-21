// Gerenciamento do Extrato do Cartão - CORRIGIDO
class Extrato {
    static currentCartao = null;
    static currentData = [];
    static resumo = {};

    static async carregarExtrato(cartaoId) {
        try {
            console.log('📋 CARREGANDO EXTRATO DO CARTÃO:', cartaoId);
            this.currentCartao = cartaoId;
            
            // Obter filtros de data
            const dataInicio = document.getElementById('filtroDataInicioExtrato')?.value || '';
            const dataFim = document.getElementById('filtroDataFimExtrato')?.value || '';
            
            // Construir query string
            let queryString = '';
            if (dataInicio) queryString += `&data_inicio=${dataInicio}`;
            if (dataFim) queryString += `&data_fim=${dataFim}`;
            
            // CORREÇÃO: Adicionar /api na URL
            // Carregar extrato
            const data = await Utils.apiCall(`/api/extrato/${cartaoId}?${queryString}`);
            console.log('📦 DADOS DO EXTRATO RECEBIDOS:', data);
            this.currentData = Array.isArray(data) ? data : [];
            
            // CORREÇÃO: Adicionar /api na URL
            // Carregar resumo
            const resumoData = await Utils.apiCall(`/api/extrato/${cartaoId}/resumo?${queryString}`);
            console.log('📊 RESUMO DO EXTRATO:', resumoData);
            this.resumo = resumoData;
            
            this.renderExtrato();
            this.renderResumo();
            
            // Mostrar alerta se não há dados
            if (this.currentData.length === 0) {
                console.log('⚠️  NENHUMA PARCELA ENCONTRADA PARA ESTE CARTÃO');
            }
            
        } catch (error) {
            console.error('❌ ERRO AO CARREGAR EXTRATO:', error);
            this.currentData = [];
            this.resumo = {};
            this.renderExtrato();
            this.renderResumo();
            Utils.showToast('Erro ao carregar extrato: ' + error.message, 'danger');
        }
    }

    static renderExtrato() {
        const container = document.getElementById('tabelaExtrato');
        if (!container) {
            console.log('❌ CONTAINER DO EXTRATO NÃO ENCONTRADO');
            return;
        }

        container.innerHTML = '';

        if (!this.currentData || this.currentData.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="bi bi-receipt display-1 d-block mb-3"></i>
                        <h4>Nenhuma parcela encontrada</h4>
                        <p class="mb-0">Este cartão não possui despesas parceladas registradas.</p>
                        <small>Para ver parcelas aqui, crie uma despesa parcelada usando este cartão.</small>
                    </td>
                </tr>
            `;
            return;
        }

        console.log(`✅ RENDERIZANDO ${this.currentData.length} PARCELAS`);

        this.currentData.forEach(parcela => {
            const row = document.createElement('tr');
            const statusClass = parcela.pago ? 'bg-success' : 'bg-warning';
            const statusText = parcela.pago ? 'Pago' : 'Pendente';
            const dataPagamento = parcela.data_pagamento ? Utils.formatDate(parcela.data_pagamento) : '-';
            const vencimentoClass = this.isVencida(parcela.data_vencimento) && !parcela.pago ? 'text-danger fw-bold' : '';
            
            row.innerHTML = `
                <td class="${vencimentoClass}">${Utils.formatDate(parcela.data_vencimento)}</td>
                <td>${parcela.descricao || 'Sem descrição'}</td>
                <td class="fw-bold">${Utils.formatCurrency(parcela.valor)}</td>
                <td>
                    <span class="badge bg-info">
                        ${parcela.parcela_numero}/${parcela.total_parcelas}
                    </span>
                </td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td>${dataPagamento}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        ${!parcela.pago ? `
                            <button class="btn btn-success" onclick="Extrato.marcarComoPago(${parcela.id})" 
                                    title="Marcar como pago">
                                <i class="bi bi-check-lg"></i> Pagar
                            </button>
                        ` : `
                            <button class="btn btn-warning" onclick="Extrato.desfazerPagamento(${parcela.id})" 
                                    title="Desfazer pagamento">
                                <i class="bi bi-arrow-counterclockwise"></i> Desfazer
                            </button>
                        `}
                    </div>
                </td>
            `;
            container.appendChild(row);
        });
    }

    static isVencida(dataVencimento) {
        const hoje = new Date();
        const vencimento = new Date(dataVencimento);
        return vencimento < hoje;
    }

    static renderResumo() {
        const container = document.getElementById('resumoExtrato');
        if (!container) {
            console.log('❌ CONTAINER DO RESUMO NÃO ENCONTRADO');
            return;
        }

        console.log('📊 RENDERIZANDO RESUMO:', this.resumo);

        container.innerHTML = `
            <div class="row">
                <div class="col-md-4 mb-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h3 class="mb-1">${Utils.formatCurrency(this.resumo.total || 0)}</h3>
                            <p class="mb-0"><i class="bi bi-currency-dollar"></i> Total</p>
                            <small>${this.resumo.quantidade || 0} parcelas</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h3 class="mb-1">${Utils.formatCurrency(this.resumo.pago || 0)}</h3>
                            <p class="mb-0"><i class="bi bi-check-circle"></i> Pago</p>
                            <small>${this.resumo.quantidade_pago || 0} parcelas</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="card bg-warning text-white">
                        <div class="card-body text-center">
                            <h3 class="mb-1">${Utils.formatCurrency(this.resumo.pendente || 0)}</h3>
                            <p class="mb-0"><i class="bi bi-clock"></i> Pendente</p>
                            <small>${this.resumo.quantidade_pendente || 0} parcelas</small>
                        </div>
                    </div>
                </div>
            </div>
            
            ${this.resumo.pendente > 0 ? `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> 
                <strong>Próximos passos:</strong> Você tem ${this.resumo.quantidade_pendente || 0} parcelas pendentes no valor total de ${Utils.formatCurrency(this.resumo.pendente || 0)}
            </div>
            ` : ''}
        `;
    }

    static async marcarComoPago(id) {
        if (confirm('Deseja marcar esta parcela como paga?\n\nEsta ação registrará a data atual como data de pagamento.')) {
            try {
                console.log(`💳 MARCANDO PARCELA ${id} COMO PAGA`);
                
                const parcela = this.currentData.find(p => p.id === id);
                if (parcela) {
                    console.log('📝 DADOS DA PARCELA:', parcela);
                }
                
                // CORREÇÃO: Adicionar /api na URL
                await Utils.apiCall(`/api/extrato/${id}/pagar`, {
                    method: 'PUT'
                });

                Utils.showToast('✅ Parcela marcada como paga com sucesso!', 'success');
                
                // Recarregar os dados
                await this.carregarExtrato(this.currentCartao);
                
            } catch (error) {
                console.error('❌ ERRO AO MARCAR PARCELA COMO PAGA:', error);
                Utils.showToast('❌ Erro ao marcar parcela como paga: ' + error.message, 'danger');
            }
        }
    }

    static async desfazerPagamento(id) {
        if (confirm('Deseja desfazer o pagamento desta parcela?\n\nEsta ação removerá a data de pagamento.')) {
            try {
                console.log(`↩️ DESFAZENDO PAGAMENTO DA PARCELA ${id}`);
                
                // CORREÇÃO: Adicionar /api na URL
                await Utils.apiCall(`/api/extrato/${id}/desfazer-pagamento`, {
                    method: 'PUT'
                });

                Utils.showToast('↩️ Pagamento desfeito com sucesso!', 'warning');
                
                // Recarregar os dados
                await this.carregarExtrato(this.currentCartao);
                
            } catch (error) {
                console.error('❌ ERRO AO DESFAZER PAGAMENTO:', error);
                Utils.showToast('❌ Erro ao desfazer pagamento: ' + error.message, 'danger');
            }
        }
    }

    static voltarParaCartoes() {
        console.log('🔙 VOLTANDO PARA PÁGINA DE CARTÕES');
        
        // Limpar dados do cartão atual
        localStorage.removeItem('currentCartaoId');
        localStorage.removeItem('currentCartaoNome');
        
        app.navigateTo('cartoes');
    }

    // Aplicar filtros de data
    static aplicarFiltros() {
        this.carregarExtrato(this.currentCartao);
    }

    // Limpar filtros de data
    static limparFiltrosData() {
        document.getElementById('filtroDataInicioExtrato').value = '';
        document.getElementById('filtroDataFimExtrato').value = '';
        this.carregarExtrato(this.currentCartao);
    }

    // Método para debug - testar conexão com API
    static async testarConexao(cartaoId) {
        try {
            console.log('🧪 TESTANDO CONEXÃO COM API...');
            // CORREÇÃO: Adicionar /api na URL
            const response = await Utils.apiCall(`/api/extrato/${cartaoId}`);
            console.log('✅ RESPOSTA DA API:', response);
            return response;
        } catch (error) {
            console.error('❌ ERRO NO TESTE DE CONEXÃO:', error);
            return null;
        }
    }
}

// Event listener para carregar extrato quando a página for aberta
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 EXTRATO.JS CARREGADO - PRONTO PARA USO!');
    
    // Event listeners para filtros de data
    const filtroDataInicio = document.getElementById('filtroDataInicioExtrato');
    const filtroDataFim = document.getElementById('filtroDataFimExtrato');
    
    if (filtroDataInicio) {
        filtroDataInicio.addEventListener('change', () => {
            if (Extrato.currentCartao) {
                Extrato.aplicarFiltros();
            }
        });
    }
    
    if (filtroDataFim) {
        filtroDataFim.addEventListener('change', () => {
            if (Extrato.currentCartao) {
                Extrato.aplicarFiltros();
            }
        });
    }

    // Botão limpar filtros
    const btnLimparFiltros = document.getElementById('btnLimparFiltrosExtrato');
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', () => {
            Extrato.limparFiltrosData();
        });
    }

    // Verificar se estamos na página de extrato
    const isExtratoPage = document.getElementById('extrato-page');
    if (isExtratoPage && !isExtratoPage.classList.contains('d-none')) {
        const cartaoId = localStorage.getItem('currentCartaoId');
        const cartaoNome = localStorage.getItem('currentCartaoNome');
        
        console.log('🔄 PÁGINA DE EXTRATO DETECTADA:', {
            cartaoId: cartaoId,
            cartaoNome: cartaoNome,
            paginaVisivel: !isExtratoPage.classList.contains('d-none')
        });
        
        if (cartaoId) {
            console.log('🚀 INICIANDO CARREGAMENTO AUTOMÁTICO DO EXTRATO');
            Extrato.carregarExtrato(cartaoId);
        } else {
            console.log('❌ NENHUM CARTÃO SELECIONADO PARA EXTRATO');
        }
    }
});