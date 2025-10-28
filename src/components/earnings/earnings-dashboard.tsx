'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CreditCard,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/utils'

interface EarningsData {
  totalEarnings: number
  totalPayouts: number
  pendingEarnings: number
  monthlyEarnings: number
  transactionCount: number
  transactions: Array<{
    id: string
    amount: number
    mentorEarnings: number
    status: string
    completedAt: string
    session: {
      id: string
      startTime: string
      pricingType: string
      mentee: {
        name: string
      }
    }
  }>
  payouts: Array<{
    id: string
    amount: number
    status: string
    processedAt: string
    payoutMethod: string
  }>
}

export default function EarningsDashboard() {
  const { data: session } = useSession()
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestingPayout, setRequestingPayout] = useState(false)

  useEffect(() => {
    if (session) {
      fetchEarnings()
    }
  }, [session])

  const fetchEarnings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/mentor/earnings')
      const result = await response.json()

      if (response.ok) {
        setEarnings(result.earnings)
      } else {
        setError(result.error || 'Failed to fetch earnings')
      }
    } catch (err) {
      setError('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  const requestPayout = async () => {
    if (!earnings || earnings.pendingEarnings <= 0) return

    setRequestingPayout(true)
    try {
      const response = await fetch('/api/mentor/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: earnings.pendingEarnings,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Refresh earnings data
        fetchEarnings()
      } else {
        setError(result.error || 'Failed to request payout')
      }
    } catch (err) {
      setError('Failed to request payout')
    } finally {
      setRequestingPayout(false)
    }
  }

  const downloadReport = async (type: 'monthly' | 'yearly') => {
    try {
      const response = await fetch(`/api/mentor/earnings/report?type=${type}`)
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `earnings-report-${type}-${new Date().toISOString().slice(0, 7)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Failed to download report')
    }
  }

  if (!session) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please sign in to view your earnings.
        </AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!earnings) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load earnings data'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings Dashboard</h1>
        <p className="text-gray-600">
          Track your mentoring income and manage payouts
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earnings.totalEarnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earnings.monthlyEarnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earnings.pendingEarnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payouts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earnings.totalPayouts)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Request */}
      {earnings.pendingEarnings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request Payout</CardTitle>
            <CardDescription>
              You have {formatCurrency(earnings.pendingEarnings)} available for payout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Payouts are processed within 24 hours
                </p>
              </div>
              <Button 
                onClick={requestPayout}
                disabled={requestingPayout}
              >
                {requestingPayout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Payout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Reports</CardTitle>
          <CardDescription>
            Download detailed reports for tax purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => downloadReport('monthly')}>
              <Download className="mr-2 h-4 w-4" />
              Monthly Report
            </Button>
            <Button variant="outline" onClick={() => downloadReport('yearly')}>
              <Download className="mr-2 h-4 w-4" />
              Yearly Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed View */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest {earnings.transactions.length} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.transactions.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {earnings.transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium">
                            Session with {transaction.session.mentee.name}
                          </p>
                          <Badge variant="outline">
                            {transaction.session.pricingType.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDateTime(transaction.session.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(transaction.mentorEarnings)}
                        </p>
                        <p className="text-sm text-gray-500">
                          from {formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                Your recent payouts and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.payouts.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No payouts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {earnings.payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">
                            {formatCurrency(payout.amount)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatDateTime(payout.processedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">
                          {payout.status}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {payout.payoutMethod}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}