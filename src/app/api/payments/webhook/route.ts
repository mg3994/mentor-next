import { NextRequest, NextResponse } from 'next/server'
import { razorpayService, WebhookPayload } from '@/lib/razorpay-service'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      )
    }

    // Verify webhook signature
    const isSignatureValid = razorpayService.verifyWebhookSignature(rawBody, signature)
    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    const webhookPayload = JSON.parse(rawBody) as WebhookPayload

    // Log webhook received
    await createAuditLog({
      action: 'RAZORPAY_WEBHOOK_RECEIVED',
      resource: 'payment_webhook',
      details: {
        event: webhookPayload.event,
        entity: webhookPayload.entity,
        accountId: webhookPayload.account_id,
      },
    })

    // Process webhook
    await razorpayService.processWebhook(webhookPayload)

    return NextResponse.json({ success: true, message: 'Webhook processed' })

  } catch (error) {
    console.error('Razorpay webhook processing error:', error)
    
    // Log webhook error
    await createAuditLog({
      action: 'RAZORPAY_WEBHOOK_ERROR',
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

