#!/bin/bash

# Database backup script for production
set -e

# Configuration
DB_HOST="db"
DB_NAME="mentor_platform"
DB_USER="postgres"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mentor_platform_$DATE.sql"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create database backup
echo "Creating database backup..."
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress the backup
gzip $BACKUP_FILE

echo "Backup created: ${BACKUP_FILE}.gz"

# Remove old backups (keep only last 7 days)
find $BACKUP_DIR -name "mentor_platform_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Old backups cleaned up (retention: $RETENTION_DAYS days)"

# Optional: Upload to cloud storage
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "${BACKUP_FILE}.gz" "s3://$AWS_S3_BUCKET/backups/"
    echo "Backup uploaded to S3"
fi

echo "Backup process completed successfully"