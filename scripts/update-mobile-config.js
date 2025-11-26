/**
 * Script para adicionar mobileConfig com valores padrão (showFeed: true, showMap: true)
 * em todas as cidades que ainda não possuem essa configuração
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const City = require("../src/models/City");

async function updateMobileConfig() {
  try {
    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGODB_URI não encontrada no .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Conectado ao MongoDB");

    // Buscar todas as cidades que não têm mobileConfig ou têm mobileConfig incompleto
    const cities = await City.find({
      $or: [
        { mobileConfig: { $exists: false } },
        { "mobileConfig.showFeed": { $exists: false } },
        { "mobileConfig.showMap": { $exists: false } },
      ],
    });

    console.log(`📋 Encontradas ${cities.length} cidades para atualizar`);

    if (cities.length === 0) {
      console.log("✅ Todas as cidades já possuem mobileConfig configurado");
      await mongoose.disconnect();
      return;
    }

    // Atualizar cada cidade
    let updated = 0;
    for (const city of cities) {
      const updateData = {};
      
      if (!city.mobileConfig) {
        updateData.mobileConfig = {
          showFeed: true,
          showMap: true,
        };
      } else {
        if (city.mobileConfig.showFeed === undefined) {
          updateData["mobileConfig.showFeed"] = true;
        }
        if (city.mobileConfig.showMap === undefined) {
          updateData["mobileConfig.showMap"] = true;
        }
      }

      await City.updateOne({ _id: city._id }, { $set: updateData });
      updated++;
      console.log(`✅ Atualizada: ${city.label} (${city.id})`);
    }

    console.log(`\n✅ ${updated} cidades atualizadas com sucesso!`);
    await mongoose.disconnect();
    console.log("✅ Desconectado do MongoDB");
  } catch (error) {
    console.error("❌ Erro ao atualizar mobileConfig:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Executar script
updateMobileConfig();




