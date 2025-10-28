import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, WebhookPayload } from '@/lib/payment-utils'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WebhookPayload
    
    // Verify webhook signature
    if (!verifyWebhookSignature(body)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    const { eventType, transactionId, gatewayTransactionId, amount, paymentMethod } = body

    // Log webhook received
    await createAuditLog({
      action: 'WEBHOOK_RECEIVED',
      resource: 'payment_webhook',
      details: {
        eventType,
        transactionId,
        gatewayTransactionId,
        amount,
        paymentMethod,
      },
    })

    // Handle different webhook events
    switch (eventType) {
      case 'payment.success':
        await handlePaymentSuccess(transactionId, gatewayTransactionId)
        break
        
      case 'payment.failed':
        await handlePaymentFailure(transactionId, gatewayTransactionId)
        break
        
      case 'payment.pending':
        await handlePaymentPending(transactionId, gatewayTransactionId)
        break
        
      default:
        console.warn('Unknown webhook event type:', eventType)
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' })

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Log webhook error
    await createAuditLog({
      action: 'WEBHOOK_ERROR',
      resource: 'payment_webhook',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSuccess(transactionId: string, gatewayTransactionId: string) {
  try {
    // Update transaction status
    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    // Log success
    await createAuditLog({
      action: 'PAYMENT_WEBHOOK_SUCCESS',
      resource: 'transaction',
      details: {
        transactionId,
        gatewayTransactionId,
        amount: transaction.amount,
      },
    })

    console.log('Payment success processed:', transactionId)
  } catch (error) {
    console.error('Error handling payment success:', error)
    throw error
  }
}

async function handlePaymentFailure(transactionId: string, gatewayTransactionId: string) {
  try {
    // Update transaction status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'FAILED',
      },
    })

    // Log failure
    await createAuditLog({
      action: 'PAYMENT_WEBHOOK_FAILURE',
      resource: 'transaction',
      details: {
        transactionId,
        gatewayTransactionId,
        reason: 'Payment failed via webhook',
      },
    })

    console.log('Payment failure processed:', transactionId)
  } catch (error) {
    console.error('Error handling payment failure:', error)
    throw error
  }
}

async function handlePaymentPending(transactionId: string, gatewayTransactionId: string) {
  try {
    // Log pending status
    await createAuditLog({
      action: 'PAYMENT_WEBHOOK_PENDING',
      resource: 'transaction',
      details: {
        transactionId,
        gatewayTransactionId,
        status: 'pending',
      },
    })

    console.log('Payment pending processed:', transactionId)
  } catch (error) {
    console.error('Error handling payment pending:', error)
    throw error
  }
}