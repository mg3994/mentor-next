'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionBookingSchema, type SessionBooking } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  DollarSign, 
  User, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/utils'
import { cn } from '@/utils'
import { format, addMinutes, isSameDay, isAfter, isBefore } from 'date-fns'

interface MentorData {
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

interface TimeSlot {
  start: Date
  end: Date
  available: boolean
}

interface SessionBookingProps {
  mentorId: string
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SessionBooking({ mentorId }: SessionBookingProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [mentor, setMentor] = useState<MentorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedPricing, setSelectedPricing] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SessionBooking>({
    resolver: zodResolver(sessionBookingSchema),
  })

  const watchPricingType = watch('pricingType')

  useEffect(() => {
    fetchMentorData()
  }, [mentorId])

  useEffect(() => {
    if (selectedDate && mentor) {
      generateTimeSlots()
    }
  }, [selectedDate, mentor])

  const fetchMentorData = async () => {
    try {
      const response = await fetch(`/api/mentors/${mentorId}`)
      const result = await response.json()

      if (response.ok) {
        setMentor(result.profile)
        setValue('mentorId', mentorId)
      } else {
        setError(result.error || 'Failed to fetch mentor data')
      }
    } catch (err) {
      setError('Failed to load mentor information')
    } finally {
      setLoading(false)
    }
  }

  const generateTimeSlots = async () => {
    if (!selectedDate || !mentor) return

    const dayOfWeek = selectedDate.getDay()
    const dayAvailability = mentor.availability.filter(a => a.dayOfWeek === dayOfWeek)

    if (dayAvailability.length === 0) {
      setAvailableSlots([])
      return
    }

    // Get existing bookings for this date
    try {
      const response = await fetch(`/api/bookings/availability?mentorId=${mentorId}&date=${selectedDate.toISOString()}`)
      const result = await response.json()
      const existingBookings = result.bookings || []

      const slots: TimeSlot[] = []

      dayAvailability.forEach(availability => {
        const [startHour, startMinute] = availability.startTime.split(':').map(Number)
        const [endHour, endMinute] = availability.endTime.split(':').map(Number)

        const startTime = new Date(selectedDate)
        startTime.setHours(startHour, startMinute, 0, 0)

        const endTime = new Date(selectedDate)
        endTime.setHours(endHour, endMinute, 0, 0)

        // Generate 30-minute slots
        let currentTime = new Date(startTime)
        while (currentTime < endTime) {
          const slotEnd = addMinutes(currentTime, 30)
          
          // Check if slot is in the future
          const isInFuture = isAfter(currentTime, new Date())
          
          // Check if slot conflicts with existing bookings
          const hasConflict = existingBookings.some((booking: any) => {
            const bookingStart = new Date(booking.startTime)
            const bookingEnd = new Date(booking.scheduledEnd)
            return (
              (isAfter(currentTime, bookingStart) && isBefore(currentTime, bookingEnd)) ||
              (isAfter(slotEnd, bookingStart) && isBefore(slotEnd, bookingEnd)) ||
              (isBefore(currentTime, bookingStart) && isAfter(slotEnd, bookingEnd))
            )
          })

          slots.push({
            start: new Date(currentTime),
            end: new Date(slotEnd),
            available: isInFuture && !hasConflict,
          })

          currentTime = addMinutes(currentTime, 30)
        }
      })

      setAvailableSlots(slots)
    } catch (err) {
      console.error('Failed to fetch availability:', err)
      setAvailableSlots([])
    }
  }

  const onSubmit = async (data: SessionBooking) => {
    if (!selectedDate || !selectedTime || !selectedPricing) {
      setError('Please select date, time, and pricing option')
      return
    }

    setBookingLoading(true)
    setError(null)

    try {
      const selectedPricingModel = mentor?.pricingModels.find(p => p.id === selectedPricing)
      if (!selectedPricingModel) {
        throw new Error('Invalid pricing model selected')
      }

      const [hour, minute] = selectedTime.split(':').map(Number)
      const startTime = new Date(selectedDate)
      startTime.setHours(hour, minute, 0, 0)

      let scheduledEnd: Date
      if (selectedPricingModel.type === 'ONE_TIME' && selectedPricingModel.duration) {
        scheduledEnd = addMinutes(startTime, selectedPricingModel.duration)
      } else {
        // Default to 60 minutes for hourly sessions
        scheduledEnd = addMinutes(startTime, 60)
      }

      const bookingData = {
        mentorId,
        startTime,
        scheduledEnd,
        pricingType: selectedPricingModel.type as 'ONE_TIME' | 'HOURLY' | 'MONTHLY_SUBSCRIPTION',
        agreedPrice: selectedPricingModel.price,
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to book session')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/sessions')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setBookingLoading(false)
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to book a session with this mentor.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!mentor) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Mentor not found or not available for booking'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Session Booked Successfully!</h3>
            <p className="text-gray-600 mb-4">
              Your session with {mentor.user.name} has been confirmed. Redirecting to your sessions...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mentor Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            {mentor.user.image && (
              <img
                src={mentor.user.image}
                alt={mentor.user.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <div>
              <CardTitle className="text-xl">Book a Session with {mentor.user.name}</CardTitle>
              <CardDescription>
                Choose your preferred date, time, and pricing option
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Your Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Pricing Selection */}
              <div className="space-y-3">
                <Label>Select Pricing Option *</Label>
                <div className="space-y-3">
                  {mentor.pricingModels.map((pricing) => (
                    <div
                      key={pricing.id}
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-colors",
                        selectedPricing === pricing.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => {
                        setSelectedPricing(pricing.id)
                        setValue('pricingType', pricing.type as any)
                        setValue('agreedPrice', pricing.price)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium capitalize">
                            {pricing.type.replace('_', ' ').toLowerCase()}
                          </h4>
                          {pricing.description && (
                            <p className="text-sm text-gray-600 mt-1">{pricing.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(pricing.price)}
                          </div>
                          {pricing.duration && (
                            <div className="text-sm text-gray-500">{pricing.duration} minutes</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label>Select Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div className="space-y-2">
                  <Label>Available Time Slots *</Label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map((slot, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant={selectedTime === format(slot.start, 'HH:mm') ? "default" : "outline"}
                          disabled={!slot.available}
                          onClick={() => {
                            if (slot.available) {
                              setSelectedTime(format(slot.start, 'HH:mm'))
                              setValue('startTime', slot.start)
                              setValue('scheduledEnd', slot.end)
                            }
                          }}
                          className="text-sm"
                        >
                          {format(slot.start, 'HH:mm')}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No available time slots for {format(selectedDate, 'EEEE, MMMM d')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={bookingLoading || !selectedDate || !selectedTime || !selectedPricing}
              >
                {bookingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Book Session
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Booking Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-medium">{mentor.user.name}</div>
                <div className="text-sm text-gray-600">Mentor</div>
              </div>
            </div>

            {selectedDate && (
              <div className="flex items-center space-x-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</div>
                  <div className="text-sm text-gray-600">Session Date</div>
                </div>
              </div>
            )}

            {selectedTime && (
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="font-medium">{selectedTime}</div>
                  <div className="text-sm text-gray-600">Start Time ({mentor.timezone})</div>
                </div>
              </div>
            )}

            {selectedPricing && (
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="font-medium">
                    {formatCurrency(mentor.pricingModels.find(p => p.id === selectedPricing)?.price || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Session Fee</div>
                </div>
              </div>
            )}

            {selectedDate && selectedTime && selectedPricing && (
              <div className="border-t pt-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    You're about to book a session for {format(selectedDate, 'MMMM d')} at {selectedTime}. 
                    The mentor will be notified and you'll receive a confirmation email.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}