// Script para atualizar a descrição do menu de sugestões de melhorias
// Uso: node scripts/update-menu-description.js

const mongoose = require("mongoose");
const City = require("../src/models/City");
require("dotenv").config();

const updateMenuDescription = async () => {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB");

    // Buscar todas as cidades
    const cities = await City.find({});
    console.log(`📋 Encontradas ${cities.length} cidades`);

    let updatedCount = 0;

    for (const city of cities) {
      if (!city.menu || !Array.isArray(city.menu)) continue;

      let cityUpdated = false;

      // Atualizar cada item do menu
      const updatedMenu = city.menu.map((item) => {
        if (item.description) {
          // Substituir "irregularidades" por "sugestões de melhorias"
          const oldDescription = item.description;
          const newDescription = item.description
            .replace(/irregularidades/gi, "sugestões de melhorias")
            .replace(/irregularidade/gi, "sugestão de melhoria")
            .replace(/apontando irregularidades/gi, "apontando sugestões de melhorias")
            .replace(/Contribua apontando irregularidades em seu município/gi, 
                     "Contribua apontando sugestões de melhorias em seu município");

          if (oldDescription !== newDescription) {
            console.log(`\n🔄 Cidade: ${city.label}`);
            console.log(`   Antes: "${oldDescription}"`);
            console.log(`   Depois: "${newDescription}"`);
            cityUpdated = true;
            return { ...item, description: newDescription };
          }
        }
        return item;
      });

      if (cityUpdated) {
        city.menu = updatedMenu;
        await city.save();
        updatedCount++;
        console.log(`   ✅ Menu atualizado para ${city.label}`);
      }
    }

    console.log(`\n✅ Processo concluído! ${updatedCount} cidade(s) atualizada(s)`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
};

updateMenuDescription();

