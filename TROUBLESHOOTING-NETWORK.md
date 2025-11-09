# 🔧 Guia de Troubleshooting - Conexão de Rede Local

## Problema: Erro "Network Error" ao conectar do frontend

### ✅ Soluções Passo a Passo

#### 1. Verificar se o servidor está rodando
```bash
npm run dev
```

Você deve ver uma mensagem como:
```
🚀 Servidor iniciado com sucesso!
📍 Acesse localmente: http://localhost:3000
🌐 Acesse na rede local: http://192.168.1.73:3000
```

**⚠️ IMPORTANTE:** Use o IP mostrado no console do servidor no frontend!

#### 2. Configurar o Firewall do Windows

**Opção A - Usando o script PowerShell (Recomendado):**
```powershell
# Execute como Administrador
PowerShell -ExecutionPolicy Bypass -File .\check-firewall.ps1
```

**Opção B - Manualmente:**
1. Abra o Windows Defender Firewall
2. Clique em "Configurações Avançadas"
3. Clique em "Regras de Entrada" → "Nova Regra"
4. Selecione "Porta" → Próximo
5. Selecione "TCP" e digite `3000` → Próximo
6. Selecione "Permitir a conexão" → Próximo
7. Marque todas as opções (Domínio, Privado, Público) → Próximo
8. Nome: "Node.js Backend - Port 3000" → Concluir

#### 3. Verificar o IP no Frontend

O frontend deve usar o **mesmo IP** mostrado no console do servidor.

**Exemplo:**
- Se o servidor mostra: `http://192.168.1.73:3000`
- O frontend deve usar: `http://192.168.1.73:3000/api/cities/getAllCities`

#### 4. Testar a Conexão

**No navegador do computador:**
```
http://192.168.1.73:3000/health
```

**Deve retornar:**
```json
{
  "status": "ok",
  "message": "Servidor está rodando",
  "timestamp": "..."
}
```

**No dispositivo móvel/emulador:**
- Use o mesmo IP do servidor
- Certifique-se de estar na mesma rede WiFi

#### 5. Casos Especiais

**Android Emulator:**
- Use `http://10.0.2.2:3000` ao invés do IP local
- O emulador Android tem um IP especial para acessar o localhost do host

**iOS Simulator:**
- Use `http://localhost:3000` ou o IP local normalmente

**Dispositivo Físico:**
- Ambos (computador e dispositivo) devem estar na mesma rede WiFi
- Use o IP local mostrado no console do servidor

### 🔍 Verificações Adicionais

1. **Verificar se a porta está em uso:**
   ```powershell
   netstat -ano | findstr :3000
   ```

2. **Verificar logs do servidor:**
   - Quando o frontend faz uma requisição, você deve ver logs como:
   ```
   📥 GET /api/cities/getAllCities - IP: 192.168.1.XX
   ```

3. **Verificar CORS:**
   - O servidor está configurado para aceitar requisições de qualquer origem
   - Se ainda houver problemas, verifique os headers no navegador (F12 → Network)

### ❌ Problemas Comuns

**Erro: "Network Error"**
- ✅ Servidor não está rodando → Execute `npm run dev`
- ✅ Firewall bloqueando → Configure o firewall (passo 2)
- ✅ IP incorreto → Use o IP mostrado no console do servidor
- ✅ Dispositivos em redes diferentes → Conecte ambos na mesma WiFi

**Erro: "Connection refused"**
- ✅ Porta incorreta → Verifique se está usando a porta 3000
- ✅ Servidor não escutando em 0.0.0.0 → Já está configurado corretamente

**Erro: "CORS"**
- ✅ CORS já está configurado para aceitar todas as origens
- ✅ Se persistir, verifique se não há outro proxy/middleware interferindo

### 📞 Ainda com problemas?

1. Verifique os logs do servidor quando o frontend tenta conectar
2. Teste a rota `/health` diretamente no navegador
3. Verifique se ambos os dispositivos estão na mesma rede
4. Tente desabilitar temporariamente o firewall para testar

