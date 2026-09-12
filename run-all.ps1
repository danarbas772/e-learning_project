# Script untuk menjalankan backend (Modular Monolith) & frontend sekaligus di Windows (PowerShell)
# Jalankan script ini dengan: .\run-all.ps1

Write-Host "🚀 Menjalankan Bas Learning Platform (Modular Monolith)..." -ForegroundColor Cyan

# 1. Backend Service Tunggal (Port 5000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

# 2. Frontend React Vite (Port 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Backend (:5000) & Frontend (:3000) sedang dijalankan!" -ForegroundColor Green
Write-Host "🌐 Akses web aplikasi di http://localhost:3000" -ForegroundColor Yellow
Write-Host "📡 Backend API berjalan di http://localhost:5000/api" -ForegroundColor Cyan
