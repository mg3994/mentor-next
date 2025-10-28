import { PrismaClient, Role, RoleStatus, PricingType } from '@prisma/client'
import { hashPassword } from '../src/lib/auth-utils'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminPassword = await hashPassword('admin123456')
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mentorplatform.com' },
    update: {},
    create: {
      email: 'admin@mentorplatform.com',
      name: 'Platform Administrator',
      emailVerified: new Date(),
      roles: {
        create: {
          role: Role.ADMIN,
          status: RoleStatus.ACTIVE,
        },
      },
    },
  })
  console.log('✅ Created admin user:', admin.email)

  // Create sample mentors
  const mentors = [
    {
      email: 'john.doe@example.com',
      name: 'John Doe',
      bio: 'Full-stack developer with 8+ years of experience in React, Node.js, and cloud technologies. I specialize in helping developers transition from junior to senior roles and building scalable web applications.',
      expertise: ['React', 'Node.js', 'TypeScript', 'AWS', 'MongoDB'],
      experience: 'Senior Software Engineer at TechCorp, previously at StartupXYZ. Built and scaled applications serving millions of users.',
      education: 'Computer Science, MIT',
      certifications: ['AWS Solutions Architect', 'Google Cloud Professional'],
      timezone: 'America/New_York',
      pricingModels: [
        { type: PricingType.ONE_TIME, price: 75, duration: 60, description: '1-hour consultation' },
        { type: PricingType.HOURLY, price: 85, description: 'Hourly mentoring sessions' },
        { type: PricingType.MONTHLY_SUBSCRIPTION, price: 300, description: 'Monthly mentorship package' },
      ],
      availability: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // Monday
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }, // Tuesday
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }, // Wednesday
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' }, // Thursday
        { dayOfWeek: 5, startTime: '09:00', endTime: '15:00' }, // Friday
      ],
    },
    {
      email: 'sarah.wilson@example.com',
      name: 'Sarah Wilson',
      bio: 'UX/UI Designer and Product Manager with a passion for creating user-centered digital experiences. I help designers and PMs develop their skills in user research, design thinking, and product strategy.',
      expertise: ['UX Design', 'UI Design', 'Product Management', 'Figma', 'User Research'],
      experience: 'Lead Product Designer at DesignCo, 6 years in product design and management.',
      education: 'Design, Stanford University',
      certifications: ['Google UX Design Certificate', 'Certified Scrum Product Owner'],
      timezone: 'America/Los_Angeles',
      pricingModels: [
        { type: PricingType.ONE_TIME, price: 65, duration: 60, description: 'Portfolio review session' },
        { type: PricingType.HOURLY, price: 70, description: 'Design mentoring' },
      ],
      availability: [
        { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '10:00', endTime: '16:00' },
      ],
    },
    {
      email: 'alex.chen@example.com',
      name: 'Alex Chen',
      bio: 'Data Scientist and Machine Learning Engineer with expertise in Python, TensorFlow, and cloud ML platforms. I mentor aspiring data scientists and help professionals transition into AI/ML roles.',
      expertise: ['Python', 'Machine Learning', 'Data Science', 'TensorFlow', 'SQL'],
      experience: 'Senior Data Scientist at DataTech, PhD in Machine Learning, 5+ years industry experience.',
      education: 'PhD Machine Learning, Carnegie Mellon',
      certifications: ['Google Cloud ML Engineer', 'AWS ML Specialty'],
      timezone: 'America/Chicago',
      pricingModels: [
        { type: PricingType.ONE_TIME, price: 90, duration: 90, description: 'Career transition consultation' },
        { type: PricingType.HOURLY, price: 95, description: 'Technical mentoring' },
        { type: PricingType.MONTHLY_SUBSCRIPTION, price: 400, description: 'Comprehensive ML mentorship' },
      ],
      availability: [
        { dayOfWeek: 2, startTime: '14:00', endTime: '20:00' },
        { dayOfWeek: 4, startTime: '14:00', endTime: '20:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '16:00' },
      ],
    },
  ]

  for (const mentorData of mentors) {
    const password = await hashPassword('mentor123456')
    const user = await prisma.user.upsert({
      where: { email: mentorData.email },
      update: {},
      create: {
        email: mentorData.email,
        name: mentorData.name,
        emailVerified: new Date(),
        roles: {
          create: [
            { role: Role.MENTOR, status: RoleStatus.ACTIVE },
            { role: Role.MENTEE, status: RoleStatus.ACTIVE },
          ],
        },
      },
    })

    const mentorProfile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bio: mentorData.bio,
        expertise: mentorData.expertise,
        experience: mentorData.experience,
        education: mentorData.education,
        certifications: mentorData.certifications,
        timezone: mentorData.timezone,
        isVerified: true,
        averageRating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
        totalSessions: Math.floor(Math.random() * 50) + 10, // Random sessions between 10-60
      },
    })

    // Create pricing models
    for (const pricing of mentorData.pricingModels) {
      await prisma.pricingModel.upsert({
        where: {
          mentorId_type: {
            mentorId: mentorProfile.id,
            type: pricing.type,
          },
        },
        update: {},
        create: {
          mentorId: mentorProfile.id,
          type: pricing.type,
          price: pricing.price,
          duration: pricing.duration,
          description: pricing.description,
        },
      })
    }

    // Create availability
    for (const availability of mentorData.availability) {
      await prisma.availability.create({
        data: {
          mentorId: mentorProfile.id,
          dayOfWeek: availability.dayOfWeek,
          startTime: availability.startTime,
          endTime: availability.endTime,
        },
      })
    }

    console.log('✅ Created mentor:', mentorData.name)
  }

  // Create sample mentees
  const mentees = [
    {
      email: 'jane.student@example.com',
      name: 'Jane Student',
      learningGoals: 'Learn full-stack web development and land my first developer job',
      interests: ['React', 'JavaScript', 'Career Development'],
      timezone: 'America/New_York',
    },
    {
      email: 'mike.learner@example.com',
      name: 'Mike Learner',
      learningGoals: 'Transition from marketing to UX design',
      interests: ['UX Design', 'Figma', 'User Research'],
      timezone: 'America/Los_Angeles',
    },
    {
      email: 'lisa.aspiring@example.com',
      name: 'Lisa Aspiring',
      learningGoals: 'Break into data science field',
      interests: ['Python', 'Data Science', 'Machine Learning'],
      timezone: 'America/Chicago',
    },
  ]

  for (const menteeData of mentees) {
    const password = await hashPassword('mentee123456')
    const user = await prisma.user.upsert({
      where: { email: menteeData.email },
      update: {},
      create: {
        email: menteeData.email,
        name: menteeData.name,
        emailVerified: new Date(),
        roles: {
          create: {
            role: Role.MENTEE,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    })

    await prisma.menteeProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        learningGoals: menteeData.learningGoals,
        interests: menteeData.interests,
        timezone: menteeData.timezone,
      },
    })

    console.log('✅ Created mentee:', menteeData.name)
  }

  console.log('🎉 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })