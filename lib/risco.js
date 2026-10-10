const { randomUUID } = require('crypto');

// Registro de uma avaliação profissional: não contém regras ou escores clínicos.
const tipos = {
    geral: 'Avaliação geral',
    hipertensao: 'Hipertensão',
    diabetes: 'Diabetes',
    cardiovascular: 'Cardiovascular',
    gestacao: 'Gestação'
};
const niveis = {
    baixo: { nome: 'Baixo', classe: 'success' },
    moderado: { nome: 'Moderado', classe: 'warning text-dark' },
    alto: { nome: 'Alto', classe: 'danger' },
    muito_alto: { nome: 'Muito alto', classe: 'dark' }
};
const timezone = process.env.APP_TIMEZONE || 'America/Boa_Vista';

function hoje() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const valor = Object.fromEntries(partes.map(p => [p.type, p.value]));
    return `${valor.year}-${valor.month}-${valor.day}`;
}

function dataValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T12:00:00Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function formatarData(valor) {
    if (!valor) return 'Não informada';
    if (dataValida(valor)) return valor.split('-').reverse().join('/');
    const data = new Date(valor);
    return Number.isFinite(data.getTime())
        ? data.toLocaleString('pt-BR', { timeZone: timezone }) : 'Data inválida';
}

function historico(paciente) {
    return Array.isArray(paciente.avaliacoesRisco) ? paciente.avaliacoesRisco : [];
}

function ultimasPorTipo(paciente) {
    const ultimas = {};
    // A avaliação com data mais recente prevalece; o último registro desempata.
    for (const avaliacao of historico(paciente)) {
        if (!Object.hasOwn(tipos, avaliacao.tipo) || !Object.hasOwn(niveis, avaliacao.nivel)) continue;
        if (!ultimas[avaliacao.tipo] || avaliacao.dataAvaliacao >= ultimas[avaliacao.tipo].dataAvaliacao) {
            ultimas[avaliacao.tipo] = avaliacao;
        }
    }
    return Object.values(ultimas);
}

function criarAvaliacao(body, paciente = {}) {
    const erros = [];
    const campos = ['tipo', 'nivel', 'dataAvaliacao', 'proximaAvaliacao', 'profissional',
        'funcaoProfissional', 'protocolo', 'versaoProtocolo', 'justificativa', 'planoAcompanhamento'];
    const valores = {};
    for (const campo of campos) {
        valores[campo] = typeof body[campo] === 'string' ? body[campo].trim() : '';
    }
    if (!Object.hasOwn(tipos, valores.tipo)) erros.push('Selecione um tipo de avaliação válido.');
    if (!Object.hasOwn(niveis, valores.nivel)) erros.push('Selecione a classificação registrada pelo profissional.');
    if (!dataValida(valores.dataAvaliacao) || valores.dataAvaliacao > hoje()) {
        erros.push('Informe uma data de avaliação válida, até hoje.');
    }
    if (dataValida(paciente.dataNascimento) && dataValida(valores.dataAvaliacao) && valores.dataAvaliacao < paciente.dataNascimento) {
        erros.push('A avaliação não pode ter data anterior ao nascimento do paciente.');
    }
    if (valores.proximaAvaliacao && (!dataValida(valores.proximaAvaliacao) || valores.proximaAvaliacao <= valores.dataAvaliacao)) {
        erros.push('A próxima avaliação deve ter uma data válida posterior à avaliação registrada.');
    }
    for (const [campo, nome, maximo] of [
        ['profissional', 'Nome do profissional responsável', 150],
        ['funcaoProfissional', 'Função do profissional responsável', 100],
        ['protocolo', 'Nome do protocolo utilizado', 250],
        ['versaoProtocolo', 'Versão ou ano do protocolo', 100],
        ['justificativa', 'Justificativa e critérios utilizados', 3000]
    ]) {
        if (!valores[campo] || valores[campo].length > maximo) erros.push(`${nome}: preencha até ${maximo} caracteres.`);
    }
    if (valores.planoAcompanhamento.length > 3000) erros.push('O plano de acompanhamento deve ter até 3000 caracteres.');
    if (body.confirmacao !== 'on') erros.push('Confirme que está registrando uma classificação realizada pelo profissional responsável.');
    return {
        erros, valores,
        avaliacao: erros.length ? null : {
            ...valores, id: randomUUID(), registradoEm: new Date().toISOString(), origem: 'registro_profissional'
        }
    };
}

function pendencia(avaliacao) {
    if (!avaliacao.proximaAvaliacao) return 'sem_data';
    if (avaliacao.proximaAvaliacao < hoje()) return 'atrasada';
    if (avaliacao.proximaAvaliacao === hoje()) return 'hoje';
    return 'agendada';
}

module.exports = { tipos, niveis, hoje, formatarData, historico, ultimasPorTipo, criarAvaliacao, pendencia };
