import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReviewAnalyticsService, type ReviewModerationResult } from '@/lib/review-analytics'

// Moderate review content for inappropriate material
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content, title } = body

    if (!content || !title) {
      return NextResponse.json(
        { error: 'Content and title are required' },
        { status: 400 }
      )
    }

    // Perform content moderation
    const moderation = await moderateContent(title, content)

    return NextResponse.json({
      success: true,
      moderation
    })

  } catch (error) {
    console.error('Moderate review error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to moderate review',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Content moderation logic
async function moderateContent(title: string, content: string): Promise<ReviewModerationResult> {
  const flags: string[] = []
  let confidence = 1.0
  
  const text = `${title} ${content}`.toLowerCase()
  
  // Check for inappropriate language
  const inappropriateWords = [
    'spam', 'scam', 'fraud', 'fake', 'bot', 'terrible', 'awful', 'horrible',
    'worst', 'hate', 'stupid', 'idiot', 'moron', 'dumb'
  ]
  
  const profanity = [
    // Add actual profanity words here - keeping it clean for this example
    'badword1', 'badword2'
  ]
  
  // Check for spam indicators
  const spamIndicators = [
    /(.)\1{4,}/, // Repeated characters (aaaaa)
    /[A-Z]{10,}/, // Excessive caps
    /\b\d{10,}\b/, // Long numbers (phone numbers)
    /https?:\/\//, // URLs
    /@\w+\.(com|org|net)/, // Email addresses
  ]
  
  // Check inappropriate words
  inappropriateWords.forEach(word => {
    if (text.includes(word)) {
      flags.push(`Contains inappropriate language: "${word}"`)
      confidence -= 0.2
    }
  })
  
  // Check profanity
  profanity.forEach(word => {
    if (text.includes(word)) {
      flags.push('Contains profanity')
      confidence -= 0.4
    }
  })
  
  // Check spam indicators
  spamIndicators.forEach((pattern, index) => {
    if (pattern.test(text)) {
      const indicators = [
        'Repeated characters detected',
        'Excessive capitalization',
        'Contains phone number',
        'Contains URL',
        'Contains email address'
      ]
      flags.push(indicators[index])
      confidence -= 0.3
    }
  })
  
  // Check content length and quality
  if (content.length < 10) {
    flags.push('Content too short')
    confidence -= 0.2
  }
  
  if (content.length > 2000) {
    flags.push('Content unusually long')
    confidence -= 0.1
  }
  
  // Check for review bombing (same content pattern)
  const wordCount = text.split(' ').length
  const uniqueWords = new Set(text.split(' ')).size
  const uniqueRatio = uniqueWords / wordCount
  
  if (uniqueRatio < 0.3 && wordCount > 10) {
    flags.push('Repetitive content detected')
    confidence -= 0.3
  }
  
  // Ensure confidence doesn't go below 0
  confidence = Math.max(0, confidence)
  
  // Determine if content is appropriate
  const isAppropriate = confidence > 0.5 && flags.length === 0
  
  // Suggest action based on analysis
  let suggestedAction: 'approve' | 'review' | 'reject'
  if (confidence > 0.8 && flags.length === 0) {
    suggestedAction = 'approve'
  } else if (confidence > 0.3) {
    suggestedAction = 'review'
  } else {
    suggestedAction = 'reject'
  }
  
  return {
    isAppropriate,
    confidence: Math.round(confidence * 100) / 100,
    flags,
    suggestedAction
  }
}