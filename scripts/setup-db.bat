@echo off
echo 🚀 Setting up Mentor Platform database...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

REM Start database services
echo 📦 Starting database services...
docker-compose up -d db cache

REM Wait for PostgreSQL to be ready
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

:wait_for_db
docker-compose exec -T db pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo ⏳ Waiting for database...
    timeout /t 2 /nobreak >nul
    goto wait_for_db
)

echo ✅ Database is ready!

REM Generate Prisma client
echo 🔧 Generating Prisma client...
npx prisma generate

REM Push database schema
echo 📊 Pushing database schema...
npx prisma db push

REM Seed database with sample data
echo 🌱 Seeding database...
npm run db:seed

echo 🎉 Database setup completed!
echo.
echo You can now:
echo   - Run 'npm run dev' to start the development server
echo   - Run 'npm run db:studio' to open Prisma Studio
echo   - Access the database at localhost:5432
echo   - Access Redis at localhost:6379

pause