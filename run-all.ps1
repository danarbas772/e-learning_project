# Script untuk menjalankan semua backend service & frontend sekaligus di Windows (PowerShell)
# Jalankan script ini dengan: .\run-all.ps1

Write-Host "🚀 Menjalankan EduSpace Microservices..." -ForegroundColor Cyan

# 1. API Gateway (Port 5000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/api-gateway; npm install; npm run dev"

# 2. Auth Service (Port 5001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/services/auth-service; npm install; npm run dev"

# 3. User Service (Port 5002)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/services/user-service; npm install; npm run dev"

# 4. Course Service (Port 5003)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/services/course-service; npm install; npm run dev"

# 5. Enrollment Service (Port 5004)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/services/enrollment-service; npm install; npm run dev"

# 6. Quiz Service (Port 5005)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/services/quiz-service; npm install; npm run dev"

# 7. Frontend React (Port 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Semua service sedang dijalankan di terminal masing-masing!" -ForegroundColor Green
Write-Host "🌐 Buka browser di http://localhost:3000" -ForegroundColor Yellow
