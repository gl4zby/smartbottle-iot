// Espera que todo o conteúdo da página (HTML) seja carregado
document.addEventListener('DOMContentLoaded', () => {

    // 1. SELECIONAR OS ELEMENTOS DO HTML
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // 2. ADICIONAR UM "OUVINTE" PARA O EVENTO DE SUBMISSÃO DO FORMULÁRIO
    loginForm.addEventListener('submit', async (event) => {
        // Previne o recarregamento da página
        event.preventDefault();

        // 3. RECOLHER OS VALORES DOS INPUTS
        const email = emailInput.value;
        const password = passwordInput.value;

        // 4. ENVIAR OS DADOS PARA A API DE LOGIN
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            // 5. PROCESSAR A RESPOSTA DA API
            if (response.ok) {
                // SUCESSO! O utilizador está autenticado.
                
                // 5.1 Guardar os dados do utilizador no localStorage do browser
                // O localStorage é uma forma de guardar dados que persistem mesmo depois de fechar o browser.
                localStorage.setItem('userData', JSON.stringify({
                    userId: data.userId,
                    nome: data.nome
                }));

                // 5.2 Redireciona o utilizador para o Dashboard
                window.location.href = 'dashboard.html';

            } else {
                // Se a API devolver um erro (ex: credenciais inválidas)
                alert(`Erro no login: ${data.message}`);
            }

        } catch (error) {
            // Apanha erros de rede
            console.error('Erro de rede:', error);
            alert('Não foi possível ligar ao servidor. Tente novamente mais tarde.');
        }
    });
});