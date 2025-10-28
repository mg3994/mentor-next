# Mentor Platform

An online platform that connects learners with experts through a dual-role system where users can be both mentees and mentors. The platform facilitates secure, real-time mentorship sessions with flexible payment options, advanced search capabilities, and comprehensive collaboration tools.

## Features

- **Dual Role System**: Users can be both mentees and mentors
- **Advanced Search**: Find mentors by expertise, experience, pricing, and availability
- **Flexible Booking**: Support for one-time sessions, hourly rates, and monthly subscriptions
- **Real-time Sessions**: Video calls, chat, whiteboard, screen sharing, and file sharing
- **Payment Integration**: UPI and Google Pay support with automatic payouts
- **Safety Features**: User blocking, reporting, and comprehensive support system
- **Administrative Tools**: User management, analytics, and system monitoring

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
