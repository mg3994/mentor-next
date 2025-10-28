// Comprehensive Earnings and Payout Service
// Handles automatic payouts, real-time tracking, and tax reporting

import { prisma } from './db'
import { createAuditLog, logPaymentAction } from './db-utils'
import { PLATFORM_FEE_PERCENTAGE } from './constants'

export interface EarningsData {
  totalEarnings: number
  availableForPayout: number
  pendingPayouts: number
  processedPayouts: number
  projectedMonthlyEarnings: number
  sessionsCompleted: number
  averageSessionEarnings: number
}

export interface PayoutRequest {
  mentorId: string
  amount: number
  payoutMethod: string
  bankDetails?: {
    accountNumber: string
    routingNumber: string
    accountHolderName: string
  }
}

export interface TaxReport {
  mentorId: string
  year: number
  month?: number
  totalEarnings: number
  platformFees: number
  netEarnings: number
  sessionsCount: number
  transactions: any[]
}

export class EarningsService {
  
  // Process automatic payout immediately after session completion
  async processAutomaticPayout(sessionId: string) {
    try {
      // Get session and transaction details
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          transaction: true,
          mentor: {
            include: {
              mentorProfile: true,
            },
          },
        },
      })

      if (!session || !session.transaction) {
        throw new Error('Session or transaction not found')
      }

      if (session.status !== 'COMPLETED') {
        throw new Error('Session must be completed before payout')
      }

      if (session.transaction.status !== 'COMPLETED') {
        throw new Error('Transaction must be completed before payout')
      }

      // Check if payout already processed
      const existingPayout = await prisma.mentorPayout.findFirst({
        where: {
          transactionIds: {
            has: session.transaction.id,
          },
        },
      })

      if (existingPayout) {
        console.log('Payout already processed for this session')
        return existingPayout
      }

      // Create automatic payout
      const payout = await prisma.mentorPayout.create({
        data: {
          mentorId: session.mentorId,
          amount: session.transaction.mentorEarnings,
          transactionIds: [session.transaction.id],
          status: 'COMPLETED',
          payoutMethod: 'automatic',
          processedAt: new Date(),
        },
      })

      // Log automatic payout
      await logPaymentAction({
        userId: session.mentorId,
        action: 'PAYOUT_PROCESSED',
        amount: session.transaction.mentorEarnings,
        details: {
          payoutId: payout.id,
          sessionId,
          transactionId: session.transaction.id,
          type: 'automatic',
        },
      })

      // Update mentor's total earnings cache
      await this.updateMentorEarningsCache(session.mentorId)

      return payout

    } catch (error) {
      console.error('Automatic payout error:', error)
      throw error
    }
  }

  // Get real-time earnings data for mentor
  async getRealTimeEarnings(mentorId: string): Promise<EarningsData> {
    try {
      // Get all completed transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          session: {
            mentorId,
          },
          status: 'COMPLETED',
        },
        include: {
          session: {
            select: {
              id: true,
              startTime: true,
              status: true,
              pricingType: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
      })

      // Get all payouts
      const payouts = await prisma.mentorPayout.findMany({
        where: { mentorId },
        orderBy: { processedAt: 'desc' },
      })

      // Calculate totals
      const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
      const processedPayouts = payouts
        .filter((p: any) => p.status === 'COMPLETED')
        .reduce((sum: number, p: any) => sum + p.amount, 0)
      
      const pendingPayouts = payouts
        .filter((p: any) => p.status === 'PENDING')
        .reduce((sum: number, p: any) => sum + p.amount, 0)

      const availableForPayout = totalEarnings - processedPayouts - pendingPayouts

      // Calculate projected monthly earnings
      const projectedMonthlyEarnings = await this.calculateProjectedEarnings(mentorId)

      // Calculate session statistics
      const completedSessions = transactions.filter((t: any) => t.session.status === 'COMPLETED')
      const averageSessionEarnings = completedSessions.length > 0 
        ? totalEarnings / completedSessions.length 
        : 0

      return {
        totalEarnings,
        availableForPayout,
        pendingPayouts,
        processedPayouts,
        projectedMonthlyEarnings,
        sessionsCompleted: completedSessions.length,
        averageSessionEarnings,
      }

    } catch (error) {
      console.error('Get real-time earnings error:', error)
      throw error
    }
  }

  // Process manual withdrawal request (24-hour processing)
  async processWithdrawalRequest(request: PayoutRequest) {
    try {
      const { mentorId, amount, payoutMethod, bankDetails } = request

      // Validate withdrawal amount
      const earnings = await this.getRealTimeEarnings(mentorId)
      
      if (amount > earnings.availableForPayout) {
        throw new Error('Insufficient available earnings for withdrawal')
      }

      if (amount < 10) {
        throw new Error('Minimum withdrawal amount is $10')
      }

      // Get transactions to include in payout
      const availableTransactions = await this.getAvailableTransactionsForPayout(mentorId, amount)

      if (availableTransactions.totalAmount < amount) {
        throw new Error('Insufficient available transactions for payout')
      }

      // Create payout request (will be processed within 24 hours)
      const payout = await prisma.mentorPayout.create({
        data: {
          mentorId,
          amount,
          transactionIds: availableTransactions.transactionIds,
          status: 'PENDING',
          payoutMethod,
        },
      })

      // Schedule processing (in real system, would use job queue)
      // For demo, we'll mark it as processing immediately
      setTimeout(async () => {
        await this.processScheduledPayout(payout.id)
      }, 1000) // Simulate processing delay

      // Log withdrawal request
      await logPaymentAction({
        userId: mentorId,
        action: 'PAYOUT_PROCESSED',
        amount,
        details: {
          payoutId: payout.id,
          type: 'manual_withdrawal',
          payoutMethod,
          bankDetails: bankDetails ? 'provided' : 'not_provided',
        },
      })

      return {
        success: true,
        payout,
        estimatedProcessingTime: '24 hours',
        message: 'Withdrawal request submitted successfully',
      }

    } catch (error) {
      console.error('Withdrawal request error:', error)
      throw error
    }
  }

  // Generate monthly tax report
  async generateMonthlyTaxReport(mentorId: string, year: number, month: number): Promise<TaxReport> {
    try {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)

      // Get all transactions for the month
      const transactions = await prisma.transaction.findMany({
        where: {
          session: {
            mentorId,
          },
          status: 'COMPLETED',
          completedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          session: {
            select: {
              id: true,
              startTime: true,
              pricingType: true,
              mentee: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      })

      // Calculate totals
      const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
      const platformFees = transactions.reduce((sum: number, t: any) => sum + t.platformFee, 0)
      const grossRevenue = transactions.reduce((sum: number, t: any) => sum + t.amount, 0)

      // Create tax report
      const taxReport: TaxReport = {
        mentorId,
        year,
        month,
        totalEarnings,
        platformFees,
        netEarnings: totalEarnings, // Net earnings after platform fees
        sessionsCount: transactions.length,
        transactions: transactions.map((t: any) => ({
          id: t.id,
          date: t.completedAt,
          sessionId: t.session.id,
          sessionDate: t.session.startTime,
          pricingType: t.session.pricingType,
          grossAmount: t.amount,
          platformFee: t.platformFee,
          netEarnings: t.mentorEarnings,
          mentee: t.session.mentee.name,
        })),
      }

      // Log tax report generation
      await createAuditLog({
        userId: mentorId,
        action: 'TAX_REPORT_GENERATED',
        resource: 'tax_report',
        details: {
          year,
          month,
          totalEarnings,
          sessionsCount: transactions.length,
        },
      })

      return taxReport

    } catch (error) {
      console.error('Generate tax report error:', error)
      throw error
    }
  }

  // Generate annual tax report
  async generateAnnualTaxReport(mentorId: string, year: number): Promise<TaxReport> {
    try {
      const startDate = new Date(year, 0, 1)
      const endDate = new Date(year, 11, 31, 23, 59, 59)

      // Get all transactions for the year
      const transactions = await prisma.transaction.findMany({
        where: {
          session: {
            mentorId,
          },
          status: 'COMPLETED',
          completedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          session: {
            select: {
              id: true,
              startTime: true,
              pricingType: true,
              mentee: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      })

      // Calculate totals
      const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
      const platformFees = transactions.reduce((sum: number, t: any) => sum + t.platformFee, 0)

      // Create annual tax report
      const taxReport: TaxReport = {
        mentorId,
        year,
        totalEarnings,
        platformFees,
        netEarnings: totalEarnings,
        sessionsCount: transactions.length,
        transactions: transactions.map((t: any) => ({
          id: t.id,
          date: t.completedAt,
          sessionId: t.session.id,
          sessionDate: t.session.startTime,
          pricingType: t.session.pricingType,
          grossAmount: t.amount,
          platformFee: t.platformFee,
          netEarnings: t.mentorEarnings,
          mentee: t.session.mentee.name,
        })),
      }

      // Log annual tax report generation
      await createAuditLog({
        userId: mentorId,
        action: 'ANNUAL_TAX_REPORT_GENERATED',
        resource: 'tax_report',
        details: {
          year,
          totalEarnings,
          sessionsCount: transactions.length,
        },
      })

      return taxReport

    } catch (error) {
      console.error('Generate annual tax report error:', error)
      throw error
    }
  }

  // Get earnings history with pagination
  async getEarningsHistory(mentorId: string, params: {
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
    pricingType?: string
  } = {}) {
    try {
      const { page = 1, limit = 20, startDate, endDate, pricingType } = params
      const skip = (page - 1) * limit

      const where: any = {
        session: {
          mentorId,
        },
        status: 'COMPLETED',
      }

      if (startDate || endDate) {
        where.completedAt = {}
        if (startDate) where.completedAt.gte = startDate
        if (endDate) where.completedAt.lte = endDate
      }

      if (pricingType) {
        where.session.pricingType = pricingType
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            session: {
              include: {
                mentee: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { completedAt: 'desc' },
        }),
        prisma.transaction.count({ where }),
      ])

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }

    } catch (error) {
      console.error('Get earnings history error:', error)
      throw error
    }
  }

  // Private helper methods

  private async calculateProjectedEarnings(mentorId: string): Promise<number> {
    try {
      // Get last 30 days of earnings
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      const recentTransactions = await prisma.transaction.findMany({
        where: {
          session: {
            mentorId,
          },
          status: 'COMPLETED',
          completedAt: {
            gte: thirtyDaysAgo,
          },
        },
      })

      if (recentTransactions.length === 0) return 0

      // Calculate daily average
      const totalEarnings = recentTransactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
      const dailyAverage = totalEarnings / 30

      // Project monthly earnings (30 days)
      return dailyAverage * 30

    } catch (error) {
      console.error('Calculate projected earnings error:', error)
      return 0
    }
  }

  private async getAvailableTransactionsForPayout(mentorId: string, requestedAmount: number) {
    try {
      // Get transactions not yet included in payouts
      const payouts = await prisma.mentorPayout.findMany({
        where: { mentorId },
        select: { transactionIds: true },
      })

      const payoutTransactionIds = payouts.flatMap((p: any) => p.transactionIds)

      const availableTransactions = await prisma.transaction.findMany({
        where: {
          session: {
            mentorId,
          },
          status: 'COMPLETED',
          id: {
            notIn: payoutTransactionIds,
          },
        },
        orderBy: { completedAt: 'asc' },
      })

      // Select transactions up to requested amount
      let totalAmount = 0
      const selectedTransactionIds: string[] = []

      for (const transaction of availableTransactions) {
        if (totalAmount >= requestedAmount) break
        
        totalAmount += (transaction as any).mentorEarnings
        selectedTransactionIds.push(transaction.id)
      }

      return {
        transactionIds: selectedTransactionIds,
        totalAmount,
      }

    } catch (error) {
      console.error('Get available transactions error:', error)
      throw error
    }
  }

  private async processScheduledPayout(payoutId: string) {
    try {
      // Update payout status to completed
      const payout = await prisma.mentorPayout.update({
        where: { id: payoutId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      })

      // Log payout completion
      await logPaymentAction({
        userId: payout.mentorId,
        action: 'PAYOUT_PROCESSED',
        amount: payout.amount,
        details: {
          payoutId: payout.id,
          type: 'scheduled_processing',
          processedAt: new Date().toISOString(),
        },
      })

      console.log(`Payout ${payoutId} processed successfully`)

    } catch (error) {
      console.error('Process scheduled payout error:', error)
      
      // Mark payout as failed
      await prisma.mentorPayout.update({
        where: { id: payoutId },
        data: { status: 'FAILED' },
      })
    }
  }

  private async updateMentorEarningsCache(mentorId: string) {
    try {
      // Update mentor profile with latest earnings data
      const earnings = await this.getRealTimeEarnings(mentorId)
      
      // In a real system, would update a cache or summary table
      // For now, we'll log the update
      await createAuditLog({
        userId: mentorId,
        action: 'EARNINGS_CACHE_UPDATED',
        resource: 'mentor_earnings',
        details: {
          totalEarnings: earnings.totalEarnings,
          availableForPayout: earnings.availableForPayout,
          sessionsCompleted: earnings.sessionsCompleted,
          updatedAt: new Date().toISOString(),
        },
      })

    } catch (error) {
      console.error('Update earnings cache error:', error)
    }
  }
}

// Export singleton instance
export const earningsService = new EarningsService()