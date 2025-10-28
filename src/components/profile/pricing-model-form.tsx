'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pricingModelSchema, type PricingModel } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, X, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/utils'

interface PricingModelFormProps {
  existingModels?: Array<{
    id: string
    type: string
    price: number
    duration?: number
    description?: string
    isActive: boolean
  }>
  onSuccess?: () => void
}

export default function PricingModelForm({ existingModels = [], onSuccess }: PricingModelFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState(existingModels)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PricingModel>({
    resolver: zodResolver(pricingModelSchema),
  })

  const watchType = watch('type')

  const onSubmit = async (data: PricingModel) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mentor/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create pricing model')
      }

      // Add new model to the list
      setModels([...models, result.pricingModel])
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

  const toggleModelStatus = async (modelId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/mentor/pricing/${modelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        setModels(models.map(model => 
          model.id === modelId ? { ...model, isActive } : model
        ))
      }
    } catch (err) {
      console.error('Failed to update pricing model:', err)
    }
  }

  const deleteModel = async (modelId: string) => {
    try {
      const response = await fetch(`/api/mentor/pricing/${modelId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setModels(models.filter(model => model.id !== modelId))
      }
    } catch (err) {
      console.error('Failed to delete pricing model:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Existing Pricing Models */}
      {models.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Current Pricing Models</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold capitalize">
                        {model.type.replace('_', ' ').toLowerCase()}
                      </h4>
                      <Badge variant={model.isActive ? 'default' : 'secondary'}>
                        {model.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(model.price)}
                      {model.duration && <span className="text-sm text-gray-500 ml-1">/ {model.duration}min</span>}
                    </div>
                    {model.description && (
                      <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleModelStatus(model.id, !model.isActive)}
                    >
                      {model.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteModel(model.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Pricing Model */}
      <Card>
        <CardHeader>
          <CardTitle>Add Pricing Model</CardTitle>
          <CardDescription>
            Create different pricing options for your mentorship services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Pricing Type *</Label>
                <Select onValueChange={(value) => register('type').onChange({ target: { value } })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pricing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time Session</SelectItem>
                    <SelectItem value="HOURLY">Hourly Rate</SelectItem>
                    <SelectItem value="MONTHLY_SUBSCRIPTION">Monthly Subscription</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="Enter price"
                  {...register('price', { valueAsNumber: true })}
                  disabled={isLoading}
                />
                {errors.price && (
                  <p className="text-sm text-red-600">{errors.price.message}</p>
                )}
              </div>
            </div>

            {watchType === 'ONE_TIME' && (
              <div className="space-y-2">
                <Label htmlFor="duration">Session Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="e.g., 60"
                  {...register('duration', { valueAsNumber: true })}
                  disabled={isLoading}
                />
                {errors.duration && (
                  <p className="text-sm text-red-600">{errors.duration.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what's included in this pricing option..."
                {...register('description')}
                disabled={isLoading}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Add Pricing Model
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}