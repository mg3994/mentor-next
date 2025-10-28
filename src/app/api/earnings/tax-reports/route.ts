import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { earningsService } from '@/lib/earnings-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const taxReportSchema = z.object({
  year: z.number().min(2020).max(new Date().getFullYear()),
  month: z.number().min(1).max(12).optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is a mentor
    const userRoles = await prisma.userRole.findMany({
      where: { 
        userId: session.user.id,
        role: 'MENTOR',
        status: 'ACTIVE',
      },
    })

    if (userRoles.length === 0) {
      return NextResponse.json(
        { error: 'Mentor access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const format = searchParams.get('format') || 'json'

    // Validate parameters
    const validation = taxReportSchema.safeParse({ year, month, format })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      )
    }

    let taxReport: any

    if (month) {
      // Generate monthly tax report
      taxReport = await earningsService.generateMonthlyTaxReport(session.user.id, year, month)
    } else {
      // Generate annual tax report
      taxReport = await earningsService.generateAnnualTaxReport(session.user.id, year)
    }

    // Handle different formats
    switch (format) {
      case 'json':
        return NextResponse.json({
          success: true,
          taxReport,
        })
        
      case 'csv':
        const csvData = generateCSVReport(taxReport)
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="tax-report-${year}${month ? `-${month.toString().padStart(2, '0')}` : ''}.csv"`,
          },
        })
        
      case 'pdf':
        // In a real system, would generate PDF using a library like puppeteer or jsPDF
        return NextResponse.json({
          success: true,
          message: 'PDF generation not implemented in demo',
          downloadUrl: `/api/earnings/tax-reports?year=${year}${month ? `&month=${month}` : ''}&format=csv`,
        })
        
      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Tax report error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate tax report',
        success: false,
      },
      { status: 500 }
    )
  }
}

// POST endpoint to request tax report generation (for complex reports)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is a mentor
    const userRoles = await prisma.userRole.findMany({
      where: { 
        userId: session.user.id,
        role: 'MENTOR',
        status: 'ACTIVE',
      },
    })

    if (userRoles.length === 0) {
      return NextResponse.json(
        { error: 'Mentor access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = taxReportSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid tax report request', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { year, month, format } = validatedFields.data

    // Generate tax report
    let taxReport: any

    if (month) {
      taxReport = await earningsService.generateMonthlyTaxReport(session.user.id, year, month)
    } else {
      taxReport = await earningsService.generateAnnualTaxReport(session.user.id, year)
    }

    // Return report with metadata
    return NextResponse.json({
      success: true,
      taxReport,
      metadata: {
        generatedAt: new Date().toISOString(),
        mentorId: session.user.id,
        reportType: month ? 'monthly' : 'annual',
        period: month ? `${year}-${month.toString().padStart(2, '0')}` : year.toString(),
      },
    })

  } catch (error) {
    console.error('Tax report generation error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Tax report generation failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

function generateCSVReport(taxReport: any): string {
  const headers = [
    'Date',
    'Session ID',
    'Session Date',
    'Pricing Type',
    'Mentee',
    'Gross Amount',
    'Platform Fee',
    'Net Earnings',
  ]

  const rows = taxReport.transactions.map((t: any) => [
    new Date(t.date).toLocaleDateString(),
    t.sessionId,
    new Date(t.sessionDate).toLocaleDateString(),
    t.pricingType,
    t.mentee,
    t.grossAmount.toFixed(2),
    t.platformFee.toFixed(2),
    t.netEarnings.toFixed(2),
  ])

  // Add summary row
  rows.push([])
  rows.push(['SUMMARY', '', '', '', '', '', '', ''])
  rows.push(['Total Sessions', taxReport.sessionsCount.toString(), '', '', '', '', '', ''])
  rows.push(['Total Gross Revenue', '', '', '', '', taxReport.totalEarnings.toFixed(2), '', ''])
  rows.push(['Total Platform Fees', '', '', '', '', '', taxReport.platformFees.toFixed(2), ''])
  rows.push(['Total Net Earnings', '', '', '', '', '', '', taxReport.netEarnings.toFixed(2)])

  const csvContent = [headers, ...rows]
    .map(row => row.map((field: any) => `"${field}"`).join(','))
    .join('\n')

  return csvContent
}