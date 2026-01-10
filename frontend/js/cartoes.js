// Gerenciamento de Cartões - CORRIGIDO
class Cartoes {
    static currentData = [];

    static async loadData() {
        try {
            console.log('💳 CARREGANDO CARTÕES...');
            // CORREÇÃO: Adicionar /api na URL
            const data = await Utils.apiCall('/api/cartoes');
            console.log('✅ CARTÕES CARREGADOS:', data);
            this.currentData = Array.isArray(data) ? data : [];
            this.renderCards(this.currentData);
        } catch (error) {
            console.error('❌ ERRO AO CARREGAR CARTÕES:', error);
            this.currentData = [];
            this.renderCards([]);
            Utils.showToast('Erro ao carregar cartões: ' + error.message, 'danger');
        }
    }

    static renderCards(data) {
        const container = document.getElementById('listaCartoes');
        if (!container) {
            console.log('❌ CONTAINER DE CARTÕES NÃO ENCONTRADO');
            return;
        }

        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card text-center py-5">
                        <div class="card-body">
                            <i class="bi bi-credit-card display-4 text-muted mb-3"></i>
                            <h5 class="card-title">Nenhum cartão cadastrado</h5>
                            <p class="text-muted mb-4">Adicione seu primeiro cartão para começar o controle das suas finanças</p>
                            <button class="btn btn-primary btn-lg" data-bs-toggle="modal" data-bs-target="#modalCartao">
                                <i class="bi bi-plus-circle"></i> Adicionar Primeiro Cartão
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        console.log(`🎯 RENDERIZANDO ${data.length} CARTÕES`);

        data.forEach(cartao => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 mb-4';
            col.innerHTML = this.createCardHTML(cartao);
            container.appendChild(col);
        });
    }

    static createCardHTML(cartao) {
        const bandeiraClass = this.getBandeiraClass(cartao.bandeira);
        const bandeiraLabel = this.getBandeiraLabel(cartao.bandeira);

        return `
            <div class="card card-credit ${bandeiraClass}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5 class="card-title mb-1">${cartao.nome}</h5>
                            <small class="opacity-75">${bandeiraLabel}</small>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <small class="opacity-75">Limite Disponível</small>
                        <div class="h4 mb-1">${Utils.formatCurrency(cartao.limite)}</div>
                    </div>
                    
                    <div class="row text-center mb-1">
                        <div class="col-6">
                            <small class="opacity-75">Fechamento</small>
                            <div class="fw-bold">Dia ${cartao.data_fechamento}</div>
                        </div>
                        <div class="col-6">
                            <small class="opacity-75">Vencimento</small>
                            <div class="fw-bold">Dia ${cartao.data_vencimento}</div>
                        </div>
                    </div>
                    
                    <div class="mt-4 dropdown">
                        <button class="btn btn-outline-light w-100 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-list-check"></i> Opções do Cartão
                        </button>
                        <ul class="dropdown-menu w-100 shadow">
                            <li>
                                <a class="dropdown-item py-2" href="#" onclick="Cartoes.verExtrato(${cartao.id}, '${cartao.nome}')">
                                    <i class="bi bi-receipt text-primary me-2"></i> <strong>Ver Extrato Completo</strong>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item py-2" href="#" onclick="Cartoes.testarExtrato(${cartao.id}, '${cartao.nome}')">
                                    <i class="bi bi-bug text-info me-2"></i> Testar Conexão
                                </a>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item py-2" href="#" onclick="Cartoes.editar(${cartao.id})">
                                    <i class="bi bi-pencil text-warning me-2"></i> Editar Cartão
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item py-2 text-danger" href="#" onclick="Cartoes.excluir(${cartao.id})">
                                    <i class="bi bi-trash me-2"></i> Excluir Cartão
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    static getBandeiraClass(bandeira) {
        const classes = {
            'visa': 'visa',
            'mastercard': 'mastercard',
            'elo': 'elo',
            'american': 'american'
        };
        return classes[bandeira] || '';
    }

    static getBandeiraLabel(bandeira) {
        const bandeiras = {
            'visa': 'Visa',
            'mastercard': 'MasterCard',
            'elo': 'Elo',
            'american': 'American Express'
        };
        return bandeiras[bandeira] || bandeira;
    }

    static verExtrato(cartaoId, cartaoNome) {
        console.log('🔍 ABRINDO EXTRATO DO CARTÃO:', cartaoId, cartaoNome);

        // Salvar informações do cartão selecionado
        sessionStorage.setItem('currentCartaoId', cartaoId);
        sessionStorage.setItem('currentCartaoNome', cartaoNome);

        console.log('💾 DADOS SALVOS NO SESSIONSTORAGE:', {
            cartaoId: sessionStorage.getItem('currentCartaoId'),
            cartaoNome: sessionStorage.getItem('currentCartaoNome')
        });

        // Navegar para a página de extrato
        app.navigateTo('extrato');
    }

    static async testarExtrato(cartaoId, cartaoNome) {
        console.log('🧪 TESTANDO EXTRATO DO CARTÃO:', cartaoId, cartaoNome);

        try {
            Utils.showToast('🧪 Testando conexão com extrato...', 'info');

            const resultado = await Extrato.testarConexao(cartaoId);

            if (resultado && Array.isArray(resultado)) {
                Utils.showToast(`✅ Teste OK! ${resultado.length} parcelas encontradas`, 'success');
                console.log('📊 RESULTADO DO TESTE:', resultado);
            } else {
                Utils.showToast('ℹ️  Nenhuma parcela encontrada para este cartão', 'info');
            }
        } catch (error) {
            Utils.showToast('❌ Erro no teste: ' + error.message, 'danger');
        }
    }

    static async salvar() {
        const form = document.getElementById('formCartao');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        data.limite = parseFloat(data.limite);
        data.data_fechamento = parseInt(data.data_fechamento);
        data.data_vencimento = parseInt(data.data_vencimento);

        try {
            console.log('💾 SALVANDO CARTÃO:', data);

            // CORREÇÃO: Adicionar /api na URL
            await Utils.apiCall('/api/cartoes', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            Utils.showToast('✅ Cartão salvo com sucesso!', 'success');

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCartao'));
            if (modal) modal.hide();

            form.reset();
            await this.loadData(); // Recarregar a lista

        } catch (error) {
            console.error('❌ ERRO AO SALVAR CARTÃO:', error);
            Utils.showToast('❌ Erro ao salvar cartão: ' + error.message, 'danger');
        }
    }

    static editar(id) {
        const cartao = this.currentData.find(c => c.id === id);
        if (cartao) {
            console.log('✏️  EDITANDO CARTÃO:', cartao);

            const form = document.getElementById('formCartao');
            Object.keys(cartao).forEach(key => {
                if (form.elements[key]) {
                    form.elements[key].value = cartao[key];
                }
            });

            const modal = new bootstrap.Modal(document.getElementById('modalCartao'));
            modal.show();

            const salvarBtn = document.getElementById('salvarCartao');
            salvarBtn.onclick = () => this.atualizar(id);
        }
    }

    static async atualizar(id) {
        const form = document.getElementById('formCartao');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        data.limite = parseFloat(data.limite);
        data.data_fechamento = parseInt(data.data_fechamento);
        data.data_vencimento = parseInt(data.data_vencimento);

        try {
            console.log('🔄 ATUALIZANDO CARTÃO:', id, data);

            // CORREÇÃO: Adicionar /api na URL
            await Utils.apiCall(`/api/cartoes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            Utils.showToast('✅ Cartão atualizado com sucesso!', 'success');

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCartao'));
            if (modal) modal.hide();

            form.reset();
            await this.loadData();

            // Restaurar comportamento padrão do botão
            const salvarBtn = document.getElementById('salvarCartao');
            salvarBtn.onclick = () => this.salvar();

        } catch (error) {
            console.error('❌ ERRO AO ATUALIZAR CARTÃO:', error);
            Utils.showToast('❌ Erro ao atualizar cartão: ' + error.message, 'danger');
        }
    }

    static async excluir(id) {
        const cartao = this.currentData.find(c => c.id === id);
        if (!cartao) return;

        if (confirm(`Tem certeza que deseja excluir o cartão "${cartao.nome}"?\n\nEsta ação não pode ser desfeita.`)) {
            try {
                console.log('🗑️  EXCLUINDO CARTÃO:', id);

                // CORREÇÃO: Adicionar /api na URL
                await Utils.apiCall(`/api/cartoes/${id}`, {
                    method: 'DELETE'
                });

                Utils.showToast('✅ Cartão excluído com sucesso!', 'success');
                await this.loadData();

            } catch (error) {
                console.error('❌ ERRO AO EXCLUIR CARTÃO:', error);
                Utils.showToast('❌ Erro ao excluir cartão: ' + error.message, 'danger');
            }
        }
    }
}

// Event listeners para cartões
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 CARTÕES.JS CARREGADO - PRONTO PARA USO!');

    const salvarBtn = document.getElementById('salvarCartao');
    if (salvarBtn) {
        salvarBtn.addEventListener('click', () => {
            Cartoes.salvar();
        });
    }

    const modalCartao = document.getElementById('modalCartao');
    if (modalCartao) {
        modalCartao.addEventListener('hidden.bs.modal', () => {
            const form = document.getElementById('formCartao');
            if (form) {
                form.reset();
                console.log('🧹 FORMULÁRIO LIMPO APÓS FECHAR MODAL');
            }

            const salvarBtn = document.getElementById('salvarCartao');
            if (salvarBtn) {
                salvarBtn.onclick = () => Cartoes.salvar();
                console.log('🔧 COMPORTAMENTO DO BOTÃO RESTAURADO');
            }
        });
    }
});