// Razorpay Payment Gateway Configuration
// This file contains Razorpay-specific configurations for UPI and Google Pay support

export interface RazorpayConfig {
  keyId: string
  keySecret: string
  webhookSecret: string
  baseUrl: string
  apiVersion: string
  testMode: boolean
}

export const RAZORPAY_CONFIG: RazorpayConfig = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  baseUrl: 'https://api.razorpay.com/v1',
  apiVersion: 'v1',
  testMode: process.env.NODE_ENV !== 'production',
}

// Razorpay payment method configurations
export interface RazorpayPaymentMethod {
  id: string
  name: string
  type: 'card' | 'netbanking' | 'wallet' | 'upi' | 'emi'
  enabled: boolean
  minAmount: number // in paise (1 INR = 100 paise)
  maxAmount: number // in paise
  processingFee: number // percentage
  instantSettlement: boolean
  supportedBanks?: string[]
  walletProviders?: string[]
}

export const RAZORPAY_PAYMENT_METHODS: RazorpayPaymentMethod[] = [
  {
    id: 'upi',
    name: 'UPI Payment',
    type: 'upi',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 10000000, // ₹1,00,000
    processingFee: 0.0, // No processing fee for UPI
    instantSettlement: true,
  },
  {
    id: 'googlepay',
    name: 'Google Pay',
    type: 'wallet',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 10000000, // ₹1,00,000
    processingFee: 0.0, // No processing fee for Google Pay via UPI
    instantSettlement: true,
    walletProviders: ['googlepay'],
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    type: 'wallet',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 10000000, // ₹1,00,000
    processingFee: 0.0,
    instantSettlement: true,
    walletProviders: ['phonepe'],
  },
  {
    id: 'paytm',
    name: 'Paytm',
    type: 'wallet',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 10000000, // ₹1,00,000
    processingFee: 0.018, // 1.8% for Paytm wallet
    instantSettlement: false,
    walletProviders: ['paytm'],
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    type: 'card',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 15000000, // ₹1,50,000
    processingFee: 0.0236, // 2.36% for cards
    instantSettlement: false,
  },
  {
    id: 'netbanking',
    name: 'Net Banking',
    type: 'netbanking',
    enabled: true,
    minAmount: 100, // ₹1
    maxAmount: 15000000, // ₹1,50,000
    processingFee: 0.019, // 1.9% for net banking
    instantSettlement: false,
    supportedBanks: [
      'HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'YES', 'INDUSIND',
      'BOB', 'PNB', 'CANARA', 'UNION', 'IOB', 'FEDERAL', 'RBL'
    ],
  },
]

// Razorpay webhook event types
export const RAZORPAY_WEBHOOK_EVENTS = {
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CAPTURED: 'payment.captured',
  ORDER_PAID: 'order.paid',
  REFUND_CREATED: 'refund.created',
  REFUND_PROCESSED: 'refund.processed',
  SETTLEMENT_PROCESSED: 'settlement.processed',
} as const

// Razorpay order configuration
export interface RazorpayOrderConfig {
  currency: string
  receipt: string
  notes?: Record<string, string>
  partial_payment?: boolean
}

export const DEFAULT_ORDER_CONFIG: Partial<RazorpayOrderConfig> = {
  currency: 'INR',
  partial_payment: false,
}

// UPI configuration
export interface UPIConfig {
  enabled: boolean
  flow: 'collect' | 'intent'
  expiry_time: number // in minutes
  description: string
}

export const UPI_CONFIG: UPIConfig = {
  enabled: true,
  flow: 'intent', // Use intent flow for better UX
  expiry_time: 15, // 15 minutes expiry
  description: 'Mentor Platform Session Payment',
}

// Google Pay specific configuration
export interface GooglePayConfig {
  enabled: boolean
  merchant_id: string
  merchant_name: string
  gateway: string
  gateway_merchant_id: string
}

export const GOOGLE_PAY_CONFIG: GooglePayConfig = {
  enabled: true,
  merchant_id: process.env.GOOGLE_PAY_MERCHANT_ID || 'mentor-platform',
  merchant_name: 'Mentor Platform',
  gateway: 'razorpay',
  gateway_merchant_id: process.env.RAZORPAY_KEY_ID || '',
}

// Razorpay API endpoints
export const RAZORPAY_ENDPOINTS = {
  ORDERS: '/orders',
  PAYMENTS: '/payments',
  REFUNDS: '/refunds',
  SETTLEMENTS: '/settlements',
  WEBHOOKS: '/webhooks',
} as const

// Helper functions
export function validateRazorpayConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!RAZORPAY_CONFIG.keyId) {
    errors.push('RAZORPAY_KEY_ID environment variable is required')
  }

  if (!RAZORPAY_CONFIG.keySecret) {
    errors.push('RAZORPAY_KEY_SECRET environment variable is required')
  }

  if (!RAZORPAY_CONFIG.webhookSecret) {
    errors.push('RAZORPAY_WEBHOOK_SECRET environment variable is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function getRazorpayPaymentMethod(id: string): RazorpayPaymentMethod | undefined {
  return RAZORPAY_PAYMENT_METHODS.find(method => method.id === id && method.enabled)
}

export function getAvailablePaymentMethods(): RazorpayPaymentMethod[] {
  return RAZORPAY_PAYMENT_METHODS.filter(method => method.enabled)
}

export function convertToRazorpayAmount(amount: number): number {
  // Convert rupees to paise (Razorpay uses paise)
  return Math.round(amount * 100)
}

export function convertFromRazorpayAmount(amount: number): number {
  // Convert paise to rupees
  return amount / 100
}

export function calculateProcessingFee(amount: number, paymentMethodId: string): number {
  const method = getRazorpayPaymentMethod(paymentMethodId)
  if (!method) return 0

  const amountInPaise = convertToRazorpayAmount(amount)
  const feeInPaise = amountInPaise * method.processingFee
  return convertFromRazorpayAmount(feeInPaise)
}

export function validatePaymentAmount(amount: number, paymentMethodId: string): {
  valid: boolean
  error?: string
} {
  const method = getRazorpayPaymentMethod(paymentMethodId)
  
  if (!method) {
    return { valid: false, error: 'Payment method not supported' }
  }

  const amountInPaise = convertToRazorpayAmount(amount)

  if (amountInPaise < method.minAmount) {
    return { 
      valid: false, 
      error: `Minimum amount is ₹${convertFromRazorpayAmount(method.minAmount)}` 
    }
  }

  if (amountInPaise > method.maxAmount) {
    return { 
      valid: false, 
      error: `Maximum amount is ₹${convertFromRazorpayAmount(method.maxAmount)}` 
    }
  }

  return { valid: true }
}

// Generate receipt ID for Razorpay orders
export function generateReceiptId(sessionId: string): string {
  const timestamp = Date.now()
  return `session_${sessionId}_${timestamp}`
}

// Razorpay signature verification
export function generateRazorpaySignature(
  orderId: string,
  paymentId: string,
  secret: string
): string {
  const crypto = require('crypto')
  const body = orderId + '|' + paymentId
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateRazorpaySignature(orderId, paymentId, secret)
  return expectedSignature === signature
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return expectedSignature === signature
}

// Error handling
export class RazorpayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'RazorpayError'
  }
}

export function handleRazorpayError(error: any): RazorpayError {
  if (error.statusCode) {
    return new RazorpayError(
      error.error?.description || error.message || 'Razorpay API error',
      error.error?.code || 'RAZORPAY_ERROR',
      error.statusCode,
      error.error
    )
  }

  return new RazorpayError(
    error.message || 'Unknown Razorpay error',
    'UNKNOWN_ERROR',
    500,
    error
  )
}