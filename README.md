# 🎓 Mentor Platform

A comprehensive mentoring platform built with Next.js 16, featuring real-time video sessions, payment processing, and advanced analytics. Connect mentors and mentees for personalized learning experiences with secure, scalable, and user-friendly interfaces.

## ✨ Features

### 👥 **Dual Role System**
- Users can be both mentors and mentees
- Role-based access control and permissions
- Seamless role switching interface

### 🔍 **Advanced Search & Discovery**
- Find mentors by expertise, availability, and pricing
- Real-time search with filters and sorting
- Mentor recommendation algorithm
- Student connection features

### 📹 **Real-time Sessions**
- HD video calls with Daily.co integration
- Collaborative whiteboard and note-taking
- Screen sharing capabilities
- File sharing with security scanning
- Session recording with consent management

### 💳 **Payment Processing**
- Secure payments with Razorpay (UPI, Google Pay)
- Multiple pricing models (one-time, hourly, subscription)
- Automatic payout processing (24-hour cycle)
- Comprehensive earnings analytics

### 📊 **Analytics & Insights**
- Real-time earnings tracking for mentors
- Platform usage analytics for admins
- Session completion and satisfaction metrics
- Tax reporting and payout analytics

### 🛡️ **Safety & Security**
- User blocking and reporting system
- Content moderation and review system
- Comprehensive audit logging
- File security scanning

### 📱 **Mobile Responsive**
- Touch-friendly interfaces
- Mobile-optimized booking flow
- Responsive session management
- Progressive Web App features

## Tech Stack

- **Frontend**: Next.js 16 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL 18 with Prisma ORM
- **Caching**: Redis for session management and search caching
- **Authentication**: NextAuth.js with JWT and session management
- **Real-time**: WebRTC for video/audio communication
- **Payments**: Razorpay for UPI/Google Pay integration
- **Code Quality**: Biome for linting and formatting
- **Containerization**: Docker and Docker Compose

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mentor-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

4. Start the database services:
```bash
npm run docker:up
```

5. Set up the database:
```bash
npm run db:push
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run Biome linter
- `npm run format` - Format code with Biome
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

## Project Structure

```
mentor-platform/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Reusable React components
│   ├── lib/                 # Utility libraries (db, redis, auth)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Helper functions
│   └── hooks/               # Custom React hooks
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets
├── uploads/                 # File upload directory
└── docker-compose.yml       # Docker services configuration
```

## Development Workflow

1. **Database Changes**: Update `prisma/schema.prisma` and run `npm run db:push`
2. **Code Quality**: Run `npm run lint` and `npm run format` before committing
3. **Testing**: Run tests with appropriate test commands (to be added)
4. **Docker Services**: Use `npm run docker:up/down` to manage services

## Contributing

1. Follow the existing code style and use Biome for formatting
2. Write meaningful commit messages
3. Test your changes thoroughly
4. Update documentation as needed

## License

This project is private and proprietary.
