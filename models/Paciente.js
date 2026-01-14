const mongoose = require('mongoose');

const PacienteSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    cns: { type: String, required: true }, // Cartão Nacional de Saúde
    dataNascimento: { type: Date, required: true },
    nomeMae: { type: String },
    telefone: { type: String },
    endereco: { type: String, required: true },
    numero: { type: String },
    bairro: { type: String },
    microarea: { type: String, required: true }, // Importante para ACS
    familiaId: { type: String }, // Número da ficha familiar
    
    // Condições de Saúde (Marcadores)
    hipertenso: { type: Boolean, default: false },
    diabetico: { type: Boolean, default: false },
    gestante: { type: Boolean, default: false },
    acamado: { type: Boolean, default: false },
    
    observacoes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Paciente', PacienteSchema);
