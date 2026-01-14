const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Paciente = require('./models/Paciente');

const app = express();

// Configuração
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Conexão com MongoDB
const connectDB = async () => {
    try {
        // Se estiver rodando localmente sem .env, use uma string local ou a do Atlas
        const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/acs_system'; 
        await mongoose.connect(dbURI);
        console.log('MongoDB Conectado!');
    } catch (err) {
        console.error('Erro ao conectar MongoDB:', err);
    }
};
connectDB();

// Rotas

// 1. Tela Inicial (Lista de Pacientes)
app.get('/', async (req, res) => {
    let busca = {};
    if (req.query.search) {
        busca = { nome: { $regex: req.query.search, $options: 'i' } };
    }
    const pacientes = await Paciente.find(busca).sort({ nome: 1 });
    res.render('index', { pacientes });
});

// 2. Tela de Cadastro
app.get('/cadastro', (req, res) => {
    res.render('cadastro');
});

// 3. Salvar Paciente
app.post('/cadastro', async (req, res) => {
    try {
        const { 
            nome, cns, dataNascimento, nomeMae, telefone, 
            endereco, numero, bairro, microarea, familiaId, observacoes 
        } = req.body;

        const novoPaciente = new Paciente({
            nome, cns, dataNascimento, nomeMae, telefone,
            endereco, numero, bairro, microarea, familiaId, observacoes,
            hipertenso: req.body.hipertenso === 'on',
            diabetico: req.body.diabetico === 'on',
            gestante: req.body.gestante === 'on',
            acamado: req.body.acamado === 'on'
        });

        await novoPaciente.save();
        res.redirect('/');
    } catch (err) {
        console.log(err);
        res.send("Erro ao cadastrar. Verifique os campos.");
    }
});

// 4. Ver Detalhes (Para Impressão)
app.get('/paciente/:id', async (req, res) => {
    try {
        const paciente = await Paciente.findById(req.params.id);
        res.render('detalhes', { paciente });
    } catch (err) {
        res.redirect('/');
    }
});

// 5. Deletar (Opcional)
app.post('/delete/:id', async (req, res) => {
    await Paciente.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
