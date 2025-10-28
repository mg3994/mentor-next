import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SessionStatus } from '@prisma/client'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mentorId = searchParams.get('mentorId')
    const dateStr = searchParams.get('date')

    if (!mentorId || !dateStr) {
      return NextResponse.json(
        { error: 'mentorId and date are required' },
        { status: 400 }
      )
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Get existing bookings for the specified date
    const bookings = await prisma.session.findMany({
      where: {
        mentorId,
        startTime: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: {
          in: [SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS],
        },
      },
      select: {
        id: true,
        startTime: true,
        scheduledEnd: true,
        status: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      bookings,
      date: date.toISOString(),
    })

  } catch (error) {
    console.error('Get availability error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}