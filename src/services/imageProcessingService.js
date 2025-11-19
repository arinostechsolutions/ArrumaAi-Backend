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
 */
async function detectLicensePlates(imageBuffer) {
  try {
    const client = getVisionClient();
    if (!client) {
      return [];
    }

    // Usar detecção de texto (OCR)
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });

    if (!result.textAnnotations || result.textAnnotations.length === 0) {
      return [];
    }

    // Padrões de placas brasileiras (antiga: ABC-1234, nova: ABC1D23)
    const platePattern = /[A-Z]{3}[- ]?[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2}/i;

    // Obter dimensões da imagem
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    const plates = [];

    // Primeira anotação contém todo o texto detectado, pular ela
    for (let i = 1; i < result.textAnnotations.length; i++) {
      const annotation = result.textAnnotations[i];
      const text = annotation.description?.trim() || "";

      // Verificar se o texto corresponde a uma placa
      if (platePattern.test(text)) {
        const vertices = annotation.boundingPoly.vertices;

        // Calcular coordenadas e dimensões
        const x = vertices[0]?.x || 0;
        const y = vertices[0]?.y || 0;
        const width = (vertices[2]?.x || imgWidth) - x;
        const height = (vertices[2]?.y || imgHeight) - y;

        plates.push({
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(width, imgWidth - x),
          height: Math.min(height, imgHeight - y),
          text: text, // Para debug
        });
      }
    }

    console.log(`🚗 Detectadas ${plates.length} placas`);
    return plates;
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
    
    // Expandir e adicionar regiões de rostos
    for (const face of faces) {
      regionsToBlur.push({
        x: Math.max(0, face.x - 10),
        y: Math.max(0, face.y - 10),
        width: face.width + 20,
        height: face.height + 20,
        blurRadius: 20,
      });
    }
    
    // Expandir e adicionar regiões de placas
    for (const plate of licensePlates) {
      regionsToBlur.push({
        x: Math.max(0, plate.x - 5),
        y: Math.max(0, plate.y - 5),
        width: plate.width + 10,
        height: plate.height + 10,
        blurRadius: 15,
      });
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
        
        const left = Math.max(0, x);
        const top = Math.max(0, y);
        const regionWidth = Math.min(width, imgWidth - left);
        const regionHeight = Math.min(height, imgHeight - top);
        
        if (regionWidth > 0 && regionHeight > 0) {
          const blurredRegion = await sharp(originalBuffer)
            .extract({ left, top, width: regionWidth, height: regionHeight })
            .blur(blurRadius)
            .toBuffer();
          
          composites.push({
            input: blurredRegion,
            left,
            top,
          });
        }
      }
      
      if (composites.length > 0) {
        imageBuffer = await sharp(originalBuffer)
          .composite(composites)
          .jpeg({ quality: 90 })
          .toBuffer();
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

