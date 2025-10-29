#!/bin/bash

# Production deployment script
set -e

echo "Starting deployment process..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found"
    echo "Please create the production environment file"
    exit 1
fi

# Load environment variables
export $(cat $ENV_FILE | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=("POSTGRES_PASSWORD" "NEXTAUTH_SECRET" "RAZORPAY_KEY_ID" "RAZORPAY_KEY_SECRET" "ENCRYPTION_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

echo "Environment variables validated"

# Build and start services
echo "Building and starting services..."
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker-compose -f $COMPOSE_FILE exec app npx prisma migrate deploy

# Seed database if needed
if [ "$SEED_DATABASE" = "true" ]; then
    echo "Seeding database..."
    docker-compose -f $COMPOSE_FILE exec app npx prisma db seed
fi

# Health check
echo "Performing health check..."
sleep 5
if curl -f http://localhost:3000/api/health; then
    echo "✅ Application is healthy"
else
    echo "❌ Health check failed"
    docker-compose -f $COMPOSE_FILE logs app
    exit 1
fi

# Setup backup cron job
echo "Setting up backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && docker-compose -f $COMPOSE_FILE --profile backup up backup") | crontab -

echo "🚀 Deployment completed successfully!"
echo "Application is running at: https://$(hostname)"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  Stop services: docker-compose -f $COMPOSE_FILE down"
echo "  Backup database: docker-compose -f $COMPOSE_FILE --profile backup up backup"