import { test, expect } from '@playwright/test'

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated mentee session
    await page.addInitScript(() => {
      window.localStorage.setItem('next-auth.session-token', 'mock-token')
    })
    
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mentee123',
            name: 'Test Mentee',
            email: 'mentee@example.com',
            roles: [{ role: 'MENTEE' }]
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      })
    })
  })

  test('should search for mentors', async ({ page }) => {
    // Mock search API
    await page.route('/api/search/mentors*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mentors: [
            {
              id: 'mentor123',
              name: 'John Mentor',
              avatar: '/avatar.jpg',
              bio: 'Experienced React developer',
              expertise: ['react', 'javascript'],
              rating: 4.8,
              totalSessions: 150,
              priceRange: { min: 2000, max: 3000 },
              availability: { hasAvailability: true, nextAvailable: '2024-12-01' }
            }
          ],
          total: 1,
          page: 1,
          totalPages: 1
        })
      })
    })

    await page.goto('/search')
    
    await page.getByPlaceholder('Search mentors...').fill('react')
    await page.getByRole('button', { name: 'Search' }).click()
    
    await expect(page.getByText('John Mentor')).toBeVisible()
    await expect(page.getByText('Experienced React developer')).toBeVisible()
    await expect(page.getByText('4.8')).toBeVisible()
  })

  test('should filter mentors by field', async ({ page }) => {
    await page.goto('/search')
    
    await page.getByRole('combobox', { name: 'Field' }).click()
    await page.getByRole('option', { name: 'Web Development' }).click()
    await page.getByRole('button', { name: 'Search' }).click()
    
    // Verify the API was called with correct filters
    await page.waitForRequest(request => 
      request.url().includes('/api/search/mentors') && 
      request.url().includes('field=web-development')
    )
  })

  test('should complete booking flow', async ({ page }) => {
    // Mock mentor profile API
    await page.route('/api/mentors/mentor123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mentor123',
          bio: 'Experienced React developer with 5 years of experience',
          timezone: 'Asia/Kolkata',
          user: {
            id: 'mentor_user123',
            name: 'John Mentor',
            image: '/avatar.jpg'
          },
          pricingModels: [
            {
              id: 'pricing123',
              type: 'ONE_TIME',
              price: 2500,
              duration: 60,
              description: 'One-time session'
            }
          ],
          availability: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '17:00'
            }
          ]
        })
      })
    })

    // Mock booking creation API
    await page.route('/api/bookings', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: 'session123',
              scheduledAt: '2024-12-02T10:00:00Z',
              status: 'SCHEDULED'
            }
          })
        })
      }
    })

    await page.goto('/book/mentor123')
    
    // Step 1: Select pricing model
    await expect(page.getByText('Select Pricing Model')).toBeVisible()
    await page.getByText('ONE_TIME').click()
    await page.getByRole('button', { name: 'Next' }).click()
    
    // Step 2: Select date
    await expect(page.getByText('Select Date')).toBeVisible()
    // Click on a future date (assuming it's available)
    await page.locator('[data-testid="calendar-day-2"]').click()
    await page.getByRole('button', { name: 'Next' }).click()
    
    // Step 3: Select time
    await expect(page.getByText('Select Time')).toBeVisible()
    await page.getByText('10:00').click()
    await page.getByRole('button', { name: 'Next' }).click()
    
    // Step 4: Confirm booking
    await expect(page.getByText('Confirm Booking')).toBeVisible()
    await expect(page.getByText('John Mentor')).toBeVisible()
    await expect(page.getByText('₹2,500')).toBeVisible()
    
    await page.getByRole('button', { name: 'Book Session' }).click()
    
    // Should redirect to sessions page
    await expect(page).toHaveURL(/\/dashboard\/sessions/)
  })

  test('should handle booking conflicts', async ({ page }) => {
    await page.route('/api/mentors/mentor123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mentor123',
          bio: 'Experienced React developer',
          timezone: 'Asia/Kolkata',
          user: { name: 'John Mentor' },
          pricingModels: [
            { id: 'pricing123', type: 'ONE_TIME', price: 2500, duration: 60 }
          ],
          availability: []
        })
      })
    })

    await page.goto('/book/mentor123')
    
    await page.getByText('ONE_TIME').click()
    await page.getByRole('button', { name: 'Next' }).click()
    
    // Select a date
    await page.locator('[data-testid="calendar-day-2"]').click()
    await page.getByRole('button', { name: 'Next' }).click()
    
    // Should show no available slots
    await expect(page.getByText('No available slots for this date')).toBeVisible()
  })

  test('should handle booking API errors', async ({ page }) => {
    await page.route('/api/mentors/mentor123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mentor123',
          bio: 'Experienced React developer',
          timezone: 'Asia/Kolkata',
          user: { name: 'John Mentor' },
          pricingModels: [
            { id: 'pricing123', type: 'ONE_TIME', price: 2500, duration: 60 }
          ],
          availability: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
          ]
        })
      })
    })

    await page.route('/api/bookings', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Time slot no longer available'
          })
        })
      }
    })

    await page.goto('/book/mentor123')
    
    // Complete booking flow
    await page.getByText('ONE_TIME').click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.locator('[data-testid="calendar-day-2"]').click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByText('10:00').click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Book Session' }).click()
    
    // Should show error message
    await expect(page.getByText('Time slot no longer available')).toBeVisible()
  })
})

test.describe('Mobile Booking Flow', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should work on mobile devices', async ({ page }) => {
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
            id: 'mentee123',
            name: 'Test Mentee',
            email: 'mentee@example.com',
            roles: [{ role: 'MENTEE' }]
          }
        })
      })
    })

    await page.route('/api/mentors/mentor123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mentor123',
          bio: 'Experienced React developer',
          timezone: 'Asia/Kolkata',
          user: { name: 'John Mentor' },
          pricingModels: [
            { id: 'pricing123', type: 'ONE_TIME', price: 2500, duration: 60 }
          ],
          availability: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
          ]
        })
      })
    })

    await page.goto('/book/mentor123')
    
    // Should show mobile-optimized booking interface
    await expect(page.getByText('Select Pricing Model')).toBeVisible()
    
    // Progress indicator should be visible
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible()
    
    // Touch-friendly buttons
    const nextButton = page.getByRole('button', { name: 'Next' })
    await expect(nextButton).toHaveCSS('min-height', '44px') // Touch target size
  })
})