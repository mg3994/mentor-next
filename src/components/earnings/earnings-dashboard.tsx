'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Download,
  CreditCard,
  Clock,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface EarningsAnalytics {
  totalEarnings: number
  monthlyEarnings: number
  weeklyEarnings: number
  dailyEarnings: number
  sessionCount: number
  averageSessionEarning: number
  topPerformingDays: Array<{ date: string; earnings: number }>
  earningsTrend: Array<{ period: string; earnings: number }>
  paymentMethodBreakdown: Array<{ method: string; earnings: number; count: number }>
  pricingModelBreakdown: Array<{ type: string; earnings: number; count: number }>
  subscriptionMetrics: {
    activeSubscriptions: number
    monthlyRecurringRevenue: number
    churnRate: number
    averageSubscriptionValue: number
  }
  hourlyMetrics: {
    totalHours: number
    averageHourlyRate: number
    utilizationRate: number
  }
}

interface PayoutAnalytics {
  totalPayouts: number
  pendingPayouts: number
  completedPayouts: number
  averagePayoutAmount: number
  payoutFrequency: string
  nextPayoutDate: Date | null
  payoutHistory: Array<{
    date: Date
    amount: number
    status: string
    method: string
  }>
}

interface EarningsComparison {
  currentPeriod: number
  previousPeriod: number
  growthRate: number
  growthAmount: number
}

export default function EarningsDashboard() {
  const [analytics, setAnalytics] = useState<EarningsAnalytics | null>(null)
  const [payoutAnalytics, setPayoutAnalytics] = useState<PayoutAnalytics | null>(null)
  const [comparison, setComparison] = useState<EarningsComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [showComparison, setShowComparison] = useState(true)

  useEffect(() => {
    fetchEarningsData()
  }, [selectedPeriod, showComparison])

  const fetchEarningsData = async () => {
    try {
      setLoading(true)
      
      // Fetch analytics with comparison
      const analyticsResponse = await fetch(`/api/earnings/analytics?compare=${showComparison}`)
      if (!analyticsResponse.ok) {
        throw new Error('Failed to fetch earnings analytics')
      }
      const analyticsData = await analyticsResponse.json()
      
      // Fetch payout analytics
      const payoutResponse = await fetch('/api/earnings/payout-analytics')
      if (!payoutResponse.ok) {
        throw new Error('Failed to fetch payout analytics')
      }
      const payoutData = await payoutResponse.json()
      
      setAnalytics(analyticsData.analytics)
      setComparison(analyticsData.comparison)
      setPayoutAnalytics(payoutData.payoutAnalytics)
    } catch (error) {
      console.error('Error fetching earnings:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadTaxReport = async (year: number) => {
    try {
      const response = await fetch(`/api/earnings/tax-reports?year=${year}`)
      if (!response.ok) {
        throw new Error('Failed to generate tax report')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tax-report-${year}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading tax report:', error)
    }
  }

  const requestPayout = async () => {
    try {
      const response = await fetch('/api/earnings/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to request payout')
      }
      
      // Refresh data
      fetchEarningsData()
    } catch (error) {
      console.error('Error requesting payout:', error)
    }
  }

  // Chart configurations
  const earningsTrendData = {
    labels: analytics?.earningsTrend.map(item => item.period) || [],
    datasets: [
      {
        label: 'Earnings',
        data: analytics?.earningsTrend.map(item => item.earnings) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  }

  const paymentMethodData = {
    labels: analytics?.paymentMethodBreakdown.map(item => item.method) || [],
    datasets: [
      {
        data: analytics?.paymentMethodBreakdown.map(item => item.earnings) || [],
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
        ],
      },
    ],
  }

  const pricingModelData = {
    labels: analytics?.pricingModelBreakdown.map(item => item.type) || [],
    datasets: [
      {
        label: 'Earnings by Model',
        data: analytics?.pricingModelBreakdown.map(item => item.earnings) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const getGrowthIcon = (rate: number) => {
    if (rate > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />
    if (rate < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getGrowthColor = (rate: number) => {
    if (rate > 0) return 'text-green-500'
    if (rate < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No earnings data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings Dashboard</h1>
          <p className="text-muted-foreground">
            Track your mentoring income and manage payouts
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => downloadTaxReport(new Date().getFullYear())}>
            <Download className="mr-2 h-4 w-4" />
            Tax Report
          </Button>
          {payoutAnalytics && payoutAnalytics.pendingPayouts > 0 && (
            <Button onClick={requestPayout}>
              Request Payout ({formatCurrency(payoutAnalytics.pendingPayouts)})
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.totalEarnings)}
            </div>
            {comparison && (
              <div className="flex items-center text-xs text-muted-foreground">
                {getGrowthIcon(comparison.growthRate)}
                <span className={getGrowthColor(comparison.growthRate)}>
                  {comparison.growthRate > 0 ? '+' : ''}{comparison.growthRate.toFixed(1)}%
                </span>
                <span className="ml-1">from last period</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.monthlyEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Current month progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payoutAnalytics?.pendingPayouts || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {payoutAnalytics?.nextPayoutDate 
                ? `Next payout: ${new Date(payoutAnalytics.nextPayoutDate).toLocaleDateString()}`
                : 'No pending payouts'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.sessionCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(analytics.averageSessionEarning)} per session
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Earnings Trend</CardTitle>
                <CardDescription>
                  Your earnings over the last 12 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <Line 
                    data={earningsTrendData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return '₹' + value.toLocaleString()
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Days</CardTitle>
                <CardDescription>
                  Your highest earning days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topPerformingDays.slice(0, 5).map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <span className="text-sm">
                          {new Date(day.date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(day.earnings)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.weeklyEarnings)}
                </div>
                <p className="text-xs text-muted-foreground">
                  This week's total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.dailyEarnings)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Today's total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hourly Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.hourlyMetrics.averageHourlyRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average per hour
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Earnings breakdown by payment method
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <Doughnut 
                    data={paymentMethodData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return context.label + ': ₹' + context.parsed.toLocaleString()
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing Models</CardTitle>
                <CardDescription>
                  Earnings by pricing model type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <Bar 
                    data={pricingModelData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return '₹' + value.toLocaleString()
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hourly Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Hours</span>
                    <span className="font-medium">{analytics.hourlyMetrics.totalHours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Rate</span>
                    <span className="font-medium">{formatCurrency(analytics.hourlyMetrics.averageHourlyRate)}/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Utilization</span>
                    <span className="font-medium">{(analytics.hourlyMetrics.utilizationRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.paymentMethodBreakdown.map((method) => (
                    <div key={method.method} className="flex justify-between">
                      <span className="text-sm capitalize">{method.method}</span>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(method.earnings)}</div>
                        <div className="text-xs text-muted-foreground">{method.count} transactions</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing Models</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.pricingModelBreakdown.map((model) => (
                    <div key={model.type} className="flex justify-between">
                      <span className="text-sm capitalize">{model.type}</span>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(model.earnings)}</div>
                        <div className="text-xs text-muted-foreground">{model.count} sessions</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Metrics</CardTitle>
                <CardDescription>
                  Your subscription-based earnings overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Subscriptions</span>
                    <span className="text-2xl font-bold">{analytics.subscriptionMetrics.activeSubscriptions}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monthly Recurring Revenue</span>
                    <span className="text-xl font-semibold">
                      {formatCurrency(analytics.subscriptionMetrics.monthlyRecurringRevenue)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Subscription Value</span>
                    <span className="font-medium">
                      {formatCurrency(analytics.subscriptionMetrics.averageSubscriptionValue)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Churn Rate</span>
                    <span className="font-medium">
                      {(analytics.subscriptionMetrics.churnRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Growth</CardTitle>
                <CardDescription>
                  Track your subscription growth over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      +{analytics.subscriptionMetrics.activeSubscriptions}
                    </div>
                    <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Growth Target</span>
                      <span>75%</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    Great progress! Keep building relationships with your mentees.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payout Summary</CardTitle>
                <CardDescription>
                  Overview of your payout history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Payouts</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(payoutAnalytics?.totalPayouts || 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending Amount</span>
                    <span className="text-xl font-semibold text-yellow-600">
                      {formatCurrency(payoutAnalytics?.pendingPayouts || 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Payout</span>
                    <span className="font-medium">
                      {formatCurrency(payoutAnalytics?.averagePayoutAmount || 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payout Frequency</span>
                    <span className="font-medium capitalize">
                      {payoutAnalytics?.payoutFrequency || 'Weekly'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Payouts</CardTitle>
                <CardDescription>
                  Your latest payout transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payoutAnalytics?.payoutHistory.slice(0, 5).map((payout, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant={payout.status === 'COMPLETED' ? 'default' : 'secondary'}>
                          {payout.status}
                        </Badge>
                        <span className="text-sm">
                          {new Date(payout.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(payout.amount)}</div>
                        <div className="text-xs text-muted-foreground">{payout.method}</div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-muted-foreground">
                      No payout history available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Reports</CardTitle>
              <CardDescription>
                Download detailed tax reports for your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Current Year ({new Date().getFullYear()})</h4>
                  <Button 
                    variant="outline" 
                    onClick={() => downloadTaxReport(new Date().getFullYear())}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download {new Date().getFullYear()} Tax Report
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Previous Year ({new Date().getFullYear() - 1})</h4>
                  <Button 
                    variant="outline" 
                    onClick={() => downloadTaxReport(new Date().getFullYear() - 1)}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download {new Date().getFullYear() - 1} Tax Report
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Tax reports include all your earnings, deductions, and transaction details 
                  formatted for easy tax filing. Reports are generated in PDF format.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}