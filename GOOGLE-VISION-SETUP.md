# 🔧 Configuração do Google Cloud Vision

## ✅ Arquivo JSON Recebido

Você já tem o arquivo de credenciais:
- `famous-biplane-449619-i1-9c25018064b1.json`

## 📋 Próximos Passos

### Opção 1: Desenvolvimento Local (Recomendado)

1. **Mover o arquivo JSON para o projeto:**
   ```bash
   # Mova o arquivo para a pasta do backend
   # Exemplo: ArrumaAi-Backend/config/google-vision-credentials.json
   ```

2. **Adicionar ao `.env.development`:**
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./config/google-vision-credentials.json
   ```

3. **Criar pasta `config` (se não existir):**
   ```bash
   mkdir config
   ```

4. **Mover o arquivo:**
   ```bash
   # Copie o arquivo JSON para: ArrumaAi-Backend/config/
   ```

### Opção 2: Produção (Railway)

Para produção, você tem 2 opções:

#### Opção A: Variável de Ambiente JSON (Recomendado)

1. **Copiar todo o conteúdo do JSON**
2. **No Railway, criar variável:**
   ```
   GOOGLE_CLOUD_CREDENTIALS={"type":"service_account","project_id":"famous-biplane-449619-i1",...}
   ```
   (Cole o JSON completo como uma única linha)

#### Opção B: Upload do Arquivo

1. Adicionar arquivo ao projeto (não recomendado por segurança)
2. Usar `GOOGLE_APPLICATION_CREDENTIALS` apontando para o arquivo

## 🔒 Segurança

- ✅ **NÃO** commite o arquivo JSON no Git (já está no `.gitignore`)
- ✅ Use variáveis de ambiente em produção
- ✅ Mantenha o arquivo local seguro

## 🧪 Testar

Após configurar, teste criando um report com imagem:

1. Ativar processamento:
   ```env
   ENABLE_IMAGE_ANONYMIZATION=true
   ```

2. Criar um report com imagem contendo rostos ou placas

3. Verificar logs:
   ```
   ✅ Google Cloud Vision client inicializado
   👤 Detectados 2 rostos
   🚗 Detectadas 1 placas
   🔒 Processando imagem para compliance LGPD...
   ✅ Imagem processada: https://res.cloudinary.com/...
   ```

## ⚠️ Importante

- O arquivo JSON contém credenciais sensíveis
- Mantenha seguro e não compartilhe
- Se comprometido, revogue imediatamente no Google Cloud Console

## 📝 Estrutura Recomendada

```
ArrumaAi-Backend/
├── config/
│   └── google-vision-credentials.json  (local apenas)
├── .env.development                    (com GOOGLE_APPLICATION_CREDENTIALS)
└── .gitignore                          (já ignora arquivos JSON)
```


