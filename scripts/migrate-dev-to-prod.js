const mongoose = require('mongoose');
require('dotenv').config();

// URIs dos bancos - construir a partir do MONGO_URI
function getDevUri() {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI.replace(/\/[^\/]+(\?|$)/, '/resolveai-dev$1');
  }
  throw new Error('MONGO_URI não encontrado no .env');
}

function getProdUri() {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI.replace(/\/[^\/]+(\?|$)/, '/resolveai-prod$1');
  }
  throw new Error('MONGO_URI não encontrado no .env');
}

async function migrate() {
  let devConn, prodConn;
  
  try {
    const devUri = getDevUri();
    const prodUri = getProdUri();
    
    console.log('🔄 Iniciando migração DEV → PROD');
    console.log(`📦 DEV:  ${devUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    console.log(`📦 PROD: ${prodUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    console.log('');
    
    // Conectar aos dois bancos
    devConn = await mongoose.createConnection(devUri).asPromise();
    prodConn = await mongoose.createConnection(prodUri).asPromise();
    
    console.log('✅ Conectado aos dois bancos');
    
    // Listar todas as coleções do dev
    const collections = await devConn.db.listCollections().toArray();
    console.log(`📦 Encontradas ${collections.length} coleções no banco DEV\n`);
    
    let totalDocuments = 0;
    let collectionsProcessed = 0;
    
    for (const collection of collections) {
      const collectionName = collection.name;
      
      // Pular coleções do sistema
      if (collectionName.startsWith('system.')) {
        console.log(`⏭️  Pulando coleção do sistema: ${collectionName}`);
        continue;
      }
      
      try {
        console.log(`🔄 Processando: ${collectionName}`);
        
        // Buscar todos os documentos
        const documents = await devConn.db.collection(collectionName).find({}).toArray();
        console.log(`   📄 ${documents.length} documentos encontrados`);
        
        if (documents.length > 0) {
          // Limpar coleção em prod (reescrever tudo)
          const deleteResult = await prodConn.db.collection(collectionName).deleteMany({});
          console.log(`   🗑️  ${deleteResult.deletedCount} documentos removidos de PROD`);
          
          // Inserir documentos em prod
          const insertResult = await prodConn.db.collection(collectionName).insertMany(documents, { ordered: false });
          console.log(`   ✅ ${insertResult.insertedCount} documentos copiados para PROD`);
          
          totalDocuments += insertResult.insertedCount;
        } else {
          console.log(`   ⚠️  Coleção vazia, pulando...`);
        }
        
        // Copiar índices
        try {
          const indexes = await devConn.db.collection(collectionName).indexes();
          if (indexes.length > 1) { // Mais que o índice padrão _id
            console.log(`   📇 Copiando ${indexes.length - 1} índice(s)...`);
            for (const index of indexes) {
              if (index.name !== '_id_') {
                try {
                  const indexSpec = { ...index.key };
                  const indexOptions = {};
                  
                  // Apenas incluir opções se forem booleanas (não null)
                  if (typeof index.unique === 'boolean') {
                    indexOptions.unique = index.unique;
                  }
                  if (typeof index.sparse === 'boolean') {
                    indexOptions.sparse = index.sparse;
                  }
                  if (typeof index.background === 'boolean') {
                    indexOptions.background = index.background;
                  }
                  if (index.name) {
                    indexOptions.name = index.name;
                  }
                  
                  await prodConn.db.collection(collectionName).createIndex(indexSpec, indexOptions);
                } catch (indexError) {
                  // Índice pode já existir, ignorar
                  if (!indexError.message.includes('already exists')) {
                    console.warn(`      ⚠️  Erro ao criar índice ${index.name}: ${indexError.message}`);
                  }
                }
              }
            }
          }
        } catch (indexError) {
          console.warn(`   ⚠️  Erro ao copiar índices: ${indexError.message}`);
        }
        
        collectionsProcessed++;
        
      } catch (collectionError) {
        console.error(`   ❌ Erro ao processar ${collectionName}:`, collectionError.message);
        // Continua com a próxima coleção
      }
      
      console.log('');
    }
    
    console.log('═══════════════════════════════════════');
    console.log(`✅ Migração concluída com sucesso!`);
    console.log(`📊 Total de documentos copiados: ${totalDocuments}`);
    console.log(`📦 Total de coleções processadas: ${collectionsProcessed}`);
    console.log('═══════════════════════════════════════');
    
    await devConn.close();
    await prodConn.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erro na migração:', error.message);
    console.error(error.stack);
    
    if (devConn) await devConn.close().catch(() => {});
    if (prodConn) await prodConn.close().catch(() => {});
    
    process.exit(1);
  }
}

// Executar migração
migrate();

