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

// --- FUNÇÕES DE BANCO DE DADOS (ARQUIVO LOCAL) ---

const iniciarBanco = () => {
    if (!fs.existsSync(ARQUIVO_BANCO)) {
        fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify([])); 
    }
};

const lerPacientes = () => {
    try {
        if (!fs.existsSync(ARQUIVO_BANCO)) iniciarBanco();
        const data = fs.readFileSync(ARQUIVO_BANCO);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const salvarPacientes = (pacientes) => {
    fs.writeFileSync(ARQUIVO_BANCO, JSON.stringify(pacientes, null, 2));
};

// --- ROTAS ---

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
    // Ordenar por Microárea e depois Nome
    pacientes.sort((a, b) => {
        if (a.microarea === b.microarea) {
            return a.nome.localeCompare(b.nome);
        }
        return a.microarea.localeCompare(b.microarea);
    });
    res.render('index', { pacientes });
});

app.get('/cadastro', (req, res) => {
    res.render('cadastro');
});

app.post('/cadastro', (req, res) => {
    const pacientes = lerPacientes();
    
    const novoPaciente = {
        id: Date.now().toString(),
        
        // 1. Identificação
        cpf: req.body.cpf,
        cns: req.body.cns,
        nome: req.body.nome,
        nomeSocial: req.body.nomeSocial,
        dataNascimento: req.body.dataNascimento,
        sexo: req.body.sexo,
        racaCor: req.body.racaCor,
        nomeMae: req.body.nomeMae,
        telefone: req.body.telefone,
        nacionalidade: req.body.nacionalidade,
        
        // Endereço e Equipe
        microarea: req.body.microarea,
        familiaId: req.body.familiaId, // Nº Prontuário Familiar
        endereco: req.body.endereco,
        numero: req.body.numero,
        bairro: req.body.bairro,
        cep: req.body.cep,

        // 2. Sociodemográfico
        escolaridade: req.body.escolaridade,
        situacaoTrabalho: req.body.situacaoTrabalho,
        ocupacao: req.body.ocupacao,
        temPlanoSaude: req.body.temPlanoSaude === 'on',
        beneficiarioBolsaFamilia: req.body.beneficiarioBolsaFamilia === 'on',

        // 3. Condições de Saúde (Multipla Escolha e Booleanos)
        peso: req.body.peso, // Peso aproximado ou IMC subjetivo
        
        // Doenças / Condições
        hipertenso: req.body.hipertenso === 'on',
        diabetico: req.body.diabetico === 'on',
        fumante: req.body.fumante === 'on',
        alcool: req.body.alcool === 'on',
        drogas: req.body.drogas === 'on',
        
        gestante: req.body.gestante === 'on',
        acamado: req.body.acamado === 'on',
        domiciliado: req.body.domiciliado === 'on', // Restrito ao domicilio mas não acamado
        
        avc: req.body.avc === 'on',
        infarto: req.body.infarto === 'on',
        cardiaco: req.body.cardiaco === 'on', // Doença Cardíaca
        rim: req.body.rim === 'on', // Doença Renal
        respiratoria: req.body.respiratoria === 'on', // Asma/DPOC
        hanseniase: req.body.hanseniase === 'on',
        tuberculose: req.body.tuberculose === 'on',
        cancer: req.body.cancer === 'on',
        
        internacaoRecente: req.body.internacaoRecente === 'on', // Últimos 12 meses
        saudeMental: req.body.saudeMental === 'on',
        
        // 4. Outros
        observacoes: req.body.observacoes,
        criadoEm: new Date()
    };

    pacientes.push(novoPaciente);
    salvarPacientes(pacientes);
    res.redirect('/');
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    iniciarBanco();
    console.log(`Servidor rodando na porta ${PORT}`);
});
