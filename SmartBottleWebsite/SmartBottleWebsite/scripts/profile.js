// Script da página de Perfil
document.addEventListener('DOMContentLoaded', () => {

    // 1. VERIFICAR SE O UTILIZADOR ESTA LOGADO
    const userDataString = localStorage.getItem('userData');

    if (!userDataString) {
        alert('Por favor, faca login para aceder ao Perfil.');
        window.location.href = 'login.html';
        return;
    }

    const userData = JSON.parse(userDataString);
    const userId = userData.userId;

    // 2. ELEMENTOS DO FORMULARIO
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const ageInput = document.getElementById('age');
    const weightInput = document.getElementById('weight');
    const dailyGoalInput = document.getElementById('daily-goal');
    const saveStatus = document.getElementById('save-status');
    const profileForm = document.getElementById('profile-form');

    // 3. CARREGAR DADOS DO PERFIL DA API
    async function loadProfile() {
        try {
            const response = await fetch(`${API_URL}/api/perfil/${userId}`, {
                headers: {
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                }
            });

            if (!response.ok) {
                throw new Error('Nao foi possivel carregar o perfil.');
            }

            const profile = await response.json();

            // Preencher os campos
            if (nameInput) nameInput.value = profile.nome || '';
            if (emailInput) emailInput.value = profile.email || '';
            if (ageInput) ageInput.value = profile.idade || '';
            if (weightInput) weightInput.value = profile.peso || '';
            if (dailyGoalInput) dailyGoalInput.value = profile.meta_diaria || 2.0;

        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            // Usar dados do localStorage como fallback
            if (nameInput) nameInput.value = userData.nome || '';
            if (emailInput) emailInput.value = userData.email || '';
        }
    }

    // 4. GUARDAR PERFIL NA API
    async function saveProfile(e) {
        e.preventDefault();
        saveStatus.textContent = 'A guardar...';
        saveStatus.style.color = 'blue';

        const profileData = {
            nome: nameInput.value,
            idade: ageInput.value ? parseInt(ageInput.value) : null,
            peso: weightInput.value ? parseFloat(weightInput.value) : null,
            meta_diaria: dailyGoalInput.value ? parseFloat(dailyGoalInput.value) : 2.0
        };

        try {
            const response = await fetch(`${API_URL}/api/perfil/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                throw new Error('Erro ao guardar o perfil.');
            }

            // Atualizar localStorage com o novo nome
            userData.nome = profileData.nome;
            localStorage.setItem('userData', JSON.stringify(userData));

            saveStatus.textContent = 'Perfil guardado com sucesso!';
            saveStatus.style.color = 'green';

            // Limpar mensagem apos 3 segundos
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);

        } catch (error) {
            console.error('Erro ao guardar perfil:', error);
            saveStatus.textContent = 'Erro ao guardar. Tente novamente.';
            saveStatus.style.color = 'red';
        }
    }

    // 5. EVENT LISTENERS
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }

    // 6. CARREGAR PERFIL AO INICIAR
    loadProfile();
});
