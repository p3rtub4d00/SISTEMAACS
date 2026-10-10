const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function criarBanco(arquivo) {
    function iniciar() {
        fs.mkdirSync(path.dirname(arquivo), { recursive: true });
        if (!fs.existsSync(arquivo)) fs.writeFileSync(arquivo, '[]', { flag: 'wx', mode: 0o600 });
    }
    function ler() {
        // Depois da inicialização, um arquivo ausente também é uma falha de leitura.
        const pacientes = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        if (!Array.isArray(pacientes)) throw new Error('Formato de banco inválido.');
        return pacientes;
    }
    function salvar(pacientes) {
        // Valida o arquivo existente antes de qualquer escrita ou backup.
        ler();
        const temporario = `${arquivo}.${randomUUID()}.tmp`;
        try {
            fs.writeFileSync(temporario, JSON.stringify(pacientes, null, 2), { flag: 'wx', mode: 0o600 });
            fs.copyFileSync(arquivo, `${arquivo}.bak`);
            fs.chmodSync(`${arquivo}.bak`, 0o600);
            fs.renameSync(temporario, arquivo);
        } finally {
            if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
        }
    }
    return { iniciar, ler, salvar };
}

module.exports = { criarBanco };
