// Gerenciamento de autenticação - CORRIGIDO
class Auth {
  static async login(email, password) {
    try {
      console.log('🔐 Tentando login para:', email);
      
      // CORREÇÃO: Adicionar /api na URL
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      console.log('📡 Status do login:', response.status);

      // CORREÇÃO: Verificar se a resposta é JSON válido
      const responseText = await response.text();
      console.log('📄 Resposta bruta:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Resposta não é JSON válido:', responseText);
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      // CORREÇÃO: Verificar se o token existe
      if (!data.session || !data.session.access_token) {
        console.error('❌ Token não encontrado:', data);
        throw new Error('Token de acesso não recebido');
      }

      // Salvar token e dados do usuário
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      console.log('✅ Login realizado, token salvo');
      Utils.showToast('Login realizado com sucesso!', 'success');
      
      // CORREÇÃO: Recarregar a página para atualizar o app
      setTimeout(() => {
        location.reload();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      Utils.showToast('Erro ao fazer login: ' + error.message, 'danger');
      return false;
    }
  }

  static async register(email, password, nome) {
    try {
      console.log('📝 Tentando registrar:', email, nome);
      
      // CORREÇÃO: Adicionar /api na URL
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, nome })
      });

      console.log('📡 Status do registro:', response.status);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      Utils.showToast('Conta criada com sucesso! Faça login.', 'success');
      return true;
    } catch (error) {
      console.error('❌ Erro no registro:', error);
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

  // Link para criar conta
  const criarContaLink = document.getElementById('criarContaLink');
  if (criarContaLink) {
    criarContaLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      const nome = prompt('Digite seu nome completo:');
      if (!nome) return;
      
      const email = prompt('Digite seu e-mail:');
      if (!email) return;
      
      const password = prompt('Digite sua senha (mínimo 6 caracteres):');
      if (!password || password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres!');
        return;
      }

      Auth.register(email, password, nome);
    });
  }
});