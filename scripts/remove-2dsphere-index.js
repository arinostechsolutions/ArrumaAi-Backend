// Script para remover índice 2dsphere problemático da coleção street_blockades
const mongoose = require("mongoose");
require("dotenv").config();

const removeProblematicIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("street_blockades");
    
    const indexes = await collection.indexes();
    console.log("\n📋 Índices atuais:");
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    const problematicIndexes = indexes.filter(idx => 
      idx.name.includes('2dsphere') || 
      (idx.name.includes('coordinates') && idx.key && Object.keys(idx.key).some(k => k.includes('coordinates') && idx.key[k] === '2dsphere'))
    );

    if (problematicIndexes.length === 0) {
      console.log("\n✅ Nenhum índice problemático encontrado!");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\n🔍 Encontrados ${problematicIndexes.length} índice(s) problemático(s):`);
    problematicIndexes.forEach(idx => {
      console.log(`  - ${idx.name}`);
    });

    for (const idx of problematicIndexes) {
      try {
        await collection.dropIndex(idx.name);
        console.log(`✅ Índice removido: ${idx.name}`);
      } catch (error) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') {
          console.log(`ℹ️ Índice ${idx.name} não encontrado (já foi removido)`);
        } else {
          console.error(`❌ Erro ao remover ${idx.name}:`, error.message);
        }
      }
    }

    console.log("\n📋 Índices restantes:");
    const remainingIndexes = await collection.indexes();
    remainingIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    await mongoose.disconnect();
    console.log("\n✅ Concluído!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

removeProblematicIndex();


