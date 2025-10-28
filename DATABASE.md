# Database Setup Guide

This guide explains how to set up the PostgreSQL database and Redis cache for the Mentor Platform.

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ installed
- npm or yarn package manager

## Quick Setup

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
scripts\setup-db.bat
```

**Linux/macOS:**
```bash
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

### Option 2: Manual Setup

1. **Start Database Services:**
```bash
docker-compose up -d db cache
```

2. **Wait for services to be ready** (about 10-15 seconds)

3. **Generate Prisma Client:**
```bash
npx prisma generate
```

4. **Push Database Schema:**
```bash
npx prisma db push
```

5. **Seed Database with Sample Data:**
```bash
npm run db:seed
```

## Database Schema

The database includes the following main entities:

### Core Models
- **Users**: User accounts with authentication
- **UserRoles**: Role management (MENTEE, MENTOR, ADMIN)
- **MenteeProfiles**: Mentee-specific profile data
- **MentorProfiles**: Mentor-specific profile data

### Session Management
- **Sessions**: Mentorship session records
- **Transactions**: Payment and earnings tracking
- **Reviews**: Session ratings and feedback

### Safety & Support
- **Reports**: User safety reports
- **UserBlocks**: User blocking functionality
- **SupportTickets**: Help desk system
- **AuditLogs**: System activity tracking

### Additional Models
- **PricingModels**: Mentor pricing configurations
- **Availability**: Mentor availability schedules
- **SessionFiles**: File sharing during sessions
- **SessionNotes**: Collaborative note-taking

## Sample Data

The seed script creates:

### Admin User
- **Email**: admin@mentorplatform.com
- **Password**: admin123456
- **Role**: Administrator

### Sample Mentors
1. **John Doe** (john.doe@example.com)
   - Full-stack developer
   - Expertise: React, Node.js, TypeScript, AWS
   - Password: mentor123456

2. **Sarah Wilson** (sarah.wilson@example.com)
   - UX/UI Designer & Product Manager
   - Expertise: UX Design, Figma, Product Management
   - Password: mentor123456

3. **Alex Chen** (alex.chen@example.com)
   - Data Scientist & ML Engineer
   - Expertise: Python, Machine Learning, TensorFlow
   - Password: mentor123456

### Sample Mentees
1. **Jane Student** (jane.student@example.com)
   - Learning: Full-stack development
   - Password: mentee123456

2. **Mike Learner** (mike.learner@example.com)
   - Learning: UX Design transition
   - Password: mentee123456

3. **Lisa Aspiring** (lisa.aspiring@example.com)
   - Learning: Data Science
   - Password: mentee123456

## Database Management Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database
npm run db:push

# Create and run migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database with sample data
npm run db:seed

# Start Docker services
npm run docker:up

# Stop Docker services
npm run docker:down
```

## Connection Details

### PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: mentor
- **Username**: postgres
- **Password**: password

### Redis
- **Host**: localhost
- **Port**: 6379
- **No authentication required**

## Troubleshooting

### Docker Issues
1. **Docker not running**: Start Docker Desktop
2. **Port conflicts**: Stop other services using ports 5432 or 6379
3. **Permission issues**: Run terminal as administrator (Windows) or use sudo (Linux/macOS)

### Database Connection Issues
1. **Connection refused**: Wait longer for PostgreSQL to start (up to 30 seconds)
2. **Authentication failed**: Check environment variables in `.env.local`
3. **Database doesn't exist**: Run `npm run db:push` to create schema

### Prisma Issues
1. **Client not generated**: Run `npx prisma generate`
2. **Schema out of sync**: Run `npm run db:push`
3. **Migration conflicts**: Delete `prisma/migrations` folder and run `npm run db:push`

## Environment Variables

Ensure these variables are set in your `.env.local`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mentor"
REDIS_URL="redis://localhost:6379"
```

## Data Persistence

Database data is persisted in Docker volumes:
- `postgres_data`: PostgreSQL data
- `redis_data`: Redis data

To completely reset the database:
```bash
docker-compose down -v  # Removes volumes
docker-compose up -d    # Recreates services
npm run db:push         # Recreates schema
npm run db:seed         # Adds sample data
```