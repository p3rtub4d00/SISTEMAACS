const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarApp } = require('../server');
const risco = require('../lib/risco');

const pacienteBase = {
    nome: 'Pessoa Fictícia', dataNascimento: '1990-01-01', microarea: 'MA-TESTE',
    endereco: 'Rua de Teste', nacionalidade: 'Brasileira', situacaoTrabalho: 'Autônomo',
    peso: 'Peso Adequado', racaCor: 'Indígena', tuberculose: 'on', cancer: 'on',
    saudeMental: 'on', temPlanoSaude: 'on', avc: 'on', rim: 'on'
};
const avaliacaoBase = {
    tipo: 'hipertensao', nivel: 'alto', dataAvaliacao: '2020-01-01',
    proximaAvaliacao: '2020-02-01', profissional: 'Profissional Fictício',
    funcaoProfissional: 'Enfermeiro', protocolo: 'Protocolo de teste — sem valor clínico',
    versaoProtocolo: 'TESTE', justificativa: 'Dados fictícios para verificar o registro.',
    planoAcompanhamento: 'Plano fictício.', confirmacao: 'on'
};

async function ambiente(t) {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'acs-teste-'));
    const arquivo = path.join(diretorio, 'banco.json');
    const server = criarApp({ arquivoBanco: arquivo }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(diretorio, { recursive: true, force: true });
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    const post = (rota, dados) => fetch(url + rota, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(dados), redirect: 'manual'
    });
    const get = rota => fetch(url + rota);
    const ler = () => JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    return { arquivo, post, get, ler };
}

test('paciente sem avaliação não é classificado como baixo risco; páginas antigas continuam funcionando', async t => {
    const { post, get, ler } = await ambiente(t);
    assert.equal((await post('/cadastro', pacienteBase)).status, 302);
    const id = ler()[0].id;
    const home = await get('/');
    assert.equal(home.headers.get('cache-control'), 'no-store');
    assert.match(await home.text(), /Risco não avaliado/);
    for (const rota of ['/cadastro', '/editar/' + id, '/paciente/' + id, '/paciente/' + id + '/risco']) {
        const resposta = await get(rota);
        assert.equal(resposta.status, 200);
        assert.match(await resposta.text(), /name="viewport"/);
    }
});

test('registra avaliação com protocolo, responsável, datas e identificador; preserva histórico', async t => {
    const { post, get, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const id = ler()[0].id;
    const rota = '/paciente/' + id + '/risco';
    const primeira = await post(rota, avaliacaoBase);
    assert.equal(primeira.status, 302);
    assert.equal(primeira.headers.get('location'), rota + '?salvo=1');
    const registro = ler()[0].avaliacoesRisco[0];
    assert.equal(registro.origem, 'registro_profissional');
    assert.equal(registro.protocolo, avaliacaoBase.protocolo);
    assert.ok(registro.id && registro.registradoEm);
    assert.equal((await post(rota, { ...avaliacaoBase, nivel: 'moderado', dataAvaliacao: '2021-01-01', proximaAvaliacao: '' })).status, 302);
    const historico = ler()[0].avaliacoesRisco;
    assert.equal(historico.length, 2);
    assert.deepEqual(historico[0], registro);
    assert.equal(risco.ultimasPorTipo(ler()[0])[0].nivel, 'moderado');
    assert.match(await (await get(rota + '?salvo=1')).text(), /Avaliação salva com sucesso/);
});

test('rejeita classificação inválida, datas impossíveis, campos incompletos e confirmação ausente sem gravar', async t => {
    const { post, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const rota = '/paciente/' + ler()[0].id + '/risco';
    for (const alteracao of [
        { tipo: 'constructor' }, { nivel: 'constructor' }, { profissional: '' },
        { protocolo: '' }, { versaoProtocolo: '' }, { justificativa: '' }, { confirmacao: '' },
        { dataAvaliacao: '2020-02-30' }, { dataAvaliacao: '2099-01-01' }, { dataAvaliacao: '1980-01-01' },
        { proximaAvaliacao: '2019-01-01' }, { proximaAvaliacao: '2020-01-01' },
        { proximaAvaliacao: '2021-02-29' }, { justificativa: 'x'.repeat(3001) }
    ]) {
        const resposta = await post(rota, { ...avaliacaoBase, ...alteracao });
        assert.equal(resposta.status, 422, JSON.stringify(alteracao).slice(0, 150));
        assert.match(await resposta.text(), /Confira os campos/);
        assert.equal(ler()[0].avaliacoesRisco, undefined);
    }
});

test('última avaliação usa data clínica, desempata pela ordem e separa os tipos', () => {
    const paciente = { avaliacoesRisco: [
        { ...avaliacaoBase, nivel: 'alto', dataAvaliacao: '2021-01-01' },
        { ...avaliacaoBase, nivel: 'baixo', dataAvaliacao: '2020-01-01' },
        { ...avaliacaoBase, tipo: 'diabetes', nivel: 'moderado', dataAvaliacao: '2022-01-01' },
        { ...avaliacaoBase, nivel: 'muito_alto', dataAvaliacao: '2021-01-01' }
    ] };
    const ultimas = risco.ultimasPorTipo(paciente);
    assert.equal(ultimas.length, 2);
    assert.equal(ultimas.find(a => a.tipo === 'hipertensao').nivel, 'muito_alto');
    assert.equal(ultimas.find(a => a.tipo === 'diabetes').nivel, 'moderado');
});

test('edição apresenta todos os campos do cadastro e preserva condições e avaliações', async t => {
    const { post, get, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const id = ler()[0].id;
    await post('/paciente/' + id + '/risco', avaliacaoBase);
    const original = ler()[0];
    const htmlEdicao = await (await get('/editar/' + id)).text();
    const htmlCadastro = await (await get('/cadastro')).text();
    const campos = html => new Set([...html.matchAll(/name="([^"]+)"/g)].map(m => m[1]).filter(n => n !== 'viewport'));
    const camposEdicao = campos(htmlEdicao);
    for (const campo of campos(htmlCadastro)) assert.ok(camposEdicao.has(campo), 'Campo ausente na edição: ' + campo);
    assert.match(htmlEdicao, /value="Indígena" selected/);
    assert.equal((await post('/editar/' + id, { ...pacienteBase, nome: 'Pessoa Fictícia Atualizada' })).status, 302);
    const atualizado = ler()[0];
    assert.deepEqual(atualizado.avaliacoesRisco, original.avaliacoesRisco);
    assert.equal(atualizado.criadoEm, original.criadoEm);
    for (const campo of ['tuberculose', 'cancer', 'saudeMental', 'temPlanoSaude', 'avc', 'rim']) assert.equal(atualizado[campo], true);
    for (const campo of ['nacionalidade', 'situacaoTrabalho', 'peso', 'racaCor']) assert.equal(atualizado[campo], pacienteBase[campo]);
});

test('filtros de nível e reavaliação correspondem à mesma avaliação; pesquisa microárea e nome sem acento', async t => {
    const { post, get, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const id = ler()[0].id;
    await post('/cadastro', { ...pacienteBase, nome: 'Sem Avaliação' });
    await post('/paciente/' + id + '/risco', { ...avaliacaoBase, proximaAvaliacao: '' });
    await post('/paciente/' + id + '/risco', { ...avaliacaoBase, tipo: 'diabetes', nivel: 'baixo' });
    for (const rota of ['/?search=MA-TESTE', '/?search=Ficticia', '/?tipo=hipertensao&nivel=alto', '/?tipo=diabetes&acompanhamento=atrasada']) {
        assert.match(await (await get(rota)).text(), /Pessoa Fictícia/);
    }
    assert.doesNotMatch(await (await get('/?nivel=alto&acompanhamento=atrasada')).text(), /Pessoa Fictícia/);
    const naoAvaliados = await (await get('/?nivel=nao_avaliado')).text();
    assert.match(naoAvaliados, /Sem Avaliação/);
    assert.doesNotMatch(naoAvaliados, /Pessoa Fictícia/);
});

test('não permite excluir ficha com histórico; preserva exclusão de cadastro sem avaliação', async t => {
    const { post, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const id = ler()[0].id;
    await post('/paciente/' + id + '/risco', avaliacaoBase);
    assert.equal((await post('/delete/' + id, {})).status, 409);
    assert.equal(ler().length, 1);
    await post('/cadastro', { ...pacienteBase, nome: 'Outra Pessoa' });
    assert.equal((await post('/delete/' + ler()[1].id, {})).status, 302);
    assert.equal(ler().length, 1);
});

test('corrupção no banco bloqueia gravação e mantém arquivo e backup', async t => {
    const { arquivo, post, get, ler } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    const id = ler()[0].id;
    await post('/paciente/' + id + '/risco', avaliacaoBase);
    const backup = fs.readFileSync(arquivo + '.bak', 'utf8');
    assert.equal(JSON.parse(backup)[0].id, id);
    fs.writeFileSync(arquivo, '{arquivo corrompido');
    assert.equal((await post('/cadastro', pacienteBase)).status, 503);
    assert.equal((await post('/paciente/' + id + '/risco', avaliacaoBase)).status, 503);
    assert.equal((await get('/')).status, 503);
    assert.equal(fs.readFileSync(arquivo, 'utf8'), '{arquivo corrompido');
    assert.equal(fs.readFileSync(arquivo + '.bak', 'utf8'), backup);
});

test('não cria avaliação para paciente inexistente e escapa texto no histórico', async t => {
    const { post, get, ler } = await ambiente(t);
    assert.equal((await post('/paciente/inexistente/risco', avaliacaoBase)).status, 404);
    assert.equal((await get('/paciente/inexistente/risco')).status, 404);
    await post('/cadastro', pacienteBase);
    const rota = '/paciente/' + ler()[0].id + '/risco';
    await post(rota, { ...avaliacaoBase, justificativa: '<script>alert(1)</script>' });
    const html = await (await get(rota)).text();
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;/);
});

test('arquivo desaparecido depois de iniciar não é recriado nem recebe novos cadastros', async t => {
    const { arquivo, post, get } = await ambiente(t);
    await post('/cadastro', pacienteBase);
    fs.unlinkSync(arquivo);
    assert.equal((await get('/')).status, 503);
    assert.equal((await post('/cadastro', pacienteBase)).status, 503);
    assert.equal(fs.existsSync(arquivo), false);
});

test('cadastro vazio e duplicação de CPF normalizado são rejeitados no servidor', async t => {
    const { post, ler } = await ambiente(t);
    assert.equal((await post('/cadastro', {})).status, 422);
    assert.equal(ler().length, 0);
    await post('/cadastro', { ...pacienteBase, cpf: '000.000.000-00' });
    assert.equal((await post('/cadastro', { ...pacienteBase, cpf: '00000000000' })).status, 422);
    assert.equal((await post('/cadastro', { ...pacienteBase, dataNascimento: '2000-02-30' })).status, 422);
    assert.equal(ler().length, 1);
});
