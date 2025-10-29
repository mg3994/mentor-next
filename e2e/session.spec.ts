import { test, expect } from '@playwright/test'

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated session
    await page.addInitScript(() => {
      window.localStorage.setItem('next-auth.session-token', 'mock-token')
    })
    
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com',
            roles: [{ role: 'MENTEE' }]
          }
        })
      })
    })
  })

  test('should display user sessions', async ({ page }) => {
    // Mock sessions API
    await page.route('/api/bookings*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'session123',
              scheduledAt: '2024-12-01T10:00:00Z',
              duration: 60,
              status: 'SCHEDULED',
              mentor: {
                user: { name: 'John Mentor' }
              },
              pricingModel: {
                price: 2500,
                type: 'ONE_TIME'
              }
            },
            {
              id: 'session124',
              scheduledAt: '2024-11-28T14:00:00Z',
              duration: 60,
              status: 'COMPLETED',
              mentor: {
                user: { name: 'Jane Mentor' }
              },
              pricingModel: {
                price: 3000,
                type: 'ONE_TIME'
              }
            }
          ]
        })
      })
    })

    await page.goto('/dashboard/sessions')
    
    await expect(page.getByText('My Sessions')).toBeVisible()
    await expect(page.getByText('John Mentor')).toBeVisible()
    await expect(page.getByText('Jane Mentor')).toBeVisible()
    await expect(page.getByText('SCHEDULED')).toBeVisible()
    await expect(page.getByText('COMPLETED')).toBeVisible()
  })

  test('should filter sessions by status', async ({ page }) => {
    await page.goto('/dashboard/sessions')
    
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Completed' }).click()
    
    // Verify API was called with status filter
    await page.waitForRequest(request => 
      request.url().includes('/api/bookings') && 
      request.url().includes('status=COMPLETED')
    )
  })

  test('should join active session', async ({ page }) => {
    // Mock session details API
    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          scheduledAt: '2024-12-01T10:00:00Z',
          duration: 60,
          mentor: {
            user: { name: 'John Mentor', image: '/avatar.jpg' }
          },
          mentee: {
            user: { name: 'Test User', image: '/avatar2.jpg' }
          },
          roomId: 'room123'
        })
      })
    })

    // Mock WebRTC room creation
    await page.route('/api/sessions/room', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roomUrl: 'https://daily.co/room123',
          token: 'room-token-123'
        })
      })
    })

    await page.goto('/session/session123')
    
    await expect(page.getByText('Connected')).toBeVisible()
    await expect(page.getByText('John Mentor')).toBeVisible()
    
    // Video controls should be visible
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Camera' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'End Session' })).toBeVisible()
  })

  test('should handle session not found', async ({ page }) => {
    await page.route('/api/sessions/invalid123', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session not found' })
      })
    })

    await page.goto('/session/invalid123')
    
    await expect(page.getByText('Session not found')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible()
  })

  test('should toggle video and audio controls', async ({ page }) => {
    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          mentor: { user: { name: 'John Mentor' } },
          mentee: { user: { name: 'Test User' } }
        })
      })
    })

    await page.goto('/session/session123')
    
    const muteButton = page.getByRole('button', { name: 'Mute' })
    const cameraButton = page.getByRole('button', { name: 'Camera' })
    
    // Toggle mute
    await muteButton.click()
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible()
    
    // Toggle camera
    await cameraButton.click()
    await expect(page.getByRole('button', { name: 'Turn On Camera' })).toBeVisible()
  })

  test('should switch between session tabs', async ({ page }) => {
    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          mentor: { user: { name: 'John Mentor' } },
          mentee: { user: { name: 'Test User' } }
        })
      })
    })

    await page.goto('/session/session123')
    
    // Should start on video tab
    await expect(page.getByRole('tabpanel', { name: 'Video' })).toBeVisible()
    
    // Switch to chat tab
    await page.getByRole('tab', { name: 'Chat' }).click()
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()
    
    // Switch to notes tab
    await page.getByRole('tab', { name: 'Notes' }).click()
    await expect(page.getByPlaceholder('Take notes during your session...')).toBeVisible()
    
    // Switch to files tab
    await page.getByRole('tab', { name: 'Files' }).click()
    await expect(page.getByRole('button', { name: 'Upload File' })).toBeVisible()
  })

  test('should send chat messages', async ({ page }) => {
    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          mentor: { user: { name: 'John Mentor' } },
          mentee: { user: { name: 'Test User' } }
        })
      })
    })

    // Mock chat message API
    await page.route('/api/sessions/session123/messages', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg123',
            content: 'Hello, this is a test message',
            sender: 'Test User',
            timestamp: new Date().toISOString()
          })
        })
      }
    })

    await page.goto('/session/session123')
    
    // Switch to chat tab
    await page.getByRole('tab', { name: 'Chat' }).click()
    
    // Send a message
    const messageInput = page.getByPlaceholder('Type a message...')
    await messageInput.fill('Hello, this is a test message')
    await page.getByRole('button', { name: 'Send' }).click()
    
    // Message should appear in chat
    await expect(page.getByText('Hello, this is a test message')).toBeVisible()
    
    // Input should be cleared
    await expect(messageInput).toHaveValue('')
  })

  test('should end session successfully', async ({ page }) => {
    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          mentor: { user: { name: 'John Mentor' } },
          mentee: { user: { name: 'Test User' } }
        })
      })
    })

    // Mock end session API
    await page.route('/api/sessions/session123/end', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      }
    })

    await page.goto('/session/session123')
    
    await page.getByRole('button', { name: 'End Session' }).click()
    
    // Should show confirmation dialog
    await expect(page.getByText('End Session?')).toBeVisible()
    await page.getByRole('button', { name: 'Yes, End Session' }).click()
    
    // Should redirect to dashboard or session summary
    await expect(page).toHaveURL(/\/(dashboard|session\/session123\/summary)/)
  })
})

test.describe('Mobile Session Interface', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should work on mobile devices', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('next-auth.session-token', 'mock-token')
    })
    
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user123', name: 'Test User', roles: [{ role: 'MENTEE' }] }
        })
      })
    })

    await page.route('/api/sessions/session123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session123',
          status: 'IN_PROGRESS',
          mentor: { user: { name: 'John Mentor' } },
          mentee: { user: { name: 'Test User' } }
        })
      })
    })

    await page.goto('/session/session123')
    
    // Mobile interface should be visible
    await expect(page.getByText('Connected')).toBeVisible()
    
    // Tab navigation should be horizontal scrollable on mobile
    const tabsList = page.getByRole('tablist')
    await expect(tabsList).toBeVisible()
    
    // Control buttons should be touch-friendly (minimum 44px)
    const endButton = page.getByRole('button', { name: 'End Session' })
    await expect(endButton).toHaveCSS('min-height', '44px')
  })
})