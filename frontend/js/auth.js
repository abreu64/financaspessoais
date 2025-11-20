// Gerenciamento de autenticação
class Auth {
  static async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      // Salvar token e dados do usuário
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      Utils.showToast('Login realizado com sucesso!', 'success');
      app.checkAuth();
      return true;
    } catch (error) {
      Utils.showToast('Erro ao fazer login: ' + error.message, 'danger');
      return false;
    }
  }

  static async register(email, password, nome) {
    try {
      console.log('Tentando registrar:', email, nome);
      
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, nome })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      Utils.showToast('Conta criada com sucesso! Faça login.', 'success');
      return true;
    } catch (error) {
      Utils.showToast('Erro ao criar conta: ' + error.message, 'danger');
      return false;
    }
  }
}

// Event listeners para formulário de login
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      const loginButton = loginForm.querySelector('button[type="submit"]');
      const originalText = loginButton.innerHTML;
      loginButton.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Entrando...';
      loginButton.disabled = true;

      const success = await Auth.login(email, password);
      
      loginButton.innerHTML = originalText;
      loginButton.disabled = false;

      if (success) {
        loginForm.reset();
      }
    });
  }

  // Link para criar conta - FUNCIONANDO AGORA
  const criarContaLink = document.getElementById('criarContaLink');
  if (criarContaLink) {
    criarContaLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Modal simples para criar conta
      const nome = prompt('Digite seu nome completo:');
      if (!nome) return;
      
      const email = prompt('Digite seu e-mail:');
      if (!email) return;
      
      const password = prompt('Digite sua senha (mínimo 6 caracteres):');
      if (!password || password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres!');
        return;
      }

      // Registrar usuário
      Auth.register(email, password, nome);
    });
  }
});