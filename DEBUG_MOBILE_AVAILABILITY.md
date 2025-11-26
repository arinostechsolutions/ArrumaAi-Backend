# Debug: Problema de Disponibilidade no App Mobile

## ✅ Backend está funcionando corretamente

O backend está retornando corretamente:
- **10/10 vagas disponíveis** para várias datas
- Campo `available: true` está sendo retornado
- Campo `remaining: 10` está sendo retornado

## 🔍 O que verificar no código do Mobile

### 1. Estrutura da Resposta da API

A API `/api/health/getRemainingAppointments` retorna:

```json
{
  "2025-11-21": {
    "remaining": 10,
    "total": 10,
    "booked": 0,
    "available": true
  },
  "2025-11-24": {
    "remaining": 10,
    "total": 10,
    "booked": 0,
    "available": true
  }
}
```

### 2. Possíveis Problemas no Mobile

#### Problema 1: Verificação do campo errado
```typescript
// ❌ ERRADO - Verificar remaining diretamente
if (availability[date].remaining === 0) {
  showUnavailable();
}

// ✅ CORRETO - Usar o campo available
if (!availability[date]?.available) {
  showUnavailable();
}

// OU
if (availability[date]?.remaining <= 0) {
  showUnavailable();
}
```

#### Problema 2: Formato de data diferente
O mobile pode estar usando um formato de data diferente do que a API retorna.

```typescript
// A API usa formato: "2025-11-21" (YYYY-MM-DD)
// Verificar se o mobile está usando o mesmo formato

// ❌ ERRADO
const dateKey = selectedDate.toLocaleDateString(); // "21/11/2025"

// ✅ CORRETO
const dateKey = selectedDate.toISOString().split('T')[0]; // "2025-11-21"
// OU
const dateKey = format(selectedDate, 'yyyy-MM-dd'); // "2025-11-21"
```

#### Problema 3: Data não encontrada no objeto
```typescript
// ❌ ERRADO - Não verifica se a data existe
const slotInfo = availability[date];
if (!slotInfo.available) {
  showUnavailable();
}

// ✅ CORRETO - Verificar se existe primeiro
const slotInfo = availability[date];
if (!slotInfo || !slotInfo.available) {
  showUnavailable();
}
```

#### Problema 4: Timezone causando diferença de data
```typescript
// Se o mobile está usando timezone local, pode haver diferença
// A API retorna datas no formato "2025-11-21" (sem timezone)

// ✅ CORRETO - Normalizar data para YYYY-MM-DD
const normalizeDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateKey = normalizeDate(selectedDate);
const slotInfo = availability[dateKey];
```

### 3. Exemplo de Código Correto

```typescript
// Função para verificar disponibilidade
const checkAvailability = (selectedDate: Date, availability: Record<string, any>) => {
  // Normalizar data para formato YYYY-MM-DD
  const dateKey = selectedDate.toISOString().split('T')[0];
  
  // Verificar se a data existe na resposta
  const slotInfo = availability[dateKey];
  
  if (!slotInfo) {
    console.warn(`Data ${dateKey} não encontrada na resposta`);
    return false;
  }
  
  // Verificar disponibilidade
  // Opção 1: Usar campo available (recomendado)
  if (slotInfo.available === true) {
    return true;
  }
  
  // Opção 2: Verificar remaining > 0
  if (slotInfo.remaining > 0) {
    return true;
  }
  
  return false;
};

// Uso
const isAvailable = checkAvailability(selectedDate, availabilityData);
if (!isAvailable) {
  showMessage("Este dia não possui mais horários disponíveis");
}
```

### 4. Logs para Debug no Mobile

Adicione logs temporários para verificar:

```typescript
console.log('📅 Data selecionada:', selectedDate);
console.log('🔑 Chave da data:', dateKey);
console.log('📦 Resposta completa:', JSON.stringify(availability, null, 2));
console.log('📊 Info da data selecionada:', availability[dateKey]);
console.log('✅ Disponível?', availability[dateKey]?.available);
console.log('🔢 Remaining:', availability[dateKey]?.remaining);
```

### 5. Verificar Requisição

Certifique-se de que a requisição está sendo feita corretamente:

```typescript
// Parâmetros corretos
const params = {
  cityId: 'araruama-rj',
  unitId: 'hospital-de-araruama',
  type: 'consulta',
  selectedId: 'clinico-geral',
  shift: 'morning', // ou 'afternoon'
  dates: '2025-11-21,2025-11-22,2025-11-23,...' // formato YYYY-MM-DD separado por vírgula
};

// Fazer requisição
const response = await fetch(`/api/health/getRemainingAppointments?${new URLSearchParams(params)}`);
const availability = await response.json();
```

## 🎯 Checklist para Corrigir

- [ ] Verificar se está usando `available: true` ou `remaining > 0`
- [ ] Verificar se o formato de data está correto (YYYY-MM-DD)
- [ ] Verificar se a data existe no objeto antes de acessar
- [ ] Adicionar logs para ver o que está sendo recebido
- [ ] Verificar se há problema de timezone
- [ ] Verificar se a requisição está sendo feita com os parâmetros corretos




