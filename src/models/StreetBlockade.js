// src/models/StreetBlockade.js
const mongoose = require("mongoose");

const StreetBlockadeSchema = new mongoose.Schema(
  {
    cityId: { 
      type: String, 
      required: true,
      index: true 
    },
    
    // Trecho de rua interditado (linha no mapa)
    route: {
      // Array de coordenadas formando o trecho
      coordinates: [{
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        order: { type: Number, required: true }, // ordem dos pontos para formar a linha
        _id: false // Desabilitar criação automática de _id para subdocumentos
      }],
      // Nome da rua(s) afetada(s)
      streetName: { type: String, required: true },
      // Bairro
      neighborhood: { type: String, required: true },
      // Descrição adicional do trecho
      description: { type: String }
    },
    
    // Informações da interdição
    type: { 
      type: String, 
      enum: ["evento", "obra", "emergencia", "manutencao", "outro"],
      required: true,
      index: true
    },
    reason: { 
      type: String, 
      required: true 
    }, // Descrição detalhada do motivo
    
    // Período
    startDate: { 
      type: Date, 
      required: true,
      index: true
    },
    endDate: { 
      type: Date, 
      required: false, // Tornado opcional conforme solicitado
      validate: {
        validator: function(value) {
          // Se endDate existir, deve ser posterior à startDate
          if (value && this.startDate) {
            return value > this.startDate;
          }
          return true; // Se não houver endDate, validação passa
        },
        message: "Data de término deve ser posterior à data de início"
      }
    },
    
    // Status
    status: { 
      type: String, 
      enum: ["agendado", "ativo", "encerrado", "cancelado"],
      default: "agendado",
      index: true
    },
    
    // Criado por
    createdBy: {
      adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true
      },
      adminName: { type: String, required: true },
      secretaria: { type: String } // ID da secretaria
    },
    
    // Rota alternativa (opcional)
    alternativeRoute: {
      coordinates: [{
        lat: { type: Number },
        lng: { type: Number },
        order: { type: Number },
        _id: false // Desabilitar criação automática de _id para subdocumentos
      }],
      description: { type: String }
    },
    
    // Impacto
    impact: {
      level: { 
        type: String, 
        enum: ["baixo", "medio", "alto", "total"],
        default: "medio"
      },
      affectedArea: { type: String } // descrição da área afetada
    },
    
    // Notas internas (apenas para admin)
    internalNotes: { type: String }
  },
  { timestamps: true, collection: "street_blockades" }
);

// Índices para queries eficientes
StreetBlockadeSchema.index({ cityId: 1, status: 1 });
StreetBlockadeSchema.index({ startDate: 1, endDate: 1 });
// Nota: Não podemos usar índice 2dsphere em route.coordinates porque o formato é {lat, lng, order}
// O MongoDB espera formato GeoJSON para índices 2dsphere, mas estamos usando objetos customizados
// Para buscas geoespaciais futuras, podemos criar um campo separado no formato GeoJSON se necessário

// Middleware pré-save: validação de coordenadas mínimas
StreetBlockadeSchema.pre("save", function (next) {
  // Valida que há pelo menos 2 pontos para formar um trecho
  if (!this.route.coordinates || this.route.coordinates.length < 2) {
    return next(new Error("É necessário pelo menos 2 pontos para definir um trecho interditado"));
  }
  
  // Ordena coordenadas por ordem se necessário
  this.route.coordinates.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Atualiza status baseado nas datas
  const now = new Date();
  if (this.status !== "cancelado" && this.status !== "encerrado") {
    if (this.endDate) {
      // Se houver data de término, usar lógica normal
      if (now >= this.startDate && now <= this.endDate) {
        this.status = "ativo";
      } else if (now > this.endDate) {
        this.status = "encerrado";
      } else {
        this.status = "agendado";
      }
    } else {
      // Se não houver data de término, considerar ativo se já começou
      if (now >= this.startDate) {
        this.status = "ativo";
      } else {
        this.status = "agendado";
      }
    }
  }
  
  next();
});

const StreetBlockade = mongoose.model("StreetBlockade", StreetBlockadeSchema);

// Remover índice 2dsphere problemático se existir (executa após conexão com DB)
const removeProblematicIndex = async () => {
  try {
    const indexes = await StreetBlockade.collection.getIndexes();
    const problematicIndexes = Object.keys(indexes).filter(name => 
      name.includes('2dsphere') || (name.includes('coordinates') && name.includes('2dsphere'))
    );
    
    for (const indexName of problematicIndexes) {
      try {
        await StreetBlockade.collection.dropIndex(indexName);
        console.log(`✅ Índice problemático removido: ${indexName}`);
      } catch (error) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') {
          console.log(`ℹ️ Índice ${indexName} não encontrado (já foi removido)`);
        } else {
          console.error(`❌ Erro ao remover índice ${indexName}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar índices:', error.message);
  }
};

// Executar remoção de índice quando MongoDB estiver conectado
if (mongoose.connection.readyState === 1) {
  removeProblematicIndex();
} else {
  mongoose.connection.once('connected', () => {
    setTimeout(removeProblematicIndex, 1000); // Pequeno delay para garantir que índices foram criados
  });
}

module.exports = StreetBlockade;

