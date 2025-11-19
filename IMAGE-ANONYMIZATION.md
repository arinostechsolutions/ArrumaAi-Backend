# 🔒 Sistema de Anonimização de Imagens (LGPD Compliance)

Este sistema aplica blur automático em rostos e placas de veículos nas imagens dos reports para garantir compliance com a LGPD e evitar processos judiciais.

## 📋 Funcionalidades

- ✅ Detecção automática de rostos
- ✅ Detecção automática de placas de veículos
- ✅ Aplicação de blur gaussiano nas regiões detectadas
- ✅ Upload automático da imagem processada para Cloudinary
- ✅ Fallback seguro: usa imagem original se processamento falhar

## 🚀 Como Ativar

### 1. Configurar Variáveis de Ambiente

Adicione no seu `.env` ou variáveis de ambiente:

```env
# Ativar processamento de imagem
ENABLE_IMAGE_ANONYMIZATION=true

# Cloudinary (obrigatório se ativar anonimização)
CLOUDINARY_CLOUD_NAME=seu-cloud-name
CLOUDINARY_API_KEY=sua-api-key
CLOUDINARY_API_SECRET=seu-api-secret

# APIs de Detecção (opcional - para melhor precisão)
FACE_DETECTION_API_URL=https://sua-api-de-deteccao.com/detect
OCR_API_URL=https://sua-api-ocr.com/detect
```

### 2. Como Funciona

Quando `ENABLE_IMAGE_ANONYMIZATION=true`:

1. **Upload de imagem**: Usuário envia imagem no app mobile
2. **Processamento automático**: Backend detecta rostos e placas
3. **Aplicação de blur**: Blur gaussiano é aplicado nas regiões detectadas
4. **Upload processado**: Imagem processada é enviada para Cloudinary
5. **Salvamento**: URL da imagem processada é salva no banco

Se o processamento falhar por qualquer motivo, a imagem original é usada (fallback seguro).

## 🔧 Integração com APIs de Detecção

### Opção 1: AWS Rekognition (Recomendado)

```javascript
// Em imageProcessingService.js, função detectFaces:

const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function detectFaces(imageBuffer) {
  const params = {
    Image: { Bytes: imageBuffer },
    Attributes: ['ALL']
  };
  
  const result = await rekognition.detectFaces(params).promise();
  
  return result.FaceDetails.map(face => ({
    x: face.BoundingBox.Left * metadata.width,
    y: face.BoundingBox.Top * metadata.height,
    width: face.BoundingBox.Width * metadata.width,
    height: face.BoundingBox.Height * metadata.height,
  }));
}
```

### Opção 2: Google Cloud Vision API

```javascript
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

async function detectFaces(imageBuffer) {
  const [result] = await client.faceDetection({
    image: { content: imageBuffer }
  });
  
  return result.faceAnnotations.map(face => ({
    x: face.boundingPoly.vertices[0].x,
    y: face.boundingPoly.vertices[0].y,
    width: face.boundingPoly.vertices[2].x - face.boundingPoly.vertices[0].x,
    height: face.boundingPoly.vertices[2].y - face.boundingPoly.vertices[0].y,
  }));
}
```

### Opção 3: Azure Computer Vision

```javascript
const ComputerVisionClient = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');

const credentials = new CognitiveServicesCredentials(process.env.AZURE_KEY);
const client = new ComputerVisionClient(credentials, process.env.AZURE_ENDPOINT);

async function detectFaces(imageBuffer) {
  const result = await client.detectFacesInStream(imageBuffer);
  
  return result.map(face => ({
    x: face.faceRectangle.left,
    y: face.faceRectangle.top,
    width: face.faceRectangle.width,
    height: face.faceRectangle.height,
  }));
}
```

### Opção 4: Tesseract.js (OCR para Placas)

```javascript
const Tesseract = require('tesseract.js');

async function detectLicensePlates(imageBuffer) {
  const { data } = await Tesseract.recognize(imageBuffer, 'por', {
    logger: m => console.log(m)
  });
  
  // Procurar padrões de placas brasileiras (ABC-1234 ou ABC1D23)
  const platePattern = /[A-Z]{3}[- ]?[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2}/g;
  const matches = data.text.match(platePattern);
  
  // Retornar regiões onde placas foram encontradas
  // (precisa mapear coordenadas do OCR)
  return data.words
    .filter(word => platePattern.test(word.text))
    .map(word => ({
      x: word.bbox.x0,
      y: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0,
      height: word.bbox.y1 - word.bbox.y0,
    }));
}
```

## 📊 Status Atual

### ✅ Implementado

- Estrutura base do serviço de processamento
- Integração no fluxo de criação de reports
- Aplicação de blur usando Sharp
- Upload para Cloudinary
- Fallback seguro em caso de erro

### 🚧 Pendente (Configuração)

- Integração com API de detecção facial (AWS/GCP/Azure)
- Integração com OCR para detecção de placas
- Testes com imagens reais

## ⚙️ Configuração Recomendada para Produção

1. **Usar AWS Rekognition** ou **Google Cloud Vision** para detecção facial
2. **Usar Tesseract.js** ou **Google Cloud Vision OCR** para placas
3. **Configurar Cloudinary** para armazenamento otimizado
4. **Monitorar logs** para verificar taxa de detecção
5. **Ajustar blur radius** conforme necessário (atualmente 20 para rostos, 15 para placas)

## 🔍 Debugging

Para ver logs detalhados do processamento:

```bash
# No terminal do servidor, você verá:
🔒 Processando imagem para compliance LGPD...
🔍 Detectados 2 rostos e 1 placas
✅ Imagem processada: https://res.cloudinary.com/...
```

## ⚠️ Importante

- O sistema está **desativado por padrão** (`ENABLE_IMAGE_ANONYMIZATION=false`)
- Ative apenas quando tiver APIs de detecção configuradas
- Sem APIs configuradas, nenhum blur será aplicado (mas não quebra o sistema)
- Sempre teste em ambiente de desenvolvimento antes de produção

## 📝 Notas Legais

Este sistema ajuda a garantir compliance com a LGPD ao anonimizar dados pessoais visíveis em imagens públicas. No entanto:

- ⚠️ Não substitui revisão legal profissional
- ⚠️ Pode não detectar todos os rostos/placas (depende da API usada)
- ⚠️ Considere adicionar aviso ao usuário sobre processamento de imagens
- ⚠️ Mantenha logs de processamento para auditoria


