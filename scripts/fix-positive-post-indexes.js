/**
 * Script para corrigir índices do modelo PositivePost
 * Execute: node scripts/fix-positive-post-indexes.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Carregar variáveis de ambiente
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: envFile });
if (!process.env.MONGO_URI) {
  dotenv.config();
}

async function fixIndexes() {
  try {
    console.log("🔌 Conectando ao MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("positiveposts");

    console.log("\n📋 Listando índices atuais...");
    const indexes = await collection.indexes();
    console.log("Índices encontrados:");
    indexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(idx.key)} - ${idx.name}`);
    });

    // Remover índice antigo se existir
    try {
      console.log("\n🗑️  Tentando remover índice antigo 'location_2dsphere'...");
      await collection.dropIndex("location_2dsphere");
      console.log("✅ Índice antigo removido com sucesso!");
    } catch (error) {
      if (error.code === 27 || error.codeName === "IndexNotFound") {
        console.log("ℹ️  Índice antigo não encontrado (já foi removido ou nunca existiu)");
      } else {
        console.log(`⚠️  Erro ao remover índice antigo: ${error.message}`);
      }
    }

    // Recriar índices através do modelo
    console.log("\n🔄 Recriando índices através do modelo...");
    const PositivePost = require("../src/models/PositivePost");
    await PositivePost.createIndexes();
    console.log("✅ Índices recriados com sucesso!");

    console.log("\n📋 Listando índices após correção...");
    const newIndexes = await collection.indexes();
    console.log("Índices atuais:");
    newIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(idx.key)} - ${idx.name}`);
    });

    console.log("\n✅ Processo concluído!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fixIndexes();

