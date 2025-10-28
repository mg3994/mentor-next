// Payment Gateway Configuration
// This file contains all payment-related configurations and settings

export interface PaymentGatewaySettings {
  name: string
  enabled: boolean
  testMode: boolean
  apiVersion: string
  supportedCurrencies: string[]
  supportedCountries: string[]
  webhookEndpoint: string
  maxRetries: number
  timeoutMs: number
}

export const PAYMENT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  name: 'Internal Payment System',
  enabled: true,
  testMode: process.env.NODE_ENV !== 'production',
  apiVersion: 'v1',
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR'],
  supportedCountries: ['US', 'CA', 'GB', 'IN', 'AU'],
  webhookEndpoint: '/api/payments/webhook',
  maxRetries: 3,
  timeoutMs: 30000,
}

// Payment method configurations
export interface PaymentMethodConfig {
  id: string
  name: string
  type: 'card' | 'wallet' | 'bank' | 'crypto' | 'other'
  enabled: boolean
  processingFee: number
  minAmount: number
  maxAmount: number
  currencies: string[]
  countries: string[]
  requiresVerification: boolean
  instantSettlement: boolean
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'card',
    name: 'Credit/Debit Card',
    type: 'card',
    enabled: true,
    processingFee: 0.029, // 2.9%
    minAmount: 1,
    maxAmount: 10000,
    currencies: ['USD', 'EUR', 'GBP'],
    countries: ['US', 'CA', 'GB', 'AU'],
    requiresVerification: true,
    instantSettlement: false,
  },
  {
    id: 'upi',
    name: 'UPI Payment',
    type: 'wallet',
    enabled: true,
    processingFee: 0.0,
    minAmount: 1,
    maxAmount: 5000,
    currencies: ['INR'],
    countries: ['IN'],
    requiresVerification: false,
    instantSettlement: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'wallet',
    enabled: true,
    processingFee: 0.034, // 3.4%
    minAmount: 1,
    maxAmount: 10000,
    currencies: ['USD', 'EUR', 'GBP'],
    countries: ['US', 'CA', 'GB', 'AU'],
    requiresVerification: true,
    instantSettlement: false,
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    type: 'wallet',
    enabled: true,
    processingFee: 0.025, // 2.5%
    minAmount: 1,
    maxAmount: 2000,
    currencies: ['USD', 'INR'],
    countries: ['US', 'IN'],
    requiresVerification: false,
    instantSettlement: true,
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    type: 'wallet',
    enabled: true,
    processingFee: 0.025, // 2.5%
    minAmount: 1,
    maxAmount: 2000,
    currencies: ['USD', 'EUR', 'GBP'],
    countries: ['US', 'CA', 'GB', 'AU'],
    requiresVerification: false,
    instantSettlement: true,
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    type: 'bank',
    enabled: true,
    processingFee: 0.01, // 1%
    minAmount: 10,
    maxAmount: 50000,
    currencies: ['USD', 'EUR', 'GBP', 'INR'],
    countries: ['US', 'CA', 'GB', 'IN', 'AU'],
    requiresVerification: true,
    instantSettlement: false,
  },
  {
    id: 'platform_credit',
    name: 'Platform Credit',
    type: 'other',
    enabled: true,
    processingFee: 0.0,
    minAmount: 1,
    maxAmount: 10000,
    currencies: ['USD', 'EUR', 'GBP', 'INR'],
    countries: ['US', 'CA', 'GB', 'IN', 'AU'],
    requiresVerification: false,
    instantSettlement: true,
  },
]

// Security configurations
export interface SecurityConfig {
  encryptionAlgorithm: string
  hashAlgorithm: string
  tokenExpiryMinutes: number
  maxFailedAttempts: number
  lockoutDurationMinutes: number
  requireTwoFactor: boolean
  allowedIpRanges?: string[]
}

export const SECURITY_CONFIG: SecurityConfig = {
  encryptionAlgorithm: 'AES-256-GCM',
  hashAlgorithm: 'SHA-256',
  tokenExpiryMinutes: 15,
  maxFailedAttempts: 3,
  lockoutDurationMinutes: 30,
  requireTwoFactor: false,
  allowedIpRanges: undefined, // Allow all IPs in development
}

// Webhook configurations
export interface WebhookConfig {
  enabled: boolean
  retryAttempts: number
  retryDelayMs: number
  timeoutMs: number
  signatureHeader: string
  eventTypes: string[]
}

export const WEBHOOK_CONFIG: WebhookConfig = {
  enabled: true,
  retryAttempts: 3,
  retryDelayMs: 5000,
  timeoutMs: 10000,
  signatureHeader: 'X-Payment-Signature',
  eventTypes: [
    'payment.success',
    'payment.failed',
    'payment.pending',
    'payment.cancelled',
    'refund.success',
    'refund.failed',
    'payout.success',
    'payout.failed',
  ],
}

// Risk management configurations
export interface RiskConfig {
  enabled: boolean
  maxDailyAmount: number
  maxMonthlyAmount: number
  velocityCheckEnabled: boolean
  fraudDetectionEnabled: boolean
  geoBlockingEnabled: boolean
  blockedCountries: string[]
  suspiciousAmountThreshold: number
}

export const RISK_CONFIG: RiskConfig = {
  enabled: true,
  maxDailyAmount: 5000,
  maxMonthlyAmount: 50000,
  velocityCheckEnabled: true,
  fraudDetectionEnabled: true,
  geoBlockingEnabled: false,
  blockedCountries: [],
  suspiciousAmountThreshold: 1000,
}

// Payout configurations
export interface PayoutConfig {
  enabled: boolean
  minAmount: number
  maxAmount: number
  processingFee: number
  schedules: {
    instant: boolean
    daily: boolean
    weekly: boolean
    monthly: boolean
  }
  workingDays: number[]
  cutoffHour: number
}

export const PAYOUT_CONFIG: PayoutConfig = {
  enabled: true,
  minAmount: 10,
  maxAmount: 10000,
  processingFee: 0.005, // 0.5%
  schedules: {
    instant: true,
    daily: true,
    weekly: true,
    monthly: true,
  },
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  cutoffHour: 17, // 5 PM
}

// Helper functions
export function getPaymentMethodById(id: string): PaymentMethodConfig | undefined {
  return PAYMENT_METHODS.find(method => method.id === id && method.enabled)
}

export function getPaymentMethodsByCountry(country: string): PaymentMethodConfig[] {
  return PAYMENT_METHODS.filter(
    method => method.enabled && method.countries.includes(country)
  )
}

export function getPaymentMethodsByCurrency(currency: string): PaymentMethodConfig[] {
  return PAYMENT_METHODS.filter(
    method => method.enabled && method.currencies.includes(currency)
  )
}

export function calculateProcessingFee(amount: number, paymentMethodId: string): number {
  const method = getPaymentMethodById(paymentMethodId)
  if (!method) return 0
  
  return amount * method.processingFee
}

export function validatePaymentAmount(
  amount: number,
  paymentMethodId: string,
  currency: string
): { valid: boolean; error?: string } {
  const method = getPaymentMethodById(paymentMethodId)
  
  if (!method) {
    return { valid: false, error: 'Payment method not found' }
  }
  
  if (!method.currencies.includes(currency)) {
    return { valid: false, error: 'Currency not supported for this payment method' }
  }
  
  if (amount < method.minAmount) {
    return { valid: false, error: `Minimum amount is ${method.minAmount} ${currency}` }
  }
  
  if (amount > method.maxAmount) {
    return { valid: false, error: `Maximum amount is ${method.maxAmount} ${currency}` }
  }
  
  return { valid: true }
}

// Environment-specific configurations
export function getEnvironmentConfig() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  return {
    apiBaseUrl: isProduction 
      ? process.env.PAYMENT_API_URL || 'https://api.mentorplatform.com'
      : 'http://localhost:3000',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret',
    encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY || 'dev-encryption-key',
    testMode: !isProduction,
    logLevel: isProduction ? 'error' : 'debug',
  }
}