// Review Notification Service
// Handles notifications for review-related events

export interface ReviewNotification {
  id: string
  type: ReviewNotificationType
  recipientId: string
  reviewId: string
  mentorId: string
  menteeId: string
  title: string
  message: string
  data: Record<string, any>
  isRead: boolean
  createdAt: Date
}

export type ReviewNotificationType = 
  | 'NEW_REVIEW'
  | 'REVIEW_UPDATED'
  | 'REVIEW_DELETED'
  | 'RATING_MILESTONE'
  | 'REVIEW_REMINDER'
  | 'REVIEW_MODERATION'

export interface NotificationPreferences {
  newReviews: boolean
  reviewUpdates: boolean
  ratingMilestones: boolean
  reviewReminders: boolean
  moderationAlerts: boolean
  emailNotifications: boolean
  pushNotifications: boolean
}

export class ReviewNotificationService {
  // Send notification for new review
  static async notifyNewReview(reviewId: string, mentorId: string, menteeId: string, rating: number): Promise<void> {
    try {
      const notification = {
        type: 'NEW_REVIEW' as const,
        recipientId: mentorId,
        reviewId,
        mentorId,
        menteeId,
        title: 'New Review Received',
        message: `You received a ${rating}-star review from a mentee`,
        data: { rating }
      }

      await this.createNotification(notification)
      await this.sendEmailNotification(notification)
      
    } catch (error) {
      console.error('Failed to send new review notification:', error)
    }
  }

  // Send notification for review update
  static async notifyReviewUpdated(reviewId: string, mentorId: string, menteeId: string, oldRating: number, newRating: number): Promise<void> {
    try {
      const notification = {
        type: 'REVIEW_UPDATED' as const,
        recipientId: mentorId,
        reviewId,
        mentorId,
        menteeId,
        title: 'Review Updated',
        message: `A review was updated from ${oldRating} to ${newRating} stars`,
        data: { oldRating, newRating }
      }

      await this.createNotification(notification)
      
    } catch (error) {
      console.error('Failed to send review update notification:', error)
    }
  }

  // Send notification for rating milestone
  static async notifyRatingMilestone(mentorId: string, milestone: number, totalReviews: number): Promise<void> {
    try {
      const notification = {
        type: 'RATING_MILESTONE' as const,
        recipientId: mentorId,
        reviewId: '',
        mentorId,
        menteeId: '',
        title: 'Rating Milestone Achieved!',
        message: `Congratulations! You've reached ${milestone} stars with ${totalReviews} reviews`,
        data: { milestone, totalReviews }
      }

      await this.createNotification(notification)
      await this.sendEmailNotification(notification)
      
    } catch (error) {
      console.error('Failed to send milestone notification:', error)
    }
  }

  // Send review reminder to mentee
  static async sendReviewReminder(sessionId: string, menteeId: string, mentorName: string): Promise<void> {
    try {
      const notification = {
        type: 'REVIEW_REMINDER' as const,
        recipientId: menteeId,
        reviewId: '',
        mentorId: '',
        menteeId,
        title: 'Review Reminder',
        message: `Don't forget to review your session with ${mentorName}`,
        data: { sessionId, mentorName }
      }

      await this.createNotification(notification)
      
    } catch (error) {
      console.error('Failed to send review reminder:', error)
    }
  }

  // Send moderation alert
  static async notifyModerationRequired(reviewId: string, mentorId: string, flags: string[]): Promise<void> {
    try {
      const notification = {
        type: 'REVIEW_MODERATION' as const,
        recipientId: 'admin', // Send to admin
        reviewId,
        mentorId,
        menteeId: '',
        title: 'Review Requires Moderation',
        message: `A review has been flagged for moderation: ${flags.join(', ')}`,
        data: { flags }
      }

      await this.createNotification(notification)
      await this.sendAdminAlert(notification)
      
    } catch (error) {
      console.error('Failed to send moderation notification:', error)
    }
  }

  // Create notification in database
  private static async createNotification(notification: Omit<ReviewNotification, 'id' | 'isRead' | 'createdAt'>): Promise<void> {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      })
    } catch (error) {
      console.error('Failed to create notification:', error)
    }
  }

  // Send email notification
  private static async sendEmailNotification(notification: Omit<ReviewNotification, 'id' | 'isRead' | 'createdAt'>): Promise<void> {
    try {
      // Check user preferences first
      const preferences = await this.getUserNotificationPreferences(notification.recipientId)
      
      if (!preferences.emailNotifications) {
        return
      }

      await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: notification.recipientId,
          subject: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data
        }),
      })
    } catch (error) {
      console.error('Failed to send email notification:', error)
    }
  }

  // Send admin alert
  private static async sendAdminAlert(notification: Omit<ReviewNotification, 'id' | 'isRead' | 'createdAt'>): Promise<void> {
    try {
      await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'REVIEW_MODERATION',
          priority: 'HIGH',
          title: notification.title,
          message: notification.message,
          data: notification.data
        }),
      })
    } catch (error) {
      console.error('Failed to send admin alert:', error)
    }
  }

  // Get user notification preferences
  static async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const response = await fetch(`/api/users/${userId}/notification-preferences`)
      
      if (!response.ok) {
        // Return default preferences if fetch fails
        return this.getDefaultNotificationPreferences()
      }
      
      const data = await response.json()
      return data.preferences
      
    } catch (error) {
      console.error('Failed to get notification preferences:', error)
      return this.getDefaultNotificationPreferences()
    }
  }

  // Update user notification preferences
  static async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      await fetch(`/api/users/${userId}/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      })
    } catch (error) {
      console.error('Failed to update notification preferences:', error)
      throw error
    }
  }

  // Get default notification preferences
  private static getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      newReviews: true,
      reviewUpdates: true,
      ratingMilestones: true,
      reviewReminders: true,
      moderationAlerts: true,
      emailNotifications: true,
      pushNotifications: false
    }
  }

  // Schedule review reminders
  static async scheduleReviewReminders(): Promise<void> {
    try {
      // Find completed sessions without reviews from the last 3 days
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      
      const response = await fetch('/api/sessions/without-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completedAfter: threeDaysAgo.toISOString(),
          reminderSent: false
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions without reviews')
      }
      
      const { sessions } = await response.json()
      
      // Send reminders for each session
      for (const session of sessions) {
        await this.sendReviewReminder(session.id, session.menteeId, session.mentorName)
        
        // Mark reminder as sent
        await fetch(`/api/sessions/${session.id}/reminder-sent`, {
          method: 'POST'
        })
      }
      
    } catch (error) {
      console.error('Failed to schedule review reminders:', error)
    }
  }

  // Check for rating milestones
  static async checkRatingMilestones(mentorId: string, newAverageRating: number, totalReviews: number): Promise<void> {
    try {
      const milestones = [4.0, 4.5, 4.8, 4.9, 5.0]
      
      // Get previous rating
      const response = await fetch(`/api/mentors/${mentorId}/previous-rating`)
      if (!response.ok) return
      
      const { previousRating } = await response.json()
      
      // Check if any milestone was crossed
      for (const milestone of milestones) {
        if (previousRating < milestone && newAverageRating >= milestone) {
          await this.notifyRatingMilestone(mentorId, milestone, totalReviews)
        }
      }
      
    } catch (error) {
      console.error('Failed to check rating milestones:', error)
    }
  }

  // Get notifications for user
  static async getUserNotifications(userId: string, limit: number = 20): Promise<ReviewNotification[]> {
    try {
      const response = await fetch(`/api/notifications?userId=${userId}&limit=${limit}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      
      const data = await response.json()
      return data.notifications
      
    } catch (error) {
      console.error('Failed to get user notifications:', error)
      return []
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await fetch(`/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }
}

// Utility functions

export function getNotificationIcon(type: ReviewNotificationType): string {
  switch (type) {
    case 'NEW_REVIEW': return '⭐'
    case 'REVIEW_UPDATED': return '✏️'
    case 'REVIEW_DELETED': return '🗑️'
    case 'RATING_MILESTONE': return '🎉'
    case 'REVIEW_REMINDER': return '⏰'
    case 'REVIEW_MODERATION': return '⚠️'
    default: return '📝'
  }
}

export function getNotificationColor(type: ReviewNotificationType): string {
  switch (type) {
    case 'NEW_REVIEW': return 'text-green-600'
    case 'REVIEW_UPDATED': return 'text-blue-600'
    case 'REVIEW_DELETED': return 'text-red-600'
    case 'RATING_MILESTONE': return 'text-purple-600'
    case 'REVIEW_REMINDER': return 'text-yellow-600'
    case 'REVIEW_MODERATION': return 'text-orange-600'
    default: return 'text-gray-600'
  }
}

export function formatNotificationTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}