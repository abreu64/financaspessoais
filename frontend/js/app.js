// Configuração base da aplicação
const API_BASE_URL = 'https://financaspessoais-62pd.onrender.com';

// Função para obter token de autenticação
const getAuthToken = () => {
  return sessionStorage.getItem('authToken');
};

// Gerenciamento de páginas
class App {
  constructor() {
    this.currentPage = 'dashboard';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDarkMode();
    this.checkAuth();
  }

  setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.getAttribute('data-page') || e.target.closest('.nav-link').getAttribute('data-page');
        this.navigateTo(page);
      });
    });

    // Dark Mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', (e) => {
        this.toggleDarkMode(e.target.checked);
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }
  }

  navigateTo(page) {
    console.log('Navegando para:', page);

    // Atualizar navegação
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    // Controlar visibilidade do link do extrato
    const navExtrato = document.getElementById('navExtrato');
    if (navExtrato) {
      if (page === 'extrato') {
        navExtrato.style.display = 'block';
        navExtrato.classList.add('active');
      } else {
        navExtrato.style.display = 'none';
        navExtrato.classList.remove('active');
      }
    }

    // Esconder todas as páginas
    document.querySelectorAll('.page').forEach(pageElement => {
      pageElement.classList.add('d-none');
    });

    // Mostrar página atual
    const currentPageElement = document.getElementById(`${page}-page`);
    if (currentPageElement) {
      currentPageElement.classList.remove('d-none');
    }

    // Atualizar estado
    this.currentPage = page;

    // Carregar dados específicos da página
    setTimeout(() => {
      this.loadPageData(page);
    }, 100);
  }

  loadPageData(page) {
    console.log('Carregando dados para:', page);
    switch (page) {
      case 'dashboard':
        Dashboard.loadData();
        break;
      case 'entradas':
        Entradas.loadData();
        break;
      case 'despesas':
        Despesas.loadData();
        break;
      case 'cartoes':
        Cartoes.loadData();
        break;
      case 'extrato':
        this.carregarExtrato();
        break;
    }
  }

  carregarExtrato() {
    const cartaoId = sessionStorage.getItem('currentCartaoId');
    const cartaoNome = sessionStorage.getItem('currentCartaoNome');

    console.log('🔄 Carregando extrato - Cartão ID:', cartaoId, 'Nome:', cartaoNome);

    if (cartaoId && cartaoNome) {
      // Atualizar título da página
      const titulo = document.querySelector('#extrato-page h2');
      if (titulo) {
        titulo.innerHTML = `<i class="bi bi-receipt"></i> Extrato - ${cartaoNome}`;
      }

      // Carregar extrato
      console.log('📋 Iniciando carregamento do extrato...');
      Extrato.carregarExtrato(cartaoId);
    } else {
      // Se não há cartão selecionado, voltar para cartões
      console.log('❌ Nenhum cartão selecionado para extrato');
      Utils.showToast('❌ Nenhum cartão selecionado', 'warning');
      this.navigateTo('cartoes');
    }
  }

  async checkAuth() {
    const token = getAuthToken();
    if (token) {
      try {
        console.log('🔐 Verificando autenticação...');

        // Pré-carregar dados do dashboard para evitar tela vazia
        if (this.currentPage === 'dashboard') {
          console.log('⏳ Pré-carregando dados do dashboard...');
          // Tenta carregar. Se der erro 401, o Utils.apiCall vai chamar logout.
          // Se der outro erro, apenas segue.
          await Dashboard.loadData();
        }

        // Se chegou aqui, o token existe (e se fosse inválido, teria feito logout no apiCall)
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('login-page').classList.add('d-none');
        document.getElementById('app-pages').classList.remove('d-none');

        if (this.currentPage === 'dashboard') {
          this.navigateTo('dashboard');
        }
      } catch (error) {
        console.error('❌ Erro na verificação de auth:', error);

        // Se ainda temos o token (não houve logout via 401), mostramos o app
        // Se houve erro de rede, o usuário verá o dashboard vazio ou com erro, mas não volta pro login
        if (getAuthToken()) {
          document.getElementById('login-page').classList.remove('active');
          document.getElementById('login-page').classList.add('d-none');
          document.getElementById('app-pages').classList.remove('d-none');
        } else {
          this.showLogin();
        }
      }
    } else {
      this.showLogin();
    }
  }

  showLogin() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('login-page').classList.remove('d-none'); // Garantir que aparece
    document.getElementById('app-pages').classList.add('d-none');
  }

  setupDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.checked = isDarkMode;
      this.toggleDarkMode(isDarkMode);
    }
  }

  toggleDarkMode(enabled) {
    if (enabled) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.removeAttribute('data-bs-theme');
      localStorage.setItem('darkMode', 'false');
    }
  }

  logout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('currentCartaoId');
    sessionStorage.removeItem('currentCartaoNome');

    Utils.showToast('Logout realizado com sucesso!', 'info');

    // Recarregar a página para limpar completamente a memória e o DOM por segurança
    setTimeout(() => {
      location.reload();
    }, 500);
  }
}

// Utilitários
class Utils {
  static formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  }

  static formatDate(dateString) {
    if (!dateString) return '-';
    try {
      // CORREÇÃO: Adiciona o timezone para evitar problema de um dia a menos
      const date = new Date(dateString + 'T00:00:00-03:00');
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return dateString;
    }
  }

  static async apiCall(endpoint, options = {}) {
    const token = getAuthToken();
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      mode: 'cors'
    };

    try {
      console.log('Fazendo requisição para:', `${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...defaultOptions,
        ...options
      });

      if (response.status === 401) {
        // Token expirado, fazer logout
        app.logout();
        throw new Error('Sessão expirada');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resposta recebida:', data);
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      Utils.showToast('Erro ao carregar dados: ' + error.message, 'danger');
      throw error;
    }
  }

  static showToast(message, type = 'info') {
    // Remover toasts antigos
    document.querySelectorAll('.toast-notification').forEach(toast => {
      toast.remove();
    });

    // Ícones por tipo
    const icons = {
      success: 'bi-check-circle-fill',
      danger: 'bi-exclamation-octagon-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };
    const iconClass = icons[type] || icons.info;
    const titles = {
      success: 'Sucesso!',
      danger: 'Erro!',
      warning: 'Atenção!',
      info: 'Informação'
    };
    const title = titles[type] || 'Informação';

    // Criar novo toast usando classe customizada
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    // Usar estilo inline para garantir remoção de qualquer margem do bootstrap caso vaze
    toast.style.margin = '0';

    toast.innerHTML = `
      <div class="toast-icon">
        <i class="bi ${iconClass}"></i>
      </div>
      <div class="toast-content">
        <div class="fw-bold mb-1">${title}</div>
        <div class="small opacity-75">${message}</div>
      </div>
      <button type="button" class="btn-close" aria-label="Close"></button>
    `;

    // Adicionar evento de fechar manual
    toast.querySelector('.btn-close').addEventListener('click', () => {
      toast.remove();
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
}

// Inicializar aplicação
let app;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado, inicializando app...');
  app = new App();
});
