param (
    [switch]$Infra,
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Simulator,
    [switch]$All,
    [switch]$Status,
    [switch]$Stop
)

$RootDir = $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

function Start-Infra {
    Write-Host "`n[+] Starting Infrastructure Containers (Docker Compose)..." -ForegroundColor Cyan
    Set-Location $BackendDir
    docker compose up -d redpanda redpanda-console redis postgres
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Infrastructure containers active:" -ForegroundColor Green
        Write-Host "     - PostgreSQL:       localhost:5433" -ForegroundColor Yellow
        Write-Host "     - Redis:            localhost:6379" -ForegroundColor Yellow
        Write-Host "     - Redpanda (Kafka): localhost:9092" -ForegroundColor Yellow
        Write-Host "     - Redpanda Console: http://localhost:8080" -ForegroundColor Yellow
    }
}

function Push-Database {
    Write-Host "`n[+] Ensuring Prisma database schema is synchronized..." -ForegroundColor Cyan
    Set-Location (Join-Path $BackendDir "packages\database")
    npx prisma db push --skip-generate | Out-Null
    Write-Host "[OK] Database schema synchronized." -ForegroundColor Green
}

function Stop-AllServices {
    Write-Host "`n[+] Stopping background processes on all application ports..." -ForegroundColor Yellow
    $targetPorts = @(3000, 3001, 3002, 3003, 3004, 3005, 5173, 5174, 8000)
    $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $targetPorts }
    foreach ($c in $conns) {
        try {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Freed port $($c.LocalPort) (PID $($c.OwningProcess))" -ForegroundColor DarkGray
        } catch {}
    }
    Write-Host "[OK] All application ports cleared." -ForegroundColor Green
}

function Show-Status {
    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host "  SentinelPay System Status" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    
    $dockerRunning = docker info 2>$null
    if ($dockerRunning) {
        Write-Host "  [Docker]            Running (OK)" -ForegroundColor Green
    } else {
        Write-Host "  [Docker]            Not running (FAIL)" -ForegroundColor Red
    }

    $targetPorts = @(
        @{ Name = "Frontend (Main App)"; Port = 5173 },
        @{ Name = "Simulator";           Port = 5174 },
        @{ Name = "Redpanda Console";    Port = 8080 },
        @{ Name = "ML Service";          Port = 8000 },
        @{ Name = "Ingestion Service";   Port = 3000 },
        @{ Name = "Notification Service"; Port = 3001 },
        @{ Name = "Auth Service";        Port = 3002 },
        @{ Name = "Analytics Service";   Port = 3003 },
        @{ Name = "Subscription Service"; Port = 3004 },
        @{ Name = "Admin Service";       Port = 3005 },
        @{ Name = "PostgreSQL";          Port = 5433 },
        @{ Name = "Redis";               Port = 6379 }
    )

    $listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
    foreach ($p in $targetPorts) {
        $active = $listening | Where-Object { $_.LocalPort -eq $p.Port }
        if ($active) {
            Write-Host "  [PORT $($p.Port)] $($p.Name): UP (PID $($active[0].OwningProcess))" -ForegroundColor Green
        } else {
            Write-Host "  [PORT $($p.Port)] $($p.Name): Down" -ForegroundColor DarkGray
        }
    }
    Write-Host "=========================================`n" -ForegroundColor Cyan
}

# Main Execution Flow
if ($Stop) {
    Stop-AllServices
} elseif ($Status) {
    Show-Status
} elseif ($Infra) {
    Start-Infra
    Push-Database
} elseif ($Frontend) {
    Start-Process "http://localhost:5173"
    Set-Location $RootDir
    npm run dev:frontend
} elseif ($Simulator) {
    Start-Process "http://localhost:5174"
    Set-Location $RootDir
    npm run dev:simulator
} elseif ($Backend) {
    Start-Infra
    Push-Database
    Set-Location $RootDir
    npm run dev:backend
} else {
    # Default ($All or no flags):
    Start-Infra
    Push-Database
    
    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "  Starting all services in a single unified process..." -ForegroundColor Green
    Write-Host "  🌟 Main Application:    http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  📊 Anomaly Simulator:    http://localhost:5174" -ForegroundColor Cyan
    Write-Host "  📡 Redpanda Console:    http://localhost:8080" -ForegroundColor Cyan
    Write-Host "  🧠 ML Service Docs:     http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host "Press Ctrl+C at any time to stop all services." -ForegroundColor Yellow
    Write-Host ""

    # Open the Main Application in your browser
    Start-Process "http://localhost:5173"

    Set-Location $RootDir
    npm run dev
}
