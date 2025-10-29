# 🚀 Mentor Platform - Production Deployment Guide

This guide covers the complete deployment process for the Mentor Platform in a production environment.

## 📋 Prerequisites

- Docker and Docker Compose installed
- SSL certificates for HTTPS
- Domain name configured
- Required environment variables

## 🔧 Environment Setup

### 1. Create Production Environment File

```bash
cp .env.production.example .env.production
```

### 2. Configure Required Variables

Edit `.env.production` with your actual values:

```bash
# Database
POSTGRES_PASSWORD=your_secure_postgres_password_here

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_super_secure_nextauth_secret_here

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Security
ENCRYPTION_KEY=your_32_character_encryption_key_here

# External Services
DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=your-daily-domain.daily.co
```

## 🏗️ Deployment Steps

### 1. Prepare SSL Certificates

Place your SSL certificates in the `ssl/` directory:
```bash
mkdir -p ssl
# Copy your certificates
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem
```

### 2. Run Deployment Script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 3. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Optional: Seed database
docker-compose -f docker-compose.prod.yml exec app npx prisma db seed
```

## 🔍 Health Checks

### Application Health
```bash
curl -f https://your-domain.com/api/health
```

### Service Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

## 📊 Monitoring

### Application Logs
Logs are stored in the `logs/` directory:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

### Database Monitoring
```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mentor_platform

# Check database size
SELECT pg_size_pretty(pg_database_size('mentor_platform'));
```

### Redis Monitoring
```bash
# Connect to Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Check memory usage
INFO memory
```

## 💾 Backup & Recovery

### Automated Backups
Backups run daily at 2 AM via cron job. Manual backup:

```bash
docker-compose -f docker-compose.prod.yml --profile backup up backup
```

### Restore from Backup
```bash
# Stop the application
docker-compose -f docker-compose.prod.yml down

# Restore database
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mentor_platform < backups/mentor_platform_YYYYMMDD_HHMMSS.sql

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Updates & Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build --no-cache app
docker-compose -f docker-compose.prod.yml up -d app

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Database Migrations
```bash
# Generate new migration
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate dev --name migration_name

# Deploy migration
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

## 🛡️ Security Considerations

### SSL/TLS Configuration
- Use strong SSL certificates (Let's Encrypt recommended)
- Enable HSTS headers
- Configure proper cipher suites

### Environment Variables
- Never commit production environment files
- Use strong, unique passwords
- Rotate secrets regularly

### Network Security
- Configure firewall rules
- Use VPC/private networks
- Enable fail2ban for SSH protection

### Database Security
- Use strong database passwords
- Enable SSL for database connections
- Regular security updates

## 📈 Performance Optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_sessions_mentor_id ON sessions(mentor_id);
CREATE INDEX CONCURRENTLY idx_sessions_mentee_id ON sessions(mentee_id);
CREATE INDEX CONCURRENTLY idx_sessions_scheduled_at ON sessions(scheduled_at);
```

### Redis Configuration
- Configure appropriate memory limits
- Enable persistence if needed
- Monitor memory usage

### Application Performance
- Enable gzip compression (configured in Nginx)
- Use CDN for static assets
- Monitor application metrics

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env | grep -E "(DATABASE_URL|NEXTAUTH_)"
```

#### Database Connection Issues
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec app npx prisma db pull
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Check database performance
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mentor_platform -c "SELECT * FROM pg_stat_activity;"
```

## 📞 Support

For deployment issues:
1. Check application logs
2. Verify environment configuration
3. Test database connectivity
4. Check SSL certificate validity
5. Monitor resource usage

## 🔄 Rollback Procedure

In case of deployment issues:

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore from backup
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mentor_platform < backups/latest_backup.sql

# Start previous version
git checkout previous-stable-tag
docker-compose -f docker-compose.prod.yml up -d
```

## 📋 Post-Deployment Checklist

- [ ] Application health check passes
- [ ] Database migrations completed
- [ ] SSL certificates valid
- [ ] Backup system configured
- [ ] Monitoring alerts configured
- [ ] Performance metrics baseline established
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Documentation updated

---

**🎉 Congratulations! Your Mentor Platform is now running in production.**

For ongoing maintenance and support, refer to the monitoring and troubleshooting sections above.