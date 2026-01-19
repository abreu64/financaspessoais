// Gerenciamento do Stripe no Frontend
class StripeManager {
    static async init() {
        const btnAssinar = document.getElementById('btnAssinarMensal');
        const btnGerenciar = document.getElementById('btnGerenciarAssinatura');

        if (btnAssinar) {
            btnAssinar.addEventListener('click', () => this.createCheckoutSession());
        }

        if (btnGerenciar) {
            btnGerenciar.addEventListener('click', () => this.createPortalSession());
        }

        this.updateUI();
    }

    static async updateUI() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) return;

            // 1. Buscar status real do servidor (inclui preço e trial_end do Stripe)
            const response = await fetch(`${API_BASE_URL}/api/stripe/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            const portalContainer = document.getElementById('portalContainer');
            const btnAssinar = document.getElementById('btnAssinarMensal');
            const trialText = document.querySelector('.card-body .list-unstyled li:first-child');
            const planDescription = document.querySelector('#assinatura-page p.text-muted');
            const priceElement = document.querySelector('.card-body .h1.fw-bold');

            // 2. Atualizar Preço (Vindo do Stripe)
            if (priceElement && data.price) {
                const amount = (data.price.unit_amount / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });
                priceElement.innerText = amount;
            }

            // 3. Lógica de Status e Rembretes de Teste
            if (data.status === 'active') {
                if (portalContainer) portalContainer.classList.remove('d-none');
                if (btnAssinar) {
                    btnAssinar.innerText = 'Plano Ativo';
                    btnAssinar.disabled = true;
                    btnAssinar.classList.replace('btn-warning', 'btn-outline-success');
                }
                if (trialText) trialText.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Plano Ativo e Vitalício';
            } else if (data.status === 'trialing') {
                if (portalContainer) portalContainer.classList.remove('d-none');

                let remainingMsg = 'Teste grátis disponível!';
                const diffTime = data.trial_end - data.server_time;
                const diffDays = Math.ceil(diffTime / (60 * 60 * 24));

                if (diffTime > 86400) {
                    remainingMsg = `Seu teste expira em <strong>${diffDays} dias</strong>`;
                } else if (diffTime > 0) {
                    const hours = Math.floor(diffTime / 3600);
                    remainingMsg = `Seu teste expira em <strong>${hours} horas</strong>`;
                } else {
                    remainingMsg = 'Seu período de teste <strong>expirou!</strong>';
                }

                if (btnAssinar) {
                    btnAssinar.innerText = diffTime > 0 ? 'Assinar Plano Agora' : 'Ativar Meu Plano Agora';
                    btnAssinar.classList.remove('btn-warning');
                    btnAssinar.classList.add('btn-primary');
                }
                if (trialText) {
                    trialText.innerHTML = `<i class="bi bi-clock-history text-primary"></i> ${remainingMsg}`;
                }
                if (planDescription) {
                    planDescription.innerText = diffTime > 0
                        ? 'Aproveite seu teste! Assine agora para garantir acesso contínuo.'
                        : 'Seu teste expirou. Assine agora para continuar usando todos os recursos.';
                }

                // 4. Alerta no Dashboard
                const dashboardAlert = document.getElementById('trial-alert-dashboard');
                if (dashboardAlert) {
                    let alertType = 'info';
                    let icon = 'bi-info-circle-fill';
                    let bannerMsg = `<strong>Teste Grátis:</strong> ${remainingMsg}.`;
                    let linkText = 'Assinar Plano Agora';

                    if (diffTime <= 0) {
                        alertType = 'warning';
                        icon = 'bi-exclamation-octagon-fill';
                        bannerMsg = '<strong>Atenção:</strong> Seu período de teste gratuito expirou.';
                        linkText = 'Ativar Meu Plano Agora';
                    } else if (diffDays <= 3) {
                        alertType = 'danger';
                        icon = 'bi-exclamation-triangle-fill';
                    }

                    dashboardAlert.innerHTML = `
                        <div class="alert alert-${alertType} alert-dismissible fade show shadow-sm border-0 mb-4" role="alert">
                            <div class="d-flex align-items-center">
                                <i class="bi ${icon} me-3 fs-4"></i>
                                <div>
                                    ${bannerMsg}
                                    <a href="#" onclick="app.navigateTo('assinatura')" class="alert-link ms-2 text-decoration-underline">${linkText}</a> para garantir seu acesso.
                                </div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>
                    `;
                }
            } else {
                // Se não está nem em teste nem ativo (ex: expirou)
                const dashboardAlert = document.getElementById('trial-alert-dashboard');
                if (dashboardAlert) dashboardAlert.innerHTML = '';
            }
        } catch (error) {
            console.error('Erro ao atualizar UI do Stripe:', error);
        }
    }

    static async createCheckoutSession() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                Utils.showToast('Você precisa estar logado para assinar.', 'danger');
                return;
            }

            Utils.showToast('Preparando checkout...', 'info');

            const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    // O priceId será pego do .env no backend se não enviado aqui
                })
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Erro ao criar sessão de checkout');
            }
        } catch (error) {
            console.error('Erro Stripe:', error);
            Utils.showToast('Erro ao iniciar pagamento: ' + error.message, 'danger');
        }
    }

    static async createPortalSession() {
        try {
            const token = sessionStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/stripe/create-portal-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Erro ao criar sessão do portal');
            }
        } catch (error) {
            console.error('Erro Portal Stripe:', error);
            Utils.showToast('Erro ao abrir portal: ' + error.message, 'danger');
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    StripeManager.init();
});
