const express = require('express');
const bodyParser = require('body-parser');
const { randomUUID } = require('crypto');
const { criarBanco } = require('./lib/banco');
const risco = require('./lib/risco');
const path = require('path');

function criarApp(opcoes = {}) {
    const app = express();
    const arquivo = opcoes.arquivoBanco || path.join(process.env.DATA_DIR || __dirname, 'banco.json');
    const banco = criarBanco(arquivo);
    banco.iniciar();
    const lerPacientes = banco.ler;
    const salvarPacientes = banco.salvar;
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(bodyParser.urlencoded({ extended: true, limit: '64kb' }));
    app.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        res.locals.risco = risco;
        next();
    });

    function validarPaciente(body, pacientes, id) {
        const erros = [];
        for (const campo of ['nome', 'dataNascimento', 'microarea', 'endereco']) {
            if (typeof body[campo] !== 'string' || !body[campo].trim()) erros.push(`Preencha o campo ${campo}.`);
        }
        if (body.dataNascimento && (!/^\d{4}-\d{2}-\d{2}$/.test(body.dataNascimento) ||
            !Number.isFinite(new Date(body.dataNascimento).getTime()) ||
            new Date(body.dataNascimento).toISOString().slice(0, 10) !== body.dataNascimento || body.dataNascimento > risco.hoje())) {
            erros.push('Informe uma data de nascimento válida, até hoje.');
        }
        for (const campo of Object.keys(body)) {
            if (typeof body[campo] !== 'string' || body[campo].length > (campo === 'observacoes' ? 3000 : 250)) {
                erros.push(`O campo ${campo} tem formato ou tamanho inválido.`);
            }
        }
        for (const campo of ['cpf', 'cns']) {
            const documento = typeof body[campo] === 'string' ? body[campo].replace(/\D/g, '') : '';
            if (documento && pacientes.some(p => p.id !== id && typeof p[campo] === 'string' && p[campo].replace(/\D/g, '') === documento)) {
                erros.push(`Já existe um paciente com esse ${campo.toUpperCase()}.`);
            }
        }
        return erros;
    }

    // --- ROTAS ---

    // 1. Home (Dashboard)
    app.get('/', (req, res) => {
        let pacientes = lerPacientes();
        const filtros = {
            search: typeof req.query.search === 'string' ? req.query.search.trim() : '',
            tipo: Object.hasOwn(risco.tipos, req.query.tipo || '') ? req.query.tipo : '',
            nivel: Object.hasOwn(risco.niveis, req.query.nivel || '') || req.query.nivel === 'nao_avaliado' ? req.query.nivel : '',
            acompanhamento: ['atrasada', 'hoje', 'sem_data'].includes(req.query.acompanhamento) ? req.query.acompanhamento : ''
        };
        const resumo = { total: pacientes.length, avaliados: 0, naoAvaliados: 0, atrasados: 0 };
        for (const p of pacientes) {
            const avaliacoes = risco.ultimasPorTipo(p).filter(a => !filtros.tipo || a.tipo === filtros.tipo);
            if (avaliacoes.length) resumo.avaliados++; else resumo.naoAvaliados++;
            if (avaliacoes.some(a => risco.pendencia(a) === 'atrasada')) resumo.atrasados++;
        }
        if (filtros.search) {
            const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const termo = normalizar(filtros.search);
            const digitos = filtros.search.replace(/\D/g, '');
            const soDocumento = /^[\d.\-\s]+$/.test(filtros.search) && digitos;
            pacientes = pacientes.filter(p =>
                [p.nome, p.cpf, p.cns, p.microarea, p.familiaId].some(v => normalizar(v).includes(termo)) ||
                (soDocumento && [p.cpf, p.cns].some(v => String(v || '').replace(/\D/g, '').includes(digitos)))
            );
        }
        pacientes = pacientes.filter(p => {
            const avaliacoes = risco.ultimasPorTipo(p).filter(a => !filtros.tipo || a.tipo === filtros.tipo);
            if (filtros.nivel === 'nao_avaliado') return !avaliacoes.length && !filtros.acompanhamento;
            return (!filtros.tipo || avaliacoes.length || filtros.nivel === 'nao_avaliado') &&
                (!filtros.nivel && !filtros.acompanhamento || avaliacoes.some(a =>
                    (!filtros.nivel || a.nivel === filtros.nivel) &&
                    (!filtros.acompanhamento || risco.pendencia(a) === filtros.acompanhamento)));
        });
        // Ordena por Microárea
        pacientes.sort((a, b) => (a.microarea || '').localeCompare(b.microarea || ''));
        res.render('index', { pacientes, filtros, resumo });
    });

    // 2. Cadastro
    app.get('/cadastro', (req, res) => {
        res.render('cadastro');
    });

    app.post('/cadastro', (req, res) => {
        const pacientes = lerPacientes();
        const erros = validarPaciente(req.body, pacientes);
        if (erros.length) return res.status(422).render('erro', { mensagem: erros.join(' '), voltar: '/cadastro' });
        const novoPaciente = processarDados(req.body, randomUUID());
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
            const erros = validarPaciente(req.body, pacientes, req.params.id);
            if (erros.length) return res.status(422).render('erro', { mensagem: erros.join(' '), voltar: '/editar/' + req.params.id });
            // Mantém a data de criação original e o ID
            const criadoEmOriginal = pacientes[index].criadoEm;
            const dadosAtualizados = processarDados(req.body, req.params.id);
            dadosAtualizados.criadoEm = criadoEmOriginal;
        
            pacientes[index] = { ...pacientes[index], ...dadosAtualizados };
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
        const paciente = pacientes.find(p => p.id === req.params.id);
        if (paciente && risco.historico(paciente).length) {
            return res.status(409).render('erro', { mensagem: 'Esta ficha possui histórico de avaliações. A exclusão foi bloqueada para preservar esses registros.', voltar: '/paciente/' + req.params.id });
        }
        pacientes = pacientes.filter(p => p.id !== req.params.id);
        salvarPacientes(pacientes);
        res.redirect('/');
    });

    // Histórico por paciente e tipo: sem inferir classificação a partir das doenças.
    app.get('/paciente/:id/risco', (req, res) => {
        const paciente = lerPacientes().find(p => p.id === req.params.id);
        if (!paciente) return res.status(404).render('erro', { mensagem: 'Paciente não encontrado.', voltar: '/' });
        res.render('risco', { paciente, erros: [], valores: { dataAvaliacao: risco.hoje() }, salvo: req.query.salvo === '1' });
    });

    app.post('/paciente/:id/risco', (req, res) => {
        const pacientes = lerPacientes();
        const paciente = pacientes.find(p => p.id === req.params.id);
        if (!paciente) return res.status(404).render('erro', { mensagem: 'Paciente não encontrado.', voltar: '/' });
        const resultado = risco.criarAvaliacao(req.body, paciente);
        if (resultado.erros.length) return res.status(422).render('risco', {
            paciente, erros: resultado.erros, valores: resultado.valores, salvo: false
        });
        paciente.avaliacoesRisco = [...risco.historico(paciente), resultado.avaliacao];
        salvarPacientes(pacientes);
        res.redirect('/paciente/' + req.params.id + '/risco?salvo=1');
    });

    app.use((err, req, res, next) => {
        console.error('Falha ao atender requisição:', err.code || err.name);
        if (res.headersSent) return next(err);
        res.status(503).render('erro', {
            mensagem: 'Não foi possível concluir a operação. Os registros não devem ser recriados. Solicite ao responsável a verificação do armazenamento e do backup.',
            voltar: '/'
        });
    });
    return app;
}

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

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    criarApp().listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}
module.exports = { criarApp };
