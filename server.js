const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const ARQUIVO_BANCO = path.join(__dirname, 'banco.json');

// Configuração
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// --- FUNÇÕES AUXILIARES PARA LER/SALVAR NO ARQUIVO ---

// Função para garantir que o arquivo existe
const iniciarBanco = () => {
    if (!fs.existsSync(ARQUIVO_BANCO)) {
        fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify([])); // Cria lista vazia
    }
};

// Ler dados do arquivo
const lerPacientes = () => {
    try {
        if (!fs.existsSync(ARQUIVO_BANCO)) {
            iniciarBanco();
        }
        const data = fs.readFileSync(ARQUIVO_BANCO);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Salvar dados no arquivo
const salvarPacientes = (pacientes) => {
    fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify(pacientes, null, 2));
};

// --- ROTAS ---

// 1. Tela Inicial
app.get('/', (req, res) => {
    let pacientes = lerPacientes();
    
    // Filtro de busca
    if (req.query.search) {
        const termo = req.query.search.toLowerCase();
        pacientes = pacientes.filter(p => 
            p.nome.toLowerCase().includes(termo) || 
            p.cns.includes(termo)
        );
    }
    
    // Ordenar por nome
    pacientes.sort((a, b) => a.nome.localeCompare(b.nome));
    
    res.render('index', { pacientes });
});

// 2. Tela de Cadastro
app.get('/cadastro', (req, res) => {
    res.render('cadastro');
});

// 3. Salvar (POST)
app.post('/cadastro', (req, res) => {
    const pacientes = lerPacientes();
    
    const novoPaciente = {
        id: Date.now().toString(), // Gera um ID único baseado na hora
        nome: req.body.nome,
        cns: req.body.cns,
        dataNascimento: req.body.dataNascimento,
        nomeMae: req.body.nomeMae,
        telefone: req.body.telefone,
        endereco: req.body.endereco,
        numero: req.body.numero,
        bairro: req.body.bairro,
        microarea: req.body.microarea,
        familiaId: req.body.familiaId,
        observacoes: req.body.observacoes,
        // Checkboxes retornam 'on' se marcados, senão undefined
        hipertenso: req.body.hipertenso === 'on',
        diabetico: req.body.diabetico === 'on',
        gestante: req.body.gestante === 'on',
        acamado: req.body.acamado === 'on',
        criadoEm: new Date()
    };

    pacientes.push(novoPaciente);
    salvarPacientes(pacientes);
    
    res.redirect('/');
});

// 4. Ver Detalhes
app.get('/paciente/:id', (req, res) => {
    const pacientes = lerPacientes();
    const paciente = pacientes.find(p => p.id === req.params.id);
    
    if (paciente) {
        res.render('detalhes', { paciente });
    } else {
        res.redirect('/');
    }
});

// 5. Deletar
app.post('/delete/:id', (req, res) => {
    let pacientes = lerPacientes();
    // Filtra todos MENOS o que tem o ID que queremos deletar
    pacientes = pacientes.filter(p => p.id !== req.params.id);
    salvarPacientes(pacientes);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    iniciarBanco(); // Garante que o arquivo existe ao ligar
    console.log(`Servidor rodando na porta ${PORT}`);
});
