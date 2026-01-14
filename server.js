const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const ARQUIVO_BANCO = path.join(__dirname, 'banco.json');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// --- FUNÇÕES DE BANCO ---
const iniciarBanco = () => {
    if (!fs.existsSync(ARQUIVO_BANCO)) fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify([])); 
};

const lerPacientes = () => {
    try {
        if (!fs.existsSync(ARQUIVO_BANCO)) iniciarBanco();
        const data = fs.readFileSync(ARQUIVO_BANCO);
        return JSON.parse(data);
    } catch (error) { return []; }
};

const salvarPacientes = (pacientes) => {
    fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify(pacientes, null, 2));
};

// --- ROTAS ---

// 1. Home (Dashboard)
app.get('/', (req, res) => {
    let pacientes = lerPacientes();
    if (req.query.search) {
        const termo = req.query.search.toLowerCase();
        pacientes = pacientes.filter(p => 
            p.nome.toLowerCase().includes(termo) || 
            (p.cpf && p.cpf.includes(termo)) ||
            (p.cns && p.cns.includes(termo))
        );
    }
    // Ordena por Microárea
    pacientes.sort((a, b) => (a.microarea || '').localeCompare(b.microarea || ''));
    res.render('index', { pacientes });
});

// 2. Cadastro
app.get('/cadastro', (req, res) => {
    res.render('cadastro');
});

app.post('/cadastro', (req, res) => {
    const pacientes = lerPacientes();
    const novoPaciente = processarDados(req.body, Date.now().toString());
    novoPaciente.criadoEm = new Date();
    
    pacientes.push(novoPaciente);
    salvarPacientes(pacientes);
    res.redirect('/');
});

// 3. Edição (NOVAS ROTAS)
app.get('/editar/:id', (req, res) => {
    const pacientes = lerPacientes();
    const paciente = pacientes.find(p => p.id === req.params.id);
    if (paciente) {
        res.render('editar', { paciente });
    } else {
        res.redirect('/');
    }
});

app.post('/editar/:id', (req, res) => {
    let pacientes = lerPacientes();
    const index = pacientes.findIndex(p => p.id === req.params.id);
    
    if (index !== -1) {
        // Mantém a data de criação original e o ID
        const criadoEmOriginal = pacientes[index].criadoEm;
        const dadosAtualizados = processarDados(req.body, req.params.id);
        dadosAtualizados.criadoEm = criadoEmOriginal;
        
        pacientes[index] = dadosAtualizados;
        salvarPacientes(pacientes);
        res.redirect('/paciente/' + req.params.id);
    } else {
        res.redirect('/');
    }
});

// 4. Detalhes e Delete
app.get('/paciente/:id', (req, res) => {
    const pacientes = lerPacientes();
    const paciente = pacientes.find(p => p.id === req.params.id);
    if (paciente) res.render('detalhes', { paciente });
    else res.redirect('/');
});

app.post('/delete/:id', (req, res) => {
    let pacientes = lerPacientes();
    pacientes = pacientes.filter(p => p.id !== req.params.id);
    salvarPacientes(pacientes);
    res.redirect('/');
});

// Função Auxiliar para organizar os dados (evita repetir código)
function processarDados(body, id) {
    return {
        id: id,
        cpf: body.cpf, cns: body.cns, nome: body.nome, nomeSocial: body.nomeSocial,
        dataNascimento: body.dataNascimento, sexo: body.sexo, racaCor: body.racaCor,
        nomeMae: body.nomeMae, telefone: body.telefone, nacionalidade: body.nacionalidade,
        microarea: body.microarea, familiaId: body.familiaId, cep: body.cep,
        endereco: body.endereco, numero: body.numero, bairro: body.bairro,
        escolaridade: body.escolaridade, situacaoTrabalho: body.situacaoTrabalho,
        ocupacao: body.ocupacao, peso: body.peso, observacoes: body.observacoes,
        
        // Checkboxes
        temPlanoSaude: body.temPlanoSaude === 'on',
        beneficiarioBolsaFamilia: body.beneficiarioBolsaFamilia === 'on',
        hipertenso: body.hipertenso === 'on',
        diabetico: body.diabetico === 'on',
        fumante: body.fumante === 'on',
        alcool: body.alcool === 'on',
        drogas: body.drogas === 'on',
        gestante: body.gestante === 'on',
        acamado: body.acamado === 'on',
        domiciliado: body.domiciliado === 'on',
        avc: body.avc === 'on',
        infarto: body.infarto === 'on',
        cardiaco: body.cardiaco === 'on',
        rim: body.rim === 'on',
        respiratoria: body.respiratoria === 'on',
        hanseniase: body.hanseniase === 'on',
        tuberculose: body.tuberculose === 'on',
        cancer: body.cancer === 'on',
        internacaoRecente: body.internacaoRecente === 'on',
        saudeMental: body.saudeMental === 'on'
    };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    iniciarBanco();
    console.log(`Servidor rodando na porta ${PORT}`);
});
