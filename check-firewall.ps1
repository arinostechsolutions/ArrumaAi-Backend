# Script para verificar e configurar o firewall do Windows para o servidor Node.js
# Execute como Administrador: PowerShell -ExecutionPolicy Bypass -File .\check-firewall.ps1

Write-Host "`n🔍 Verificando configuração do firewall para porta 3000...`n" -ForegroundColor Cyan

$port = 3000
$ruleName = "Node.js Backend - Port $port"

# Verifica se já existe uma regra
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "✅ Regra de firewall já existe: $ruleName" -ForegroundColor Green
    Write-Host "   Status: $($existingRule.Enabled)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Regra de firewall não encontrada." -ForegroundColor Yellow
    Write-Host "   Criando regra para permitir conexões na porta $port...`n" -ForegroundColor Yellow
    
    try {
        New-NetFirewallRule -DisplayName $ruleName `
            -Direction Inbound `
            -LocalPort $port `
            -Protocol TCP `
            -Action Allow `
            -Profile Domain,Private,Public | Out-Null
        
        Write-Host "✅ Regra criada com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao criar regra: $_" -ForegroundColor Red
        Write-Host "   Certifique-se de executar como Administrador" -ForegroundColor Yellow
    }
}

# Verifica se a porta está sendo usada
Write-Host "`n🔍 Verificando se a porta $port está em uso...`n" -ForegroundColor Cyan
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "✅ Porta $port está em uso (servidor provavelmente rodando)" -ForegroundColor Green
    Write-Host "   Estado: $($portInUse.State)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Porta $port não está em uso (servidor não está rodando)" -ForegroundColor Yellow
}

Write-Host "`n📋 Resumo:" -ForegroundColor Cyan
Write-Host "   1. Certifique-se de que o servidor está rodando (npm run dev)" -ForegroundColor White
Write-Host "   2. Use o IP mostrado no console do servidor no frontend" -ForegroundColor White
Write-Host "   3. Teste a conexão acessando: http://SEU_IP:3000/health" -ForegroundColor White
Write-Host "`n"

