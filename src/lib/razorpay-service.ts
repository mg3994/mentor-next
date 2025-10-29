// Razorpay Payment Service
// This service handles all Razorpay API interactions for UPI and Google Pay payments

import {
  RAZORPAY_CONFIG,
  RAZORPAY_ENDPOINTS,
  DEFAULT_ORDER_CONFIG,
  convertToRazorpayAmount,
  convertFromRazorpayAmount,
  generateReceiptId,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  handleRazorpayError,
  validateRazorpayConfig,
} from './razorpay-config'
import { logPaymentAction } from './db-utils'

// Razorpay API interfaces
export interface RazorpayOrder {
  id: string
  entity: 'order'
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: 'created' | 'attempted' | 'paid'
  attempts: number
  notes: Record<string, string>
  created_at: number
}

export interface RazorpayPayment {
  id: string
  entity: 'payment'
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  order_id: string
  method: string
  amount_refunded: number
  refund_status: string | null
  captured: boolean
  description: string
  card_id?: string
  bank?: string
  wallet?: string
  vpa?: string
  email: string
  contact: string
  notes: Record<string, string>
  fee?: number
  tax?: number
  error_code?: string
  error_description?: string
  created_at: number
}

export interface CreateOrderParams {
  amount: number // in rupees
  currency?: string
  receipt?: string
  notes?: Record<string, string>
  sessionId: string
  userId: string
  description: string
}

export interface PaymentVerificationParams {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface WebhookPayload {
  entity: string
  account_id: string
  event: string
  contains: string[]
  payload: {
    payment?: {
      entity: RazorpayPayment
    }
    order?: {
      entity: RazorpayOrder
    }
  }
  created_at: number
}

export class RazorpayService {
  private baseUrl: string
  private auth: string

  constructor() {
    // Validate configuration
    const validation = validateRazorpayConfig()
    if (!validation.valid) {
      throw new Error(`Razorpay configuration invalid: ${validation.errors.join(', ')}`)
    }

    this.baseUrl = RAZORPAY_CONFIG.baseUrl
    this.auth = Buffer.from(
      `${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`
    ).toString('base64')
  }

  /**
   * Create a new payment order
   */
  async createOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
    try {
      const { amount, currency = 'INR', sessionId, userId, description, notes = {} } = params

      const amountInPaise = convertToRazorpayAmount(amount)
      const receipt = generateReceiptId(sessionId)

      const orderData = {
        amount: amountInPaise,
        currency,
        receipt,
        notes: {
          sessionId,
          userId,
          description,
          ...notes,
        },
        ...DEFAULT_ORDER_CONFIG,
      }

      const response = await this.makeRequest('POST', RAZORPAY_ENDPOINTS.ORDERS, orderData)

      // Log order creation
      await logPaymentAction({
        userId,
        action: 'PAYMENT_CREATED',
        details: {
          orderId: response.id,
          amount: convertFromRazorpayAmount(response.amount),
          currency: response.currency,
          sessionId,
          receipt: response.receipt,
        },
      })

      return response as RazorpayOrder

    } catch (error) {
      console.error('Razorpay create order error:', error)
      throw handleRazorpayError(error)
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(params: PaymentVerificationParams): boolean {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params

      return verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        RAZORPAY_CONFIG.keySecret
      )

    } catch (error) {
      console.error('Payment signature verification error:', error)
      return false
    }
  }

  /**
   * Fetch payment details
   */
  async getPayment(paymentId: string): Promise<RazorpayPayment> {
    try {
      const response = await this.makeRequest('GET', `${RAZORPAY_ENDPOINTS.PAYMENTS}/${paymentId}`)
      return response as RazorpayPayment

    } catch (error) {
      console.error('Get payment error:', error)
      throw handleRazorpayError(error)
    }
  }

  /**
   * Fetch order details
   */
  async getOrder(orderId: string): Promise<RazorpayOrder> {
    try {
      const response = await this.makeRequest('GET', `${RAZORPAY_ENDPOINTS.ORDERS}/${orderId}`)
      return response as RazorpayOrder

    } catch (error) {
      console.error('Get order error:', error)
      throw handleRazorpayError(error)
    }
  }

  /**
   * Capture authorized payment
   */
  async capturePayment(paymentId: string, amount?: number): Promise<RazorpayPayment> {
    try {
      const captureData: any = {}
      
      if (amount) {
        captureData.amount = convertToRazorpayAmount(amount)
      }

      const response = await this.makeRequest(
        'POST',
        `${RAZORPAY_ENDPOINTS.PAYMENTS}/${paymentId}/capture`,
        captureData
      )

      return response as RazorpayPayment

    } catch (error) {
      console.error('Capture payment error:', error)
      throw handleRazorpayError(error)
    }
  }

  /**
   * Create refund
   */
  async createRefund(paymentId: string, amount?: number, notes?: Record<string, string>) {
    try {
      const refundData: any = {
        payment_id: paymentId,
      }

      if (amount) {
        refundData.amount = convertToRazorpayAmount(amount)
      }

      if (notes) {
        refundData.notes = notes
      }

      const response = await this.makeRequest('POST', RAZORPAY_ENDPOINTS.REFUNDS, refundData)
      return response

    } catch (error) {
      console.error('Create refund error:', error)
      throw handleRazorpayError(error)
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      return verifyWebhookSignature(payload, signature, RAZORPAY_CONFIG.webhookSecret)
    } catch (error) {
      console.error('Webhook signature verification error:', error)
      return false
    }
  }

  /**
   * Process webhook payload
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    try {
      const { event, payload: webhookPayload } = payload

      switch (event) {
        case 'payment.authorized':
          await this.handlePaymentAuthorized(webhookPayload.payment?.entity)
          break

        case 'payment.captured':
          await this.handlePaymentCaptured(webhookPayload.payment?.entity)
          break

        case 'payment.failed':
          await this.handlePaymentFailed(webhookPayload.payment?.entity)
          break

        case 'order.paid':
          await this.handleOrderPaid(webhookPayload.order?.entity)
          break

        default:
          console.warn('Unhandled webhook event:', event)
      }

    } catch (error) {
      console.error('Webhook processing error:', error)
      throw error
    }
  }

  /**
   * Make HTTP request to Razorpay API
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      }

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data)
      }

      const response = await fetch(url, options)
      const responseData = await response.json()

      if (!response.ok) {
        throw {
          statusCode: response.status,
          error: responseData,
          message: responseData.error?.description || 'Razorpay API error',
        }
      }

      return responseData

    } catch (error) {
      console.error('Razorpay API request error:', error)
      throw error
    }
  }

  /**
   * Handle payment authorized webhook
   */
  private async handlePaymentAuthorized(payment?: RazorpayPayment): Promise<void> {
    if (!payment) return

    await logPaymentAction({
      action: 'PAYMENT_CREATED',
      details: {
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: convertFromRazorpayAmount(payment.amount),
        method: payment.method,
        status: 'authorized',
      },
    })
  }

  /**
   * Handle payment captured webhook
   */
  private async handlePaymentCaptured(payment?: RazorpayPayment): Promise<void> {
    if (!payment) return

    await logPaymentAction({
      action: 'PAYMENT_COMPLETED',
      details: {
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: convertFromRazorpayAmount(payment.amount),
        method: payment.method,
        fee: payment.fee ? convertFromRazorpayAmount(payment.fee) : 0,
        status: 'captured',
      },
    })
  }

  /**
   * Handle payment failed webhook
   */
  private async handlePaymentFailed(payment?: RazorpayPayment): Promise<void> {
    if (!payment) return

    await logPaymentAction({
      action: 'PAYMENT_FAILED',
      details: {
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: convertFromRazorpayAmount(payment.amount),
        method: payment.method,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
      },
    })
  }

  /**
   * Handle order paid webhook
   */
  private async handleOrderPaid(order?: RazorpayOrder): Promise<void> {
    if (!order) return

    await logPaymentAction({
      action: 'PAYMENT_COMPLETED',
      details: {
        orderId: order.id,
        amount: convertFromRazorpayAmount(order.amount),
        amountPaid: convertFromRazorpayAmount(order.amount_paid),
        receipt: order.receipt,
        status: 'order_paid',
      },
    })
  }
}

// Export singleton instance
export const razorpayService = new RazorpayService()