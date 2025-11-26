const sharp = require("sharp");
const axios = require("axios");
const vision = require("@google-cloud/vision");

/**
 * Serviço de processamento de imagem para compliance LGPD
 * Aplica blur automático em rostos e placas de veículos
 */

// Inicializar cliente do Google Cloud Vision
let visionClient = null;
function getVisionClient() {
  if (!visionClient) {
    try {
      // Opção 1: Usar arquivo JSON de credenciais (caminho via variável de ambiente)
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        visionClient = new vision.ImageAnnotatorClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
      }
      // Opção 2: Usar credenciais via variáveis de ambiente (JSON como string)
      else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        visionClient = new vision.ImageAnnotatorClient({
          credentials,
        });
      }
      // Opção 3: Tentar usar Application Default Credentials (ADC)
      else {
        visionClient = new vision.ImageAnnotatorClient();
      }
      console.log("✅ Google Cloud Vision client inicializado");
    } catch (error) {
      console.warn("⚠️ Erro ao inicializar Google Cloud Vision:", error.message);
      console.warn("⚠️ Detecção de rostos/placas desabilitada");
      return null;
    }
  }
  return visionClient;
}

/**
 * Detecta rostos usando Google Cloud Vision API
 */
async function detectFaces(imageBuffer) {
  try {
    const client = getVisionClient();
    if (!client) {
      return [];
    }

    const [result] = await client.faceDetection({
      image: { content: imageBuffer },
    });

    if (!result.faceAnnotations || result.faceAnnotations.length === 0) {
      return [];
    }

    // Obter dimensões da imagem para calcular coordenadas absolutas
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    const faces = result.faceAnnotations.map((face) => {
      const vertices = face.boundingPoly.vertices;
      
      // Calcular coordenadas e dimensões
      const x = vertices[0]?.x || 0;
      const y = vertices[0]?.y || 0;
      const width = (vertices[2]?.x || imgWidth) - x;
      const height = (vertices[2]?.y || imgHeight) - y;

      return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, imgWidth - x),
        height: Math.min(height, imgHeight - y),
      };
    });

    console.log(`👤 Detectados ${faces.length} rostos`);
    return faces;
  } catch (error) {
    console.error("❌ Erro ao detectar rostos:", error.message);
    return [];
  }
}

/**
 * Detecta placas de veículos usando Google Cloud Vision OCR
 * Detecta padrões de placas brasileiras (ABC-1234 ou ABC1D23)
 * Também tenta detectar objetos retangulares que possam ser placas
 */
async function detectLicensePlates(imageBuffer) {
  try {
    const client = getVisionClient();
    if (!client) {
      return [];
    }

    const plates = [];

    // Obter dimensões da imagem
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Método 1: Usar detecção de texto (OCR) - mais preciso para texto
    try {
      const [textResult] = await client.textDetection({
        image: { content: imageBuffer },
      });

      if (textResult.textAnnotations && textResult.textAnnotations.length > 0) {
        // Padrões de placas brasileiras mais abrangentes
        // Antiga: ABC-1234, ABC 1234, ABC1234
        // Nova Mercosul: ABC1D23, ABC12D3
        const platePatterns = [
          /[A-Z]{3}[- ]?[0-9]{4}/i,           // ABC-1234 ou ABC 1234 ou ABC1234
          /[A-Z]{3}[0-9][A-Z][0-9]{2}/i,      // ABC1D23 (Mercosul)
          /[A-Z]{3}[0-9]{2}[A-Z][0-9]/i,      // ABC12D3 (Mercosul variação)
          /[A-Z]{3}[0-9]{4}/i,                // ABC1234 (sem hífen)
        ];

        console.log(`🔍 OCR detectou ${textResult.textAnnotations.length} anotações de texto`);

        // Primeira anotação contém todo o texto detectado, mas vamos verificar ela também
        for (let i = 0; i < textResult.textAnnotations.length; i++) {
          const annotation = textResult.textAnnotations[i];
          const text = annotation.description?.trim() || "";
          
          // Log para debug
          if (i === 0) {
            console.log(`📝 Texto completo detectado: "${text.substring(0, 200)}..."`);
          }

          // Verificar se o texto corresponde a alguma placa (pode estar no meio de outro texto)
          for (const pattern of platePatterns) {
            const matches = text.match(pattern);
            if (matches) {
              console.log(`✅ Placa detectada via OCR: "${matches[0]}" no texto: "${text.substring(0, 50)}"`);
              
              const vertices = annotation.boundingPoly?.vertices;
              if (vertices && vertices.length >= 2) {
                // Calcular coordenadas e dimensões usando todos os vértices disponíveis
                const xs = vertices.map(v => v.x || 0).filter(x => x > 0);
                const ys = vertices.map(v => v.y || 0).filter(y => y > 0);
                
                if (xs.length === 0 || ys.length === 0) continue;
                
                const x = Math.min(...xs);
                const y = Math.min(...ys);
                const x2 = Math.max(...xs);
                const y2 = Math.max(...ys);
                const width = x2 - x;
                const height = y2 - y;

                // Expansão mínima apenas para garantir que capture toda a placa
                // Margens pequenas e proporcionais - altura reduzida
                const expandX = Math.max(3, width * 0.05); // 5% de expansão ou mínimo 3px (largura mantida)
                const expandY = Math.max(1, height * 0.03); // 3% de expansão ou mínimo 1px (altura reduzida)
                
                plates.push({
                  x: Math.max(0, x - expandX),
                  y: Math.max(0, y - expandY),
                  width: Math.min(width + (expandX * 2), imgWidth - Math.max(0, x - expandX)),
                  height: Math.min(height + (expandY * 2), imgHeight - Math.max(0, y - expandY)),
                  text: matches[0], // Para debug
                });
                
                console.log(`📍 Placa OCR: "${matches[0]}" em (${x}, ${y}) - Região expandida: (${x - expandX}, ${y - expandY}) ${width + (expandX * 2)}x${height + (expandY * 2)}`);
              }
              break; // Se encontrou uma placa, não precisa verificar outros padrões
            }
          }
        }
      } else {
        console.log("⚠️ OCR não detectou nenhum texto na imagem");
      }
    } catch (textError) {
      console.warn("⚠️ Erro na detecção de texto de placas:", textError.message);
    }

    // Método 2: Usar detecção de objetos para encontrar retângulos que possam ser placas
    // Placas geralmente têm formato retangular horizontal
    try {
      const [objectResult] = await client.objectLocalization({
        image: { content: imageBuffer },
      });

      if (objectResult.localizedObjectAnnotations) {
        console.log(`🚗 Detecção de objetos encontrou ${objectResult.localizedObjectAnnotations.length} objetos`);
        
        for (const obj of objectResult.localizedObjectAnnotations) {
          // Procurar objetos que possam ser placas (carros, veículos, etc)
          const vehicleRelated = ['Vehicle', 'Car', 'Truck', 'Motorcycle', 'Bus'].includes(obj.name);
          
          if (vehicleRelated && obj.boundingPoly) {
            console.log(`🚗 Veículo detectado: ${obj.name} (score: ${obj.score})`);
            
            const normalizedVertices = obj.boundingPoly.normalizedVertices;
            const vertices = obj.boundingPoly.vertices;
            
            if ((normalizedVertices && normalizedVertices.length >= 2) || (vertices && vertices.length >= 2)) {
              let x, y, x2, y2;
              
              // Verificar se são coordenadas normalizadas (0-1) ou absolutas
              if (normalizedVertices && normalizedVertices.length > 0) {
                // Coordenadas normalizadas - converter para absolutas
                x = (normalizedVertices[0]?.x || 0) * imgWidth;
                y = (normalizedVertices[0]?.y || 0) * imgHeight;
                x2 = (normalizedVertices[2]?.x || 1) * imgWidth;
                y2 = (normalizedVertices[2]?.y || 1) * imgHeight;
              } else if (vertices && vertices.length > 0) {
                // Coordenadas absolutas
                x = vertices[0]?.x || 0;
                y = vertices[0]?.y || 0;
                x2 = vertices[2]?.x || imgWidth;
                y2 = vertices[2]?.y || imgHeight;
              } else {
                continue; // Pular se não tiver coordenadas válidas
              }
              
              const width = x2 - x;
              const height = y2 - y;
              
              // Se for um objeto de veículo, adicionar uma região na parte inferior (onde geralmente ficam as placas)
              // A placa geralmente fica na parte inferior do veículo
              // Altura reduzida, largura mantida
              const plateRegionHeight = height * 0.08; // 8% da altura do veículo (altura reduzida)
              const plateY = y + height - plateRegionHeight;
              
              // Largura mantida - focar no centro onde geralmente está a placa
              const plateRegionWidth = width * 0.6; // 60% da largura do veículo (centro) - largura mantida
              const plateX = x + (width * 0.2); // 20% de margem de cada lado
              
              console.log(`📍 Região de placa estimada para ${obj.name}: x=${plateX}, y=${plateY}, width=${plateRegionWidth}, height=${plateRegionHeight}`);
              
              plates.push({
                x: Math.max(0, plateX),
                y: Math.max(0, plateY),
                width: Math.min(plateRegionWidth, imgWidth - plateX),
                height: Math.min(plateRegionHeight, imgHeight - plateY),
                text: `Vehicle: ${obj.name}`, // Para debug
              });
            }
          }
        }
      } else {
        console.log("⚠️ Detecção de objetos não encontrou nenhum objeto");
      }
    } catch (objectError) {
      console.warn("⚠️ Erro na detecção de objetos para placas:", objectError.message);
    }

    // Remover duplicatas (placas muito próximas)
    const uniquePlates = [];
    for (const plate of plates) {
      const isDuplicate = uniquePlates.some(existing => {
        const distance = Math.sqrt(
          Math.pow(existing.x - plate.x, 2) + Math.pow(existing.y - plate.y, 2)
        );
        // Se estiver a menos de 100px, considerar duplicata (aumentado de 50px)
        return distance < 100;
      });
      
      if (!isDuplicate) {
        uniquePlates.push(plate);
        console.log(`✅ Placa única adicionada: "${plate.text}" em (${plate.x}, ${plate.y})`);
      } else {
        console.log(`⚠️ Placa duplicada ignorada: "${plate.text}"`);
      }
    }

    console.log(`🚗 Total: ${uniquePlates.length} placas únicas detectadas (${plates.length} antes de remover duplicatas)`);
    return uniquePlates;
  } catch (error) {
    console.error("❌ Erro ao detectar placas:", error.message);
    return [];
  }
}


/**
 * Processa imagem aplicando blur em rostos e placas detectados
 */
async function anonymizeImage(imageUrl) {
  try {
    console.log("🖼️ Iniciando processamento de imagem:", imageUrl);
    
    // Baixar imagem da URL
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 segundos
    });
    
    let imageBuffer = Buffer.from(response.data);
    
    // Detectar rostos e placas
    const faces = await detectFaces(imageBuffer);
    const licensePlates = await detectLicensePlates(imageBuffer);
    
    console.log(`🔍 Detectados ${faces.length} rostos e ${licensePlates.length} placas`);
    
    // Preparar todas as regiões para blur
    const regionsToBlur = [];
    
    // Expandir e adicionar regiões de rostos (com mais margem e blur mais forte)
    for (const face of faces) {
      regionsToBlur.push({
        x: Math.max(0, face.x - 20),
        y: Math.max(0, face.y - 20),
        width: face.width + 40,
        height: face.height + 40,
        blurRadius: 40, // Aumentado de 20 para 40
      });
    }
    
    // Expandir e adicionar regiões de placas (margens menores e mais precisas)
    for (const plate of licensePlates) {
      // Margens menores e proporcionais - altura reduzida, largura mantida
      const marginX = Math.max(5, plate.width * 0.10); // 10% da largura ou mínimo 5px (largura mantida)
      const marginY = Math.max(2, plate.height * 0.05); // 5% da altura ou mínimo 2px (altura reduzida)
      
      const blurX = Math.max(0, plate.x - marginX);
      const blurY = Math.max(0, plate.y - marginY);
      const blurWidth = plate.width + (marginX * 2);
      const blurHeight = plate.height + (marginY * 2);
      
      regionsToBlur.push({
        x: blurX,
        y: blurY,
        width: blurWidth,
        height: blurHeight,
        blurRadius: 40, // Blur forte mas com área menor
      });
      
      console.log(`🎯 Placa "${plate.text}" - Região de blur precisa: x=${blurX}, y=${blurY}, w=${blurWidth}, h=${blurHeight}, margens: ${marginX}x${marginY}`);
    }
    
    // Aplicar blur em todas as regiões de uma vez
    if (regionsToBlur.length > 0) {
      // Preparar todas as regiões para composição (usar imagem original como base)
      const originalBuffer = imageBuffer;
      const composites = [];
      
      for (const region of regionsToBlur) {
        const { x, y, width, height, blurRadius } = region;
        const metadata = await sharp(originalBuffer).metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;
        
        // Arredondar para inteiros (Sharp requer valores inteiros)
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const regionWidth = Math.min(Math.round(width), imgWidth - left);
        const regionHeight = Math.min(Math.round(height), imgHeight - top);
        
        // Garantir que as dimensões são válidas
        if (regionWidth > 0 && regionHeight > 0 && left < imgWidth && top < imgHeight) {
          try {
            const blurredRegion = await sharp(originalBuffer)
              .extract({ 
                left: Math.floor(left), 
                top: Math.floor(top), 
                width: Math.floor(regionWidth), 
                height: Math.floor(regionHeight) 
              })
              .blur(blurRadius)
              .toBuffer();
            
            composites.push({
              input: blurredRegion,
              left: Math.floor(left),
              top: Math.floor(top),
            });
            
            console.log(`✅ Blur aplicado em região: (${Math.floor(left)}, ${Math.floor(top)}) ${Math.floor(regionWidth)}x${Math.floor(regionHeight)}`);
          } catch (extractError) {
            console.warn(`⚠️ Erro ao extrair região (${left}, ${top}, ${regionWidth}, ${regionHeight}):`, extractError.message);
          }
        } else {
          console.warn(`⚠️ Região inválida ignorada: (${left}, ${top}, ${regionWidth}, ${regionHeight})`);
        }
      }
      
      if (composites.length > 0) {
        imageBuffer = await sharp(originalBuffer)
          .composite(composites)
          .jpeg({ quality: 90 })
          .toBuffer();
        console.log(`✅ ${composites.length} regiões com blur aplicadas com sucesso`);
      }
    }
    
    // Se não detectou nada, retornar imagem original
    if (faces.length === 0 && licensePlates.length === 0) {
      console.log("ℹ️ Nenhuma região sensível detectada, retornando imagem original");
      return imageBuffer;
    }
    
    console.log("✅ Imagem processada com sucesso");
    return imageBuffer;
  } catch (error) {
    console.error("❌ Erro ao processar imagem:", error);
    // Em caso de erro, retornar null para usar imagem original
    throw error;
  }
}

/**
 * Faz upload da imagem processada para Cloudinary
 */
async function uploadProcessedImage(imageBuffer, originalUrl) {
  try {
    // Se Cloudinary não estiver configurado, retornar null
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn("⚠️ Cloudinary não configurado, pulando upload");
      return null;
    }
    
    const cloudinary = require("cloudinary").v2;
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    
    // Upload da imagem processada
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "reports/anonymized",
            resource_type: "image",
            format: "jpg",
            quality: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(imageBuffer);
    });
    
    console.log("✅ Imagem processada enviada para Cloudinary:", uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("❌ Erro ao fazer upload da imagem processada:", error);
    throw error;
  }
}

/**
 * Processa imagem e retorna URL da versão anonimizada
 * Se o processamento falhar, retorna a URL original
 */
async function processAndUploadImage(imageUrl) {
  try {
    // Processar imagem (aplicar blur)
    const processedBuffer = await anonymizeImage(imageUrl);
    
    // Fazer upload da versão processada
    const processedUrl = await uploadProcessedImage(processedBuffer, imageUrl);
    
    // Se upload falhou, retornar original
    if (!processedUrl) {
      console.warn("⚠️ Upload falhou, usando imagem original");
      return imageUrl;
    }
    
    return processedUrl;
  } catch (error) {
    console.error("❌ Erro no processamento completo, usando imagem original:", error.message);
    // Em caso de erro, retornar imagem original para não quebrar o fluxo
    return imageUrl;
  }
}

module.exports = {
  anonymizeImage,
  processAndUploadImage,
  detectFaces,
  detectLicensePlates,
};

