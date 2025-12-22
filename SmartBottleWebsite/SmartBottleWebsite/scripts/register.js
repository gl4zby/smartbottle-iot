// Espera que todo o conteúdo da página (HTML) seja carregado antes de executar o código
document.addEventListener('DOMContentLoaded', () => {

    // 1. SELECIONAR OS ELEMENTOS DO HTML
    // Seleciona o formulário de registo pelo seu ID
    const registerForm = document.getElementById('register-form');
    // Seleciona os campos de input pelos seus IDs
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // (Opcional) Elemento para mostrar mensagens de erro ou sucesso
    // Para isto funcionar, adicione <p id="message"></p> logo abaixo do botão no seu HTML
    // const messageElement = document.getElementById('message');


    // 2. ADICIONAR UM "OUVINTE" PARA O EVENTO DE SUBMISSÃO DO FORMULÁRIO
    registerForm.addEventListener('submit', async (event) => {
        // Previne o comportamento padrão do formulário (que é recarregar a página)
        event.preventDefault();

        // 3. RECOLHER OS VALORES DOS INPUTS
        const name = nameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // 4. VALIDAÇÃO SIMPLES NO FRONTEND
        if (password !== confirmPassword) {
            alert('As passwords não coincidem!');
            // messageElement.textContent = 'As passwords não coincidem!';
            return; // Para a execução da função
        }

        // 5. ENVIAR OS DADOS PARA A API
        try {
            // Usa a função fetch() para fazer um pedido POST para a nossa API
            const response = await fetch(`${API_URL}/api/registo`, {
                method: 'POST', // Define o método do pedido
                headers: {
                    'Content-Type': 'application/json' // Diz à API que estamos a enviar dados em formato JSON
                },
                body: JSON.stringify({ // Converte o nosso objeto JavaScript para uma string JSON
                    nome: name,
                    email: email,
                    password: password
                })
            });
            
            // Converte a resposta da API de JSON para um objeto JavaScript
            const data = await response.json();

            // 6. PROCESSAR A RESPOSTA DA API
            if (response.ok) { // response.ok é true se o status for 2xx (ex: 201 Created)
                alert('Registo efetuado com sucesso! Agora pode fazer login.');
                // messageElement.textContent = 'Registo efetuado com sucesso!';
                
                // Redireciona o utilizador para a página de login após o sucesso
                window.location.href = 'login.html';
                
            } else {
                // Se a API devolver um erro (ex: email já existe), mostra a mensagem de erro
                alert(`Erro no registo: ${data.message}`);
                // messageElement.textContent = `Erro no registo: ${data.message}`;
            }

        } catch (error) {
            // Apanha erros de rede (ex: a API não está a correr)
            console.error('Erro de rede:', error);
            alert('Não foi possível ligar ao servidor. Tente novamente mais tarde.');
            // messageElement.textContent = 'Não foi possível ligar ao servidor.';
        }
    });
});