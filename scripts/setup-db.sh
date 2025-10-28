#!/bin/bash

# Database setup script for Mentor Platform

echo "🚀 Setting up Mentor Platform database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Start database services
echo "📦 Starting database services..."
docker-compose up -d db cache

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if database is accessible
until docker-compose exec -T db pg_isready -U postgres; do
    echo "⏳ Waiting for database..."
    sleep 2
done

echo "✅ Database is ready!"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "📊 Pushing database schema..."
npx prisma db push

# Seed database with sample data
echo "🌱 Seeding database..."
npm run db:seed

echo "🎉 Database setup completed!"
echo ""
echo "You can now:"
echo "  - Run 'npm run dev' to start the development server"
echo "  - Run 'npm run db:studio' to open Prisma Studio"
echo "  - Access the database at localhost:5432"
echo "  - Access Redis at localhost:6379"