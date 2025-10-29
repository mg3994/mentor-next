'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  DollarSign, 
  User, 
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface MobileSessionBookingProps {
  mentorId: string
  mentor: {
    id: string
    bio: string
    timezone: string
    user: {
      id: string
      name: string
      image?: string
    }
    pricingModels: Array<{
      id: string
      type: string
      price: number
      duration?: number
      description?: string
    }>
    availability: Array<{
      dayOfWeek: number
      startTime: string
      endTime: string
    }>
  }
}

export default function MobileSessionBooking({ mentorId, mentor }: MobileSessionBookingProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedPricing, setSelectedPricing] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Generate available time slots for selected date
  useEffect(() => {
    if (selectedDate) {
      const dayOfWeek = selectedDate.getDay()
      const availability = mentor.availability.find(a => a.dayOfWeek === dayOfWeek)
      
      if (availability) {
        const slots = generateTimeSlots(availability.startTime, availability.endTime)
        setAvailableSlots(slots)
      } else {
        setAvailableSlots([])
      }
    }
  }, [selectedDate, mentor.availability])

  const generateTimeSlots = (startTime: string, endTime: string) => {
    const slots = []
    const start = new Date(`2024-01-01T${startTime}`)
    const end = new Date(`2024-01-01T${endTime}`)
    
    while (start < end) {
      slots.push(start.toTimeString().slice(0, 5))
      start.setMinutes(start.getMinutes() + 60) // 1-hour slots
    }
    
    return slots
  }

  const handleBooking = async () => {
    if (!session) {
      router.push('/auth/signin')
      return
    }

    setLoading(true)
    setError('')

    try {
      const selectedPricingModel = mentor.pricingModels.find(p => p.id === selectedPricing)
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorId,
          pricingModelId: selectedPricing,
          scheduledAt: new Date(`${selectedDate?.toISOString().split('T')[0]}T${selectedTime}`),
          duration: selectedPricingModel?.duration || 60,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create booking')
      }

      const booking = await response.json()
      router.push(`/dashboard/sessions?booking=${booking.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const canProceedToNext = () => {
    switch (step) {
      case 1: return selectedPricing !== ''
      case 2: return selectedDate !== null
      case 3: return selectedTime !== ''
      default: return false
    }
  }

  const selectedPricingModel = mentor.pricingModels.find(p => p.id === selectedPricing)

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step >= stepNum
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {stepNum}
            </div>
            {stepNum < 4 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-2',
                  step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mentor Info */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{mentor.user.name}</h3>
              <p className="text-sm text-gray-600">Timezone: {mentor.timezone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select Pricing */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Pricing Model</CardTitle>
            <CardDescription>Choose how you'd like to pay for this session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mentor.pricingModels.map((pricing) => (
              <div
                key={pricing.id}
                onClick={() => setSelectedPricing(pricing.id)}
                className={cn(
                  'p-4 border rounded-lg cursor-pointer transition-colors',
                  selectedPricing === pricing.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={pricing.type === 'ONE_TIME' ? 'default' : 'secondary'}>
                        {pricing.type.replace('_', ' ')}
                      </Badge>
                      <span className="font-semibold">{formatCurrency(pricing.price)}</span>
                    </div>
                    {pricing.duration && (
                      <p className="text-sm text-gray-600 mt-1">
                        {pricing.duration} minutes
                      </p>
                    )}
                    {pricing.description && (
                      <p className="text-sm text-gray-600 mt-1">{pricing.description}</p>
                    )}
                  </div>
                  {selectedPricing === pricing.id && (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Date */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Date</CardTitle>
            <CardDescription>Choose a date for your session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Simple date picker for mobile */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, i) => {
                const date = new Date()
                date.setDate(date.getDate() - date.getDay() + i)
                const isToday = new Date().toDateString() === date.toDateString()
                const isPast = date < new Date()
                const isSelected = selectedDate?.toDateString() === date.toDateString()
                
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && setSelectedDate(date)}
                    disabled={isPast}
                    className={cn(
                      'p-2 text-sm rounded-lg transition-colors',
                      isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-blue-600 text-white'
                        : isToday
                        ? 'bg-blue-100 text-blue-600'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select Time */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Time</CardTitle>
            <CardDescription>
              Available slots for {selectedDate && formatDate(selectedDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      'p-3 text-sm border rounded-lg transition-colors',
                      selectedTime === slot
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No available slots for this date. Please select another date.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm Booking</CardTitle>
            <CardDescription>Review your session details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Mentor:</span>
                <span className="font-medium">{mentor.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{selectedDate && formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{selectedPricingModel?.duration || 60} minutes</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>{selectedPricingModel && formatCurrency(selectedPricingModel.price)}</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>

        {step < 4 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceedToNext()}
            className="flex items-center space-x-2"
          >
            <span>Next</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleBooking}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Book Session</span>
          </Button>
        )}
      </div>
    </div>
  )
}