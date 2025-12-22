// Espera que todo o conteudo da pagina (HTML) seja carregado
document.addEventListener('DOMContentLoaded', () => {

    // 1. VERIFICAR SE O UTILIZADOR ESTA "LOGADO"
    const userDataString = localStorage.getItem('userData');

    if (!userDataString) {
        alert('Por favor, faca login para aceder ao Dashboard.');
        window.location.href = 'login.html';
        return;
    }

    const userData = JSON.parse(userDataString);
    const userId = userData.userId;

    // 2. SELECIONAR OS ELEMENTOS DO DASHBOARD
    const dailyConsumptionElement = document.getElementById('daily-consumption');
    const cafesHojeElement = document.getElementById('cafes-hoje');
    const streakElement = document.getElementById('streak');
    const weeklyAverageElement = document.getElementById('weekly-average');
    const historyBody = document.getElementById('history-body');
    const welcomeMessageElement = document.querySelector('.dashboard-section h2');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const goalText = document.getElementById('goal-text');
    const chartCanvas = document.getElementById('consumption-chart');

    // 3. ATUALIZAR A MENSAGEM DE BOAS-VINDAS
    if (userData.nome) {
        welcomeMessageElement.textContent = `Bem-vindo, ${userData.nome}!`;
    }

    // 3.1 VARIAVEL PARA GUARDAR O OBJETIVO DIARIO (default 2L)
    let userDailyGoalMl = 2000;

    // 3.2 FUNCAO PARA BUSCAR O PERFIL DO UTILIZADOR
    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_URL}/api/perfil/${userId}`, {
                headers: {
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                }
            });

            if (response.ok) {
                const profile = await response.json();
                // meta_diaria vem em litros, converter para ml
                if (profile.meta_diaria) {
                    userDailyGoalMl = profile.meta_diaria * 1000;
                }
                console.log('Objetivo diario do utilizador:', userDailyGoalMl, 'ml');
            }
        } catch (error) {
            console.error('Erro ao obter perfil:', error);
        }
    }

    // 4. FUNCAO PARA IR BUSCAR OS DADOS DE CONSUMO
    async function fetchConsumptionData() {
        try {
            const response = await fetch(`${API_URL}/api/consumo/${userId}`, {
                headers: {
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                }
            });

            if (!response.ok) {
                throw new Error('Nao foi possivel obter os dados de consumo.');
            }

            const consumptionHistory = await response.json();
            updateDashboardStats(consumptionHistory);

        } catch (error) {
            console.error('Erro ao obter dados de consumo:', error);
            historyBody.innerHTML = '<tr><td colspan="3">Erro ao carregar dados</td></tr>';
        }
    }

    // 5. FUNCAO PARA CALCULAR E ATUALIZAR O DASHBOARD
    function updateDashboardStats(history) {
        const today = new Date().toISOString().split('T')[0];

        let totalTodayMl = 0;
        let cafesHoje = 0;
        const todayRecords = [];

        // Processar registos
        if (history && history.length > 0) {
            history.forEach(record => {
                if (record.data_registo && record.data_registo.startsWith(today)) {
                    const tipoBebida = (record.tipo_bebida || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const isCoffee = tipoBebida === 'cafe';

                    // NAO contar cafe no consumo de agua (igual a app)
                    if (!isCoffee) {
                        totalTodayMl += record.quantidade_ml || 0;
                    }

                    // Contar cafes separadamente
                    if (isCoffee) {
                        cafesHoje++;
                    }

                    todayRecords.push(record);
                }
            });
        }

        // Atualizar consumo total (sem cafe)
        const totalTodayLiters = (totalTodayMl / 1000).toFixed(1);
        dailyConsumptionElement.textContent = `${totalTodayLiters} L`;

        // Atualizar cafes
        cafesHojeElement.textContent = cafesHoje === 1 ? '1 cafe' : `${cafesHoje} cafes`;

        // Calcular dias consecutivos (simplificado)
        const daysWithData = calculateStreak(history);
        streakElement.textContent = daysWithData === 1 ? '1 dia' : `${daysWithData} dias`;

        // Calcular e atualizar media semanal
        const weeklyAvg = calculateWeeklyAverage(history);
        if (weeklyAverageElement) {
            weeklyAverageElement.textContent = `${weeklyAvg.toFixed(1)} L`;
        }

        // Atualizar barra de progresso
        updateProgressBar(totalTodayMl);

        // Atualizar grafico
        updateChart(history);

        // Preencher tabela de historico
        updateHistoryTable(todayRecords);
    }

    // 6. FUNCAO PARA CALCULAR DIAS CONSECUTIVOS
    function calculateStreak(history) {
        if (!history || history.length === 0) return 0;

        const dates = new Set();
        history.forEach(record => {
            if (record.data_registo) {
                dates.add(record.data_registo.split('T')[0]);
            }
        });

        let streak = 0;
        let currentDate = new Date();

        while (true) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (dates.has(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    // 6.1 FUNCAO PARA CALCULAR MEDIA SEMANAL (exclui cafe)
    function calculateWeeklyAverage(history) {
        if (!history || history.length === 0) return 0;

        const dailyData = {};
        history.forEach(record => {
            const tipoBebida = (record.tipo_bebida || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (tipoBebida === 'cafe') return; // Excluir cafe

            const dateStr = (record.data_registo || '').split('T')[0];
            if (dateStr) {
                if (!dailyData[dateStr]) dailyData[dateStr] = 0;
                dailyData[dateStr] += record.quantidade_ml || 0;
            }
        });

        // Ultimos 7 dias
        const today = new Date();
        let totalMl = 0;
        let daysWithData = 0;

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            if (dailyData[dateStr]) {
                totalMl += dailyData[dateStr];
                daysWithData++;
            }
        }

        if (daysWithData === 0) return 0;
        return (totalMl / daysWithData) / 1000; // Converter para litros
    }

    // 6.2 FUNCAO PARA ATUALIZAR BARRA DE PROGRESSO
    function updateProgressBar(totalTodayMl) {
        const percent = Math.min((totalTodayMl / userDailyGoalMl) * 100, 100);

        if (progressBar) {
            progressBar.style.width = `${percent}%`;

            // Mudar cor baseado no progresso
            if (percent < 33) {
                progressBar.style.backgroundColor = '#f44336'; // Vermelho
            } else if (percent < 67) {
                progressBar.style.backgroundColor = '#ff9800'; // Laranja
            } else if (percent < 100) {
                progressBar.style.backgroundColor = '#ffeb3b'; // Amarelo
            } else {
                progressBar.style.backgroundColor = '#4caf50'; // Verde
            }
        }

        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }

        if (goalText) {
            goalText.textContent = `Objetivo: ${(userDailyGoalMl / 1000).toFixed(1)} L`;
        }
    }

    // 6.3 FUNCAO PARA ATUALIZAR GRAFICO SEMANAL
    function updateChart(history) {
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        const width = chartCanvas.width;
        const height = chartCanvas.height;

        // Limpar canvas
        ctx.clearRect(0, 0, width, height);

        // Calcular dados dos ultimos 7 dias (exclui cafe)
        const dailyData = {};
        history.forEach(record => {
            const tipoBebida = (record.tipo_bebida || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (tipoBebida === 'cafe') return;

            const dateStr = (record.data_registo || '').split('T')[0];
            if (dateStr) {
                if (!dailyData[dateStr]) dailyData[dateStr] = 0;
                dailyData[dateStr] += record.quantidade_ml || 0;
            }
        });

        // Preparar dados para 7 dias
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const chartData = [];
        const labels = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const liters = (dailyData[dateStr] || 0) / 1000;
            chartData.push(liters);
            labels.push(days[date.getDay()]);
        }

        // Usar escala fixa baseada no objetivo diario (com margem de 20%)
        // Assim as barras crescem em vez da escala mudar
        const goalLiters = userDailyGoalMl / 1000;
        const maxDataValue = Math.max(...chartData);
        // Escala fixa: objetivo * 1.2, ou se algum valor ultrapassar, usar esse + 20%
        const maxValue = Math.max(goalLiters * 1.2, maxDataValue * 1.2);

        // Configuracoes do grafico
        const padding = 40;
        const barWidth = (width - padding * 2) / 7 - 10;
        const chartHeight = height - padding * 2;

        // Desenhar linhas de grade
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();

            // Labels do eixo Y
            ctx.fillStyle = '#757575';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            const value = (maxValue - (maxValue / 4) * i).toFixed(1);
            ctx.fillText(`${value}L`, padding - 5, y + 4);
        }

        // Desenhar barras
        chartData.forEach((value, index) => {
            const x = padding + index * ((width - padding * 2) / 7) + 5;
            const barHeight = (value / maxValue) * chartHeight;
            const y = height - padding - barHeight;

            // Cor da barra (hoje em destaque)
            ctx.fillStyle = index === 6 ? '#4caf50' : '#2196f3';
            ctx.fillRect(x, y, barWidth, barHeight);

            // Label do dia
            ctx.fillStyle = index === 6 ? '#4caf50' : '#757575';
            ctx.font = index === 6 ? 'bold 11px Arial' : '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(labels[index], x + barWidth / 2, height - padding + 15);

            // Valor em cima da barra
            if (value > 0) {
                ctx.fillStyle = '#333';
                ctx.font = '10px Arial';
                ctx.fillText(`${value.toFixed(1)}`, x + barWidth / 2, y - 5);
            }
        });
    }

    // 7. FUNCAO PARA ATUALIZAR A TABELA DE HISTORICO
    function updateHistoryTable(records) {
        if (!records || records.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4">Sem registos para hoje</td></tr>';
            return;
        }

        // Ordenar por hora (mais recente primeiro)
        records.sort((a, b) => new Date(b.data_registo) - new Date(a.data_registo));

        let html = '';
        records.forEach(record => {
            const date = new Date(record.data_registo);
            const hora = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            const tipo = record.tipo_bebida || 'Agua';
            const tipoClass = tipo.toLowerCase() === 'cafe' ? 'tipo-cafe' : 'tipo-agua';
            const quantidade = record.quantidade_ml >= 1000
                ? `${(record.quantidade_ml / 1000).toFixed(1)} L`
                : `${record.quantidade_ml} ml`;

            html += `<tr>
                <td>${hora}</td>
                <td class="${tipoClass}">${tipo}</td>
                <td>${quantidade}</td>
                <td class="action-buttons">
                    <button class="btn-edit" data-id="${record.id}" data-quantidade="${record.quantidade_ml}" data-tipo="${tipo}" title="Editar">&#9998;</button>
                    <button class="btn-delete" data-id="${record.id}" title="Eliminar">&#10006;</button>
                </td>
            </tr>`;
        });

        historyBody.innerHTML = html;

        // Adicionar event listeners para os botoes
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', openEditModal);
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', deleteConsumo);
        });
    }

    // 7.1 FUNCAO PARA ABRIR MODAL DE EDICAO
    function openEditModal(e) {
        const btn = e.target;
        const id = btn.dataset.id;
        const quantidade = btn.dataset.quantidade;
        const tipo = btn.dataset.tipo;

        document.getElementById('edit-consumo-id').value = id;
        document.getElementById('edit-quantidade').value = quantidade;
        document.getElementById('edit-tipo').value = tipo;
        document.getElementById('edit-modal').style.display = 'flex';
    }

    // 7.2 FUNCAO PARA FECHAR MODAL
    function closeEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }

    // 7.3 FUNCAO PARA GUARDAR EDICAO
    async function saveEdit() {
        const id = document.getElementById('edit-consumo-id').value;
        const quantidade = document.getElementById('edit-quantidade').value;
        const tipo = document.getElementById('edit-tipo').value;

        if (!quantidade || quantidade <= 0) {
            alert('Quantidade deve ser maior que 0');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/consumo/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                },
                body: JSON.stringify({
                    quantidadeMl: parseInt(quantidade),
                    tipoBebida: tipo
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar registo');
            }

            closeEditModal();
            fetchConsumptionData(); // Recarregar dados
        } catch (error) {
            console.error('Erro ao editar consumo:', error);
            alert('Erro ao atualizar registo. Tente novamente.');
        }
    }

    // 7.4 FUNCAO PARA ELIMINAR CONSUMO
    async function deleteConsumo(e) {
        const id = e.target.dataset.id;

        if (!confirm('Tem a certeza que deseja eliminar este registo?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/consumo/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-API-Key': 'SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3'
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao eliminar registo');
            }

            fetchConsumptionData(); // Recarregar dados
        } catch (error) {
            console.error('Erro ao eliminar consumo:', error);
            alert('Erro ao eliminar registo. Tente novamente.');
        }
    }

    // 7.5 EVENT LISTENERS PARA O MODAL
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-save-edit').addEventListener('click', saveEdit);
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') closeEditModal();
    });

    // 8. CHAMAR AS FUNCOES PRINCIPAIS (perfil primeiro, depois consumo)
    async function initDashboard() {
        await fetchUserProfile();
        await fetchConsumptionData();
    }
    initDashboard();

    // 9. EVENT HANDLER PARA O BOTAO ATUALIZAR
    const btnAtualizar = document.getElementById('btn-atualizar');
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', () => {
            historyBody.innerHTML = '<tr><td colspan="3">A carregar...</td></tr>';
            fetchConsumptionData();
        });
    }
});
