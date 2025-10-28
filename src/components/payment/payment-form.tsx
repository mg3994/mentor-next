'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Smartphone, 
  Wallet, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Lock
} from 'lucide-react'
import { formatCurrency } from '@/utils'

interface PaymentMethod {
  id: string
  name: string
  description: string
  icon: string
}

interface PaymentFormProps {
  sessionId: string
  amount: number
  onSuccess: (transactionId: string) => void
  onError: (error: string) => void
}

const paymentIcons: Record<string, React.ComponentType<any>> = {
  platform_credit: Wallet,
  demo_card: CreditCard,
  demo_upi: Smartphone,
}

export default function PaymentForm({ sessionId, amount, onSuccess, onError }: PaymentFormProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Demo card details
  const [cardNumber, setCardNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvv, setCvv] = useState('')
  const [cardName, setCardName] = useState('')

  // Demo UPI details
  const [upiId, setUpiId] = useState('')

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const fetchPaymentMethods = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/payments/methods')
      const result = await response.json()

      if (response.ok) {
        setPaymentMethods(result.paymentMethods)
        if (result.paymentMethods.length > 0) {
          setSelectedMethod(result.paymentMethods[0].id)
        }
      } else {
        setError(result.error || 'Failed to load payment methods')
      }
    } catch (err) {
      setError('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const processPayment = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method')
      return
    }

    // Validate demo inputs
    if (selectedMethod === 'demo_card') {
      if (!cardNumber || !expiryDate || !cvv || !cardName) {
        setError('Please fill in all card details')
        return
      }
      if (cardNumber.replace(/\s/g, '').length !== 16) {
        setError('Please enter a valid 16-digit card number')
        return
      }
    }

    if (selectedMethod === 'demo_upi') {
      if (!upiId) {
        setError('Please enter your UPI ID')
        return
      }
      if (!upiId.includes('@')) {
        setError('Please enter a valid UPI ID')
        return
      }
    }

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          amount,
          paymentMethod: selectedMethod,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onSuccess(result.transaction.id)
      } else {
        onError(result.error || 'Payment processing failed')
      }
    } catch (err) {
      onError('Payment processing failed')
    } finally {
      setProcessing(false)
    }
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lock className="h-5 w-5" />
          <span>Secure Payment</span>
        </CardTitle>
        <CardDescription>
          Complete your payment to confirm the session booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Amount */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Total Amount:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(amount)}
            </span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-3">
          <Label>Select Payment Method</Label>
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const IconComponent = paymentIcons[method.id] || CreditCard
              return (
                <div
                  key={method.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedMethod === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <div className="flex items-center space-x-3">
                    <IconComponent className="h-6 w-6 text-gray-600" />
                    <div>
                      <div className="font-medium">{method.name}</div>
                      <div className="text-sm text-gray-600">{method.description}</div>
                    </div>
                    {method.id === 'platform_credit' && (
                      <Badge variant="secondary">Demo</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Method Details */}
        {selectedMethod === 'demo_card' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">Card Details</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardName">Cardholder Name</Label>
                <Input
                  id="cardName"
                  placeholder="John Doe"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                    maxLength={3}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'demo_upi' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">UPI Details</h4>
            <div className="space-y-2">
              <Label htmlFor="upiId">UPI ID</Label>
              <Input
                id="upiId"
                placeholder="yourname@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
            </div>
          </div>
        )}

        {selectedMethod === 'platform_credit' && (
          <div className="border-t pt-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                This is a demo payment using platform credits. No actual payment will be processed.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Payment Button */}
        <Button 
          onClick={processPayment} 
          disabled={processing || !selectedMethod}
          className="w-full"
          size="lg"
        >
          {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {processing ? 'Processing Payment...' : `Pay ${formatCurrency(amount)}`}
        </Button>

        {/* Security Notice */}
        <div className="text-center text-sm text-gray-500">
          <Lock className="h-4 w-4 inline mr-1" />
          Your payment information is secure and encrypted
        </div>
      </CardContent>
    </Card>
  )
}