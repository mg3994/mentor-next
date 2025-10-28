'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { availabilitySchema, type Availability } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, X, Clock } from 'lucide-react'

interface AvailabilityFormProps {
  existingSlots?: Array<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive: boolean
  }>
  onSuccess?: () => void
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AvailabilityForm({ existingSlots = [], onSuccess }: AvailabilityFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState(existingSlots)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Availability>({
    resolver: zodResolver(availabilitySchema),
  })

  const onSubmit = async (data: Availability) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mentor/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create availability slot')
      }

      // Add new slot to the list
      setSlots([...slots, result.availability])
      reset()
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSlotStatus = async (slotId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/mentor/availability/${slotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        setSlots(slots.map(slot => 
          slot.id === slotId ? { ...slot, isActive } : slot
        ))
      }
    } catch (err) {
      console.error('Failed to update availability slot:', err)
    }
  }

  const deleteSlot = async (slotId: string) => {
    try {
      const response = await fetch(`/api/mentor/availability/${slotId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSlots(slots.filter(slot => slot.id !== slotId))
      }
    } catch (err) {
      console.error('Failed to delete availability slot:', err)
    }
  }

  // Group slots by day for better display
  const slotsByDay = slots.reduce((acc, slot) => {
    if (!acc[slot.dayOfWeek]) {
      acc[slot.dayOfWeek] = []
    }
    acc[slot.dayOfWeek].push(slot)
    return acc
  }, {} as Record<number, typeof slots>)

  return (
    <div className="space-y-6">
      {/* Current Availability */}
      {slots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span>Current Availability</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(slotsByDay)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([dayOfWeek, daySlots]) => (
                  <div key={dayOfWeek} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3">{dayNames[parseInt(dayOfWeek)]}</h4>
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <Badge variant={slot.isActive ? 'default' : 'secondary'}>
                              {slot.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSlotStatus(slot.id, !slot.isActive)}
                            >
                              {slot.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteSlot(slot.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Availability Slot */}
      <Card>
        <CardHeader>
          <CardTitle>Add Availability Slot</CardTitle>
          <CardDescription>
            Set your available hours for mentorship sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week *</Label>
              <Select onValueChange={(value) => setValue('dayOfWeek', parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {dayNames.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.dayOfWeek && (
                <p className="text-sm text-red-600">{errors.dayOfWeek.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  {...register('startTime')}
                  disabled={isLoading}
                />
                {errors.startTime && (
                  <p className="text-sm text-red-600">{errors.startTime.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  {...register('endTime')}
                  disabled={isLoading}
                />
                {errors.endTime && (
                  <p className="text-sm text-red-600">{errors.endTime.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Add Availability Slot
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}