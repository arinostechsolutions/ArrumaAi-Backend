# Conformidade com LGPD - ResolveAi

## ✅ Implementação de Privacidade e Proteção de Dados

### Dados Coletados

O ResolveAi coleta e armazena os seguintes dados pessoais:

| Dado | Tipo | Finalidade | Base Legal (LGPD) |
|------|------|------------|-------------------|
| CPF | Identificação única | Identificação do cidadão nas solicitações | Art. 7º, I - Consentimento |
| Nome completo | Dado pessoal | Identificação e comunicação | Art. 7º, I - Consentimento |
| Data de nascimento | Dado pessoal | Identificação e validação | Art. 7º, I - Consentimento |
| Telefone | Dado de contato | Comunicação sobre solicitações | Art. 7º, I - Consentimento |
| E-mail (opcional) | Dado de contato | Comunicação alternativa | Art. 7º, I - Consentimento |
| Endereço (bairro) | Dado pessoal | Sugestão de serviços próximos | Art. 7º, I - Consentimento |
| Endereço (rua, número, complemento) | Dado pessoal sensível | Localização para atendimento | Art. 7º, I - Consentimento |

### Finalidades do Tratamento

Os dados coletados são utilizados **exclusivamente** para:

1. **Identificação do cidadão** nas denúncias e solicitações
2. **Contato sobre o andamento** das solicitações enviadas
3. **Sugestão de serviços próximos** baseada no bairro do usuário
4. **Gestão de serviços municipais** (agendamentos de saúde, consultas, etc.)
5. **Histórico de solicitações** do usuário
6. **Localização geográfica** para otimização do atendimento

### Consentimento (Art. 8º LGPD)

✅ **Implementado no cadastro:**
- Checkbox obrigatório de aceite dos termos
- Link para Política de Privacidade completa
- Informação clara sobre quais dados são coletados
- Mensagem "🔒 Seus dados estão protegidos conforme a LGPD"

**Armazenamento do consentimento:**
```javascript
lgpdConsent: {
  accepted: true,
  acceptedAt: Date,
  ipAddress: String
}
```

### Direitos dos Titulares (Art. 18 LGPD)

O usuário tem direito a:

1. **Confirmação da existência de tratamento** ✅
2. **Acesso aos dados** ✅ (implementado via consulta de CPF)
3. **Correção de dados incompletos** ✅ (via `updateUser`)
4. **Anonimização, bloqueio ou eliminação** ✅ (via `deleteUser`)
5. **Portabilidade dos dados** 🔄 (a implementar)
6. **Eliminação dos dados tratados com consentimento** ✅
7. **Informação sobre compartilhamento** ✅ (não compartilhamos)
8. **Revogação do consentimento** ✅ (via `deleteUser`)

### Segurança dos Dados (Art. 46 LGPD)

🔒 **Medidas de segurança implementadas:**

1. **Armazenamento seguro**: MongoDB Atlas com criptografia em trânsito (TLS) e em repouso
2. **Acesso controlado**: Apenas sistemas autorizados têm acesso ao banco
3. **HTTPS**: Todas as comunicações são criptografadas
4. **CORS**: Configurado para aceitar apenas origens autorizadas
5. **Rate Limiting**: Proteção contra abuso e tentativas de ataque
6. **Logs**: Registro de acessos para auditoria

### Retenção de Dados

- **Tempo de retenção**: Dados mantidos enquanto o usuário utilizar o sistema
- **Exclusão**: Usuário pode solicitar exclusão a qualquer momento
- **Solicitações**: Histórico de denúncias pode ser anonimizado após conclusão

### Compartilhamento de Dados

❌ **NÃO compartilhamos dados pessoais com terceiros** sem consentimento explícito do usuário.

Os dados são acessados apenas por:
- Sistema ResolveAi (backend e mobile)
- Gestores municipais autorizados (para atender às solicitações)

### Base Legal (Art. 7º LGPD)

✅ **Consentimento do titular** (Art. 7º, I)
- Implementado via checkbox obrigatório no cadastro
- Registrado com data/hora e IP

### Como Implementamos

#### Frontend (Mobile)
```typescript
// CpfScreen.tsx
<TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)}>
  <Text>Li e aceito os Termos de Uso e Política de Privacidade</Text>
</TouchableOpacity>

// Validação antes de cadastrar
if (!acceptedTerms) {
  Alert.alert("Termos de Uso", "Você precisa aceitar os termos...");
  return;
}
```

#### Backend (Node.js)
```javascript
// User Model - lgpdConsent field
lgpdConsent: {
  accepted: { type: Boolean, required: true, default: false },
  acceptedAt: { type: Date },
  ipAddress: { type: String }
}

// userController.js - Registro do consentimento
lgpdConsent: {
  accepted: true,
  acceptedAt: new Date(),
  ipAddress: req.ip || req.connection.remoteAddress
}
```

### Política de Privacidade Exibida

O texto completo da política é exibido ao usuário ao clicar no link "Política de Privacidade" durante o cadastro.

**Conteúdo:**
- Dados coletados (CPF, nome, data de nascimento, telefone)
- Finalidades do tratamento
- Segurança e não compartilhamento
- Direitos do titular
- Base legal (Art. 7º, I da LGPD)

### Próximos Passos (Melhorias Futuras)

1. **Portabilidade de dados** (Art. 18, V): Permitir exportação de todos os dados do usuário em formato legível (JSON/PDF)
2. **Central de Privacidade**: Tela dedicada no app para gerenciar consentimentos e dados
3. **Anonimização automática**: Após conclusão de denúncias antigas, anonimizar automaticamente
4. **Auditoria de acesso**: Log de quem acessou os dados do usuário
5. **DPO (Data Protection Officer)**: Nomear um encarregado de dados conforme Art. 41 LGPD

### Referências Legais

- **Lei 13.709/2018 (LGPD)** - Lei Geral de Proteção de Dados
- **Art. 7º** - Bases legais para tratamento de dados
- **Art. 8º** - Consentimento do titular
- **Art. 18** - Direitos do titular
- **Art. 46** - Segurança e boas práticas

---

**Última atualização**: Novembro 2024
**Responsável**: Equipe ResolveAi

