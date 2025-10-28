'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication.',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  
  const errorMessage = error && errorMessages[error] 
    ? errorMessages[error] 
    : errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Authentication Error</CardTitle>
          <CardDescription className="text-center">
            There was a problem signing you in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Go Home</Link>
            </Button>
          </div>

          {error && (
            <div className="text-center text-xs text-gray-500">
              Error code: {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}