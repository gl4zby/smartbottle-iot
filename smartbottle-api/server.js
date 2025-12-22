// 1. IMPORTAÇÕES
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Garante que as variáveis do ficheiro .env são carregadas ANTES de qualquer outra coisa.
require('dotenv').config();

// (Opcional) Linhas de diagnóstico para verificar se o .env está a ser lido
// console.log('Valor lido para DB_SERVER:', process.env.DB_SERVER);
// console.log('Valor lido para DB_DATABASE:', process.env.DB_DATABASE);

const dbConfig = require('./dbConfig');
const app = express();


// 2. MIDDLEWARE
app.use(cors());
app.use(express.json());
const PORT = 5000;

// 2.1 JWT AUTHENTICATION MIDDLEWARE
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido. Faça login novamente.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado. Faça login novamente.' });
        }
        // Adiciona os dados do utilizador ao request para uso nas rotas
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    });
}

// 2.2 API KEY AUTHENTICATION MIDDLEWARE
function verifyApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            message: 'API Key não fornecida. Inclua o header X-API-Key.'
        });
    }

    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({
            message: 'API Key inválida. Acesso negado.'
        });
    }

    // API Key válida, continuar
    next();
}


// 3. ROTA DE TESTE
app.get('/', (req, res) => {
    res.send('A API da Smart Bottle está a funcionar!');
});

// 3.1 ROTA DE HEALTH CHECK (PING)
app.get('/api/ping', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'SmartBottle API is running'
    });
});


// 4. ROTA DE REGISTO
app.post('/api/registo', async (req, res) => {
    console.log("Recebido um pedido POST para /api/registo!");
    const { nome, email, password } = req.body;

    // Validação dos campos de entrada
    if (!nome || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    try {
        // Encripta a password
        const passwordHash = await bcrypt.hash(password, 10);

        // Conecta à base de dados
        let pool = await sql.connect(dbConfig);
        
        // Insere o novo utilizador na tabela
        await pool.request()
            .input('nome', sql.NVarChar, nome)
            .input('email', sql.NVarChar, email)
            .input('password_hash', sql.NVarChar, passwordHash)
            .query('INSERT INTO utilizadores (nome, email, password_hash) VALUES (@nome, @email, @password_hash)');

        // Envia resposta de sucesso
        res.status(201).json({ message: 'Utilizador registado com sucesso!' });

    } catch (error) {
        console.error(error);
        // Verifica se o erro é de email duplicado
        if (error.number === 2627) {
            return res.status(409).json({ message: 'Este email já está a ser utilizado.' });
        }
        // Envia erro genérico
        res.status(500).json({ message: 'Erro no servidor ao registar o utilizador.' });
    }
});


// 5. ROTA DE LOGIN
app.post('/api/login', async (req, res) => {
    console.log("Recebido um pedido POST para /api/login!");
    const { email, password } = req.body;

    // Validação dos campos de entrada
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e password são obrigatórios.' });
    }

    try {
        // Conecta à base de dados
        let pool = await sql.connect(dbConfig);
        
        // Procura o utilizador pelo email
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM utilizadores WHERE email = @email');

        const user = result.recordset[0];

        // Se o utilizador não for encontrado, envia erro
        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // Compara a password enviada com a hash guardada na BD
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        // Se as passwords não corresponderem, envia erro
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // Se tudo estiver correto, envia resposta de sucesso
        res.status(200).json({ 
            message: 'Login bem-sucedido!',
            userId: user.id,
            nome: user.nome
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao tentar fazer login.' });
    }
});

// 6. ROTA PARA REGISTAR UM NOVO CONSUMO
app.post('/api/consumo', verifyApiKey, async (req, res) => {
    console.log("Recebido um pedido POST para /api/consumo!");
    const { userId, quantidadeMl, tipoBebida } = req.body;

    // Validação dos dados recebidos
    if (!userId || !quantidadeMl || !tipoBebida) {
        return res.status(400).json({ message: 'userId, quantidadeMl e tipoBebida são obrigatórios.' });
    }

    try {
        // Conecta à base de dados
        let pool = await sql.connect(dbConfig);
        
        // Insere o novo registo de consumo na tabela
        await pool.request()
            .input('id_utilizador', sql.Int, userId)
            .input('quantidade_ml', sql.Int, quantidadeMl)
            .input('tipo_bebida', sql.NVarChar, tipoBebida)
            .query('INSERT INTO registos_consumo (id_utilizador, quantidade_ml, tipo_bebida) VALUES (@id_utilizador, @quantidade_ml, @tipo_bebida)');

        // Envia resposta de sucesso
        res.status(201).json({ message: 'Consumo registado com sucesso!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao registar o consumo.' });
    }
});


// 7. ROTA PARA OBTER O HISTÓRICO DE CONSUMO DE UM UTILIZADOR
app.get('/api/consumo/:userId', verifyApiKey, async (req, res) => {
    const { userId } = req.params; // O userId vem do URL
    console.log(`Recebido um pedido GET para o consumo do utilizador ${userId}!`);

    try {
        // Conecta à base de dados
        let pool = await sql.connect(dbConfig);
        
        // Procura todos os registos de consumo para o userId especificado
        const result = await pool.request()
            .input('id_utilizador', sql.Int, userId)
            .query('SELECT * FROM registos_consumo WHERE id_utilizador = @id_utilizador ORDER BY data_registo DESC'); // Ordenar pelos mais recentes

        // Envia os resultados de volta como um array JSON
        res.status(200).json(result.recordset);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao obter o histórico de consumo.' });
    }
});

// 7.1 ROTA PARA ELIMINAR UM REGISTO DE CONSUMO
app.delete('/api/consumo/:consumoId', verifyApiKey, async (req, res) => {
    const { consumoId } = req.params;
    console.log(`Recebido um pedido DELETE para o consumo ${consumoId}!`);

    try {
        let pool = await sql.connect(dbConfig);

        // Verificar se o registo existe
        const checkResult = await pool.request()
            .input('id', sql.Int, consumoId)
            .query('SELECT id FROM registos_consumo WHERE id = @id');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Registo de consumo nao encontrado.' });
        }

        // Eliminar o registo
        await pool.request()
            .input('id', sql.Int, consumoId)
            .query('DELETE FROM registos_consumo WHERE id = @id');

        res.status(200).json({ message: 'Registo de consumo eliminado com sucesso!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao eliminar o consumo.' });
    }
});

// 7.2 ROTA PARA ATUALIZAR UM REGISTO DE CONSUMO
app.put('/api/consumo/:consumoId', verifyApiKey, async (req, res) => {
    const { consumoId } = req.params;
    const { quantidadeMl, tipoBebida } = req.body;
    console.log(`Recebido um pedido PUT para atualizar o consumo ${consumoId}!`);

    // Validacao
    if (!quantidadeMl) {
        return res.status(400).json({ message: 'quantidadeMl e obrigatorio.' });
    }

    try {
        let pool = await sql.connect(dbConfig);

        // Verificar se o registo existe
        const checkResult = await pool.request()
            .input('id', sql.Int, consumoId)
            .query('SELECT id FROM registos_consumo WHERE id = @id');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Registo de consumo nao encontrado.' });
        }

        // Atualizar o registo
        await pool.request()
            .input('id', sql.Int, consumoId)
            .input('quantidade_ml', sql.Int, quantidadeMl)
            .input('tipo_bebida', sql.NVarChar, tipoBebida || 'agua')
            .query('UPDATE registos_consumo SET quantidade_ml = @quantidade_ml, tipo_bebida = @tipo_bebida WHERE id = @id');

        res.status(200).json({ message: 'Registo de consumo atualizado com sucesso!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar o consumo.' });
    }
});

// 8. ROTA PARA OBTER O PERFIL DE UM UTILIZADOR
app.get('/api/perfil/:userId', verifyApiKey, async (req, res) => {
    const { userId } = req.params;
    console.log(`Recebido um pedido GET para o perfil do utilizador ${userId}!`);

    try {
        let pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT id, nome, email, idade, peso, meta_diaria FROM utilizadores WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Utilizador nao encontrado.' });
        }

        res.status(200).json(result.recordset[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao obter o perfil.' });
    }
});

// 9. ROTA PARA ATUALIZAR O PERFIL DE UM UTILIZADOR
app.put('/api/perfil/:userId', verifyApiKey, async (req, res) => {
    const { userId } = req.params;
    const { nome, idade, peso, meta_diaria } = req.body;
    console.log(`Recebido um pedido PUT para atualizar o perfil do utilizador ${userId}!`);

    try {
        let pool = await sql.connect(dbConfig);

        await pool.request()
            .input('id', sql.Int, userId)
            .input('nome', sql.NVarChar, nome)
            .input('idade', sql.Int, idade || null)
            .input('peso', sql.Decimal(5, 1), peso || null)
            .input('meta_diaria', sql.Decimal(3, 1), meta_diaria || 2.0)
            .query('UPDATE utilizadores SET nome = @nome, idade = @idade, peso = @peso, meta_diaria = @meta_diaria WHERE id = @id');

        res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar o perfil.' });
    }
});

// 10. INICIAR O SERVIDOR
// Bind to 0.0.0.0 to allow external connections (phone on local network)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Servidor a correr em http://${HOST}:${PORT}`);
    console.log(`Acesso local: http://localhost:${PORT}`);
    console.log(`Para acesso de rede, use o IP do computador na porta ${PORT}`);
});