# 🔐 Configuração de Administrador - ResolveAí

## Como tornar um usuário Admin

### Método 1: Via MongoDB Compass (Recomendado)

1. Abra o MongoDB Compass
2. Conecte ao seu cluster MongoDB Atlas
3. Navegue até: `resolveai-dev` (ou `resolveai-prod`) → `users`
4. Encontre o usuário pelo CPF ou nome
5. Clique em "Edit Document"
6. Adicione/altere o campo:
   ```json
   "isAdmin": true
   ```
7. Clique em "Update"

---

### Método 2: Via MongoDB Shell

```javascript
// Conecte ao MongoDB
mongo "mongodb+srv://seu-cluster.mongodb.net/resolveai-dev"

// Torne um usuário admin pelo CPF
db.users.updateOne(
  { cpf: "12345678900" },
  { $set: { isAdmin: true } }
)

// Verificar se funcionou
db.users.findOne({ cpf: "12345678900" }, { name: 1, cpf: 1, isAdmin: 1 })
```

---

### Método 3: Via Insomnia/Postman (Temporário)

**⚠️ ATENÇÃO: Este método requer que você já seja admin ou tenha acesso direto ao banco**

```http
PATCH http://localhost:3000/api/user/updateUser/12345678900
Content-Type: application/json

{
  "isAdmin": true
}
```

**Nota:** Este endpoint não verifica permissões admin por padrão, então use com cuidado.

---

## Funcionalidades Admin

Quando `isAdmin: true`, o usuário terá acesso a:

### 📊 Estatísticas Gerais
- Total de usuários
- Total de denúncias
- Total de denúncias de conteúdo (pendentes)
- Total de cidades
- Engajamento total (likes, views, shares)

### 🚨 Gerenciar Denúncias de Conteúdo
- Ver todas as denúncias pendentes
- Deletar posts denunciados
- Marcar denúncias como improcedentes

### 👥 Gerenciar Usuários
- Banir usuários (deleta o usuário e suas atividades)
- Ver usuários recentes

### 📋 Gerenciar Posts
- Ver denúncias recentes
- Deletar posts específicos

---

## Endpoints Admin

Todos os endpoints admin exigem `adminUserId` como parâmetro (query ou body).

### 📊 Estatísticas
```http
GET /api/admin/stats?adminUserId=USER_ID_HERE
```

### 🚨 Denúncias Pendentes
```http
GET /api/admin/content-reports/pending?adminUserId=USER_ID_HERE&page=1&limit=20
```

### 🗑️ Deletar Post
```http
DELETE /api/admin/report/REPORT_ID_HERE?adminUserId=USER_ID_HERE
Content-Type: application/json

{
  "adminUserId": "USER_ID_HERE",
  "reason": "Conteúdo impróprio"
}
```

### 🚫 Banir Usuário
```http
POST /api/admin/user/USER_ID_HERE/ban?adminUserId=USER_ID_HERE
Content-Type: application/json

{
  "adminUserId": "USER_ID_HERE",
  "reason": "Violação repetida dos termos"
}
```

### ✅ Resolver Denúncia
```http
PATCH /api/admin/content-report/CONTENT_REPORT_ID_HERE/resolve?adminUserId=USER_ID_HERE
Content-Type: application/json

{
  "adminUserId": "USER_ID_HERE",
  "action": "nenhuma",
  "moderatorNotes": "Denúncia improcedente."
}
```

---

## Segurança

### ⚠️ Importante:
1. **Nunca** torne admin um usuário desconhecido
2. **Sempre** use HTTPS em produção
3. **Não** compartilhe credenciais admin
4. **Revise** regularmente a lista de admins

### Revogar acesso admin:
```javascript
db.users.updateOne(
  { cpf: "12345678900" },
  { $set: { isAdmin: false } }
)
```

---

## Testando

### 1. Torne-se admin via MongoDB
```javascript
db.users.updateOne(
  { cpf: "SEU_CPF" },
  { $set: { isAdmin: true } }
)
```

### 2. Faça logout e login novamente no app

### 3. Verifique se o botão "🔐 Painel Admin" aparece no perfil

### 4. Acesse o painel e teste as funcionalidades

---

## Troubleshooting

### "Acesso Negado" no app:
- Verifique se `isAdmin: true` está salvo no banco
- Faça logout e login novamente
- Verifique se o `userId` está sendo enviado corretamente

### Endpoints retornam 403:
- Confirme que o `adminUserId` está sendo passado
- Verifique se o usuário existe e `isAdmin: true`
- Revise os logs do backend

---

**Última atualização:** 06/11/2024
**Versão:** 1.0.0

