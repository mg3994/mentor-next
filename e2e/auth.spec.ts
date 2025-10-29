import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display sign in and sign up buttons for unauthenticated users', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible()
  })

  test('should navigate to sign in page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign In' }).click()
    await expect(page).toHaveURL('/auth/signin')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('should navigate to sign up page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign Up' }).click()
    await expect(page).toHaveURL('/auth/signup')
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
  })

  test('should show validation errors for empty sign in form', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: 'Sign In' }).click()
    
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel('Email').fill('invalid-email')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    
    await expect(page.getByText('Please enter a valid email')).toBeVisible()
  })

  test('should complete sign up flow', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await page.getByLabel('Full Name').fill('Test User')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByLabel('Confirm Password').fill('password123')
    await page.getByRole('radio', { name: 'Mentee' }).check()
    
    // Mock successful registration
    await page.route('/api/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: { id: 'user123' } })
      })
    })
    
    await page.getByRole('button', { name: 'Create Account' }).click()
    
    // Should redirect to onboarding or dashboard
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/)
  })

  test('should handle sign up with existing email', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await page.getByLabel('Full Name').fill('Test User')
    await page.getByLabel('Email').fill('existing@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByLabel('Confirm Password').fill('password123')
    await page.getByRole('radio', { name: 'Mentee' }).check()
    
    // Mock user already exists error
    await page.route('/api/auth/register', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'User already exists' })
      })
    })
    
    await page.getByRole('button', { name: 'Create Account' }).click()
    
    await expect(page.getByText('User already exists')).toBeVisible()
  })

  test('should validate password confirmation', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await page.getByLabel('Password').fill('password123')
    await page.getByLabel('Confirm Password').fill('different123')
    await page.getByRole('button', { name: 'Create Account' }).click()
    
    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })
})

test.describe('Authenticated User Flow', () => {
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
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      })
    })
    
    await page.goto('/')
  })

  test('should display user name and sign out button', async ({ page }) => {
    await expect(page.getByText('Test User')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('should navigate to dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Go to Dashboard' }).click()
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome back, Test User!')).toBeVisible()
  })

  test('should sign out successfully', async ({ page }) => {
    await page.route('/api/auth/signout', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/' })
      })
    })
    
    await page.getByRole('button', { name: 'Sign Out' }).click()
    
    // Should redirect to home page and show sign in/up buttons
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible()
  })
})