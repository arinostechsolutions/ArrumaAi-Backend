# 📸 API de Posts Positivos - Feed da Prefeitura

API para gerenciar posts positivos da prefeitura (obras finalizadas, melhorias, eventos, etc.) que aparecem em um feed paralelo no app mobile.

## 🔐 Autenticação

- **Criar/Editar/Deletar**: Requer autenticação de admin (`isAdmin` middleware)
- **Visualizar feed**: Público (não requer autenticação)

## 📋 Endpoints Disponíveis

### 1. Criar Post Positivo
```
POST /api/positive-posts/create
Authorization: Bearer {admin_token}
```

**Body:**
```json
{
  "title": "Nova Praça Inaugurada",
  "description": "A prefeitura inaugurou uma nova praça no centro da cidade com área de lazer e playground.",
  "images": [
    "https://res.cloudinary.com/durusveju/image/upload/v1234567890/praca1.jpg",
    "https://res.cloudinary.com/durusveju/image/upload/v1234567890/praca2.jpg"
  ],
  "eventDate": "2024-11-15T10:00:00Z",
  "location": {
    "address": "Praça Central, Centro - São Paulo, SP",
    "bairro": "Centro",
    "rua": "Praça Central",
    "referencia": "Próximo à prefeitura",
    "coordinates": {
      "lat": -23.5505,
      "lng": -46.6333
    }
  },
  "city": {
    "id": "sao-paulo-sp",
    "label": "São Paulo-SP"
  },
  "category": "obra_finalizada",
  "status": "publicado"
}
```

**Categorias disponíveis:**
- `obra_finalizada`
- `melhoria_urbana`
- `evento_cultural`
- `servico_publico`
- `infraestrutura`
- `outro`

**Status disponíveis:**
- `rascunho` - Não aparece no feed público
- `publicado` - Aparece no feed público
- `arquivado` - Não aparece mais no feed

---

### 2. Feed Público de Posts Positivos
```
GET /api/positive-posts/feed/:cityId?page=1&limit=20&status=publicado&category=obra_finalizada
```

**Parâmetros de Query:**
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 20, máximo: 100)
- `status` (opcional): Filtrar por status (padrão: "publicado")
- `category` (opcional): Filtrar por categoria

**Resposta:**
```json
{
  "cityId": "sao-paulo-sp",
  "page": 1,
  "limit": 20,
  "total": 45,
  "totalPages": 3,
  "posts": [
    {
      "_id": "...",
      "title": "Nova Praça Inaugurada",
      "description": "...",
      "images": [
        { "url": "...", "order": 0 }
      ],
      "eventDate": "2024-11-15T10:00:00.000Z",
      "location": {
        "address": "...",
        "lat": -23.5505,
        "lng": -46.6333
      },
      "category": "obra_finalizada",
      "likesCount": 25,
      "viewsCount": 150,
      "sharesCount": 8,
      "createdAt": "2024-11-15T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Buscar Post por ID
```
GET /api/positive-posts/:id
```

**Resposta:**
```json
{
  "_id": "...",
  "title": "Nova Praça Inaugurada",
  "description": "...",
  "images": [...],
  "eventDate": "...",
  "location": {
    "address": "...",
    "lat": -23.5505,
    "lng": -46.6333,
    "bairro": "Centro",
    "rua": "Praça Central",
    "referencia": "..."
  },
  "category": "obra_finalizada",
  "status": "publicado",
  "createdBy": {
    "adminId": {...},
    "adminName": "João Admin",
    "secretaria": "Obras"
  },
  "likesCount": 25,
  "viewsCount": 150,
  "sharesCount": 8,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### 4. Atualizar Post Positivo
```
PUT /api/positive-posts/:id
Authorization: Bearer {admin_token}
```

**Body:** (todos os campos são opcionais)
```json
{
  "title": "Título atualizado",
  "description": "Descrição atualizada",
  "images": ["nova_url1.jpg", "nova_url2.jpg"],
  "eventDate": "2024-11-20T10:00:00Z",
  "location": {
    "address": "Novo endereço",
    "coordinates": {
      "lat": -23.5505,
      "lng": -46.6333
    }
  },
  "category": "melhoria_urbana",
  "status": "publicado"
}
```

**Permissões:**
- Apenas o criador do post ou super admin pode editar

---

### 5. Deletar Post Positivo
```
DELETE /api/positive-posts/:id
Authorization: Bearer {admin_token}
```

**Permissões:**
- Apenas o criador do post ou super admin pode deletar

---

### 6. Listar Posts por Cidade (Admin)
```
GET /api/positive-posts/city/:cityId?page=1&limit=20&status=publicado&category=obra_finalizada
Authorization: Bearer {admin_token}
```

**Parâmetros de Query:**
- `page`, `limit`, `status`, `category` (opcionais)

---

### 7. Buscar Posts Próximos (Por Localização)
```
GET /api/positive-posts/nearby?lat=-23.5505&lng=-46.6333&radius=5000&cityId=sao-paulo-sp&limit=20
```

**Parâmetros de Query:**
- `lat` (obrigatório): Latitude
- `lng` (obrigatório): Longitude
- `radius` (opcional): Raio em metros (padrão: 5000m = 5km)
- `cityId` (opcional): Filtrar por cidade
- `limit` (opcional): Máximo de resultados (padrão: 20, máximo: 100)

**Resposta:**
```json
{
  "center": { "lat": -23.5505, "lng": -46.6333 },
  "radius": 5000,
  "total": 3,
  "posts": [...]
}
```

---

## 📊 Estrutura do Modelo

### Campos Principais:
- `title`: Título do post (máx 200 caracteres)
- `description`: Descrição detalhada (máx 2000 caracteres)
- `images`: Array de imagens (URL + ordem)
- `eventDate`: Data do evento/obra
- `location`: Endereço + coordenadas (opcional)
- `city`: Cidade associada
- `category`: Categoria do post
- `status`: Status de publicação
- `createdBy`: Admin que criou
- `likes`, `views`, `shares`: Métricas de engajamento
- `engagementScore`: Score calculado

### Índices:
- Por cidade + status + data
- Por status + data
- Por categoria + status
- Geoespacial (para busca por proximidade)
- Por score de engajamento

---

## 🔄 Integração com Feed de Sugestões de Melhorias

Os posts positivos são **separados** do feed de sugestões de melhorias:
- Feed de sugestões de melhorias: `/api/feed/city/:cityId`
- Feed positivo: `/api/positive-posts/feed/:cityId`

No app mobile, você pode ter duas abas:
1. **Sugestões de Melhorias** - Feed de problemas reportados
2. **Boas Notícias** - Feed de posts positivos da prefeitura

---

## 🧪 Exemplo de Uso

### Criar um post positivo:
```bash
curl -X POST http://localhost:3000/api/positive-posts/create \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nova Praça Inaugurada",
    "description": "A prefeitura inaugurou uma nova praça...",
    "images": ["https://example.com/praca.jpg"],
    "eventDate": "2024-11-15T10:00:00Z",
    "location": {
      "address": "Praça Central, Centro - São Paulo, SP",
      "coordinates": { "lat": -23.5505, "lng": -46.6333 }
    },
    "city": {
      "id": "sao-paulo-sp",
      "label": "São Paulo-SP"
    },
    "category": "obra_finalizada",
    "status": "publicado"
  }'
```

### Buscar feed público:
```bash
curl http://localhost:3000/api/positive-posts/feed/sao-paulo-sp?page=1&limit=20
```

---

## ✅ Status

- ✅ Modelo criado
- ✅ Controller com CRUD completo
- ✅ Rotas protegidas para admin
- ✅ Feed público disponível
- ✅ Busca por localização
- ✅ Métricas de engajamento (likes, views, shares)
- ✅ Suporte a múltiplas imagens
- ✅ Categorias e status

Pronto para uso! 🚀

