'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mentorSearchSchema, type MentorSearch } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Search, Filter, X, MapPin, Star, Users, DollarSign, Clock } from 'lucide-react'
import { EXPERTISE_CATEGORIES, COMMON_TIMEZONES } from '@/lib/constants'
import { formatCurrency } from '@/utils'
import Link from 'next/link'
import { useDebounce } from '@/hooks/use-debounce'

interface MentorResult {
  id: string
  bio: string
  expertise: string[]
  timezone: string
  isVerified: boolean
  averageRating?: number
  totalSessions: number
  user: {
    id: string
    name: string
    image?: string
  }
  pricingModels: Array<{
    type: string
    price: number
    duration?: number
  }>
}

interface SearchResults {
  mentors: MentorResult[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function MentorSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MentorSearch>({
    resolver: zodResolver(mentorSearchSchema),
    defaultValues: {
      query: searchParams.get('q') || '',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      minPrice: parseInt(searchParams.get('minPrice') || '0'),
      maxPrice: parseInt(searchParams.get('maxPrice') || '10000'),
    },
  })

  const watchQuery = watch('query')
  const debouncedQuery = useDebounce(watchQuery, 300)

  // Load initial search from URL params
  useEffect(() => {
    const expertise = searchParams.get('expertise')?.split(',').filter(Boolean) || []
    const minPrice = parseInt(searchParams.get('minPrice') || '0')
    const maxPrice = parseInt(searchParams.get('maxPrice') || '10000')
    
    setSelectedExpertise(expertise)
    setPriceRange([minPrice, maxPrice])
    setValue('expertise', expertise)
    setValue('minPrice', minPrice)
    setValue('maxPrice', maxPrice)

    // Perform initial search if there are params
    if (searchParams.toString()) {
      performSearch({
        query: searchParams.get('q') || '',
        expertise,
        minPrice,
        maxPrice,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '10'),
      })
    }
  }, [searchParams, setValue])

  // Auto-search when query changes
  useEffect(() => {
    if (debouncedQuery !== undefined) {
      const currentData = {
        query: debouncedQuery,
        expertise: selectedExpertise,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        page: 1,
        limit: 10,
      }
      performSearch(currentData)
    }
  }, [debouncedQuery])

  const performSearch = async (searchData: Partial<MentorSearch>) => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams()
      if (searchData.query) params.set('q', searchData.query)
      if (searchData.expertise?.length) params.set('expertise', searchData.expertise.join(','))
      if (searchData.minPrice) params.set('minPrice', searchData.minPrice.toString())
      if (searchData.maxPrice) params.set('maxPrice', searchData.maxPrice.toString())
      if (searchData.page) params.set('page', searchData.page.toString())
      if (searchData.limit) params.set('limit', searchData.limit.toString())
      if (searchData.timezone) params.set('timezone', searchData.timezone)

      const response = await fetch(`/api/search/mentors?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setResults(result)
        // Update URL without triggering navigation
        const newUrl = `${window.location.pathname}?${params.toString()}`
        window.history.replaceState({}, '', newUrl)
      } else {
        console.error('Search failed:', result.error)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (data: MentorSearch) => {
    const searchData = {
      ...data,
      expertise: selectedExpertise,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    }
    performSearch(searchData)
  }

  const addExpertise = (expertise: string) => {
    if (!selectedExpertise.includes(expertise)) {
      const updated = [...selectedExpertise, expertise]
      setSelectedExpertise(updated)
      setValue('expertise', updated)
    }
  }

  const removeExpertise = (expertise: string) => {
    const updated = selectedExpertise.filter(e => e !== expertise)
    setSelectedExpertise(updated)
    setValue('expertise', updated)
  }

  const clearFilters = () => {
    setSelectedExpertise([])
    setPriceRange([0, 10000])
    reset({
      query: '',
      page: 1,
      limit: 10,
      minPrice: 0,
      maxPrice: 10000,
    })
    setResults(null)
    router.push('/search')
  }

  const handlePageChange = (page: number) => {
    const searchData = {
      query: watchQuery,
      expertise: selectedExpertise,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      page,
      limit: 10,
    }
    performSearch(searchData)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Perfect Mentor</h1>
        <p className="text-lg text-gray-600">
          Connect with experienced professionals who can guide your learning journey
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  {showFilters ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`space-y-6 ${!showFilters ? 'hidden lg:block' : ''}`}>
              {/* Expertise Filter */}
              <div className="space-y-3">
                <Label>Expertise Areas</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedExpertise.map((expertise) => (
                    <Badge key={expertise} variant="secondary" className="flex items-center gap-1">
                      {expertise}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeExpertise(expertise)}
                      />
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={addExpertise}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add expertise" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERTISE_CATEGORIES.filter(cat => !selectedExpertise.includes(cat)).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range Filter */}
              <div className="space-y-3">
                <Label>Price Range (₹)</Label>
                <div className="px-2">
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => {
                      setPriceRange(value as [number, number])
                      setValue('minPrice', value[0])
                      setValue('maxPrice', value[1])
                    }}
                    max={10000}
                    min={0}
                    step={100}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{formatCurrency(priceRange[0])}</span>
                  <span>{formatCurrency(priceRange[1])}</span>
                </div>
              </div>

              {/* Timezone Filter */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select onValueChange={(value) => setValue('timezone', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any timezone</SelectItem>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        </div>        {
/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search Bar */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, expertise, or keywords..."
                      className="pl-10"
                      {...register('query')}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Search Results */}
          {results && (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {results.pagination.total} mentors found
                  </h2>
                  <p className="text-gray-600">
                    Page {results.pagination.page} of {results.pagination.pages}
                  </p>
                </div>
                <Select onValueChange={(value) => setValue('limit', parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mentor Cards */}
              <div className="space-y-6">
                {results.mentors.map((mentor) => (
                  <Card key={mentor.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        {mentor.user.image && (
                          <img
                            src={mentor.user.image}
                            alt={mentor.user.name}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="text-xl font-semibold text-gray-900">
                                  <Link 
                                    href={`/mentors/${mentor.user.id}`}
                                    className="hover:text-blue-600"
                                  >
                                    {mentor.user.name}
                                  </Link>
                                </h3>
                                {mentor.isVerified && (
                                  <Badge variant="secondary" className="text-green-600">
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                {mentor.averageRating && (
                                  <div className="flex items-center space-x-1">
                                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                    <span>{mentor.averageRating.toFixed(1)}</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-1">
                                  <Users className="h-4 w-4" />
                                  <span>{mentor.totalSessions} sessions</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <MapPin className="h-4 w-4" />
                                  <span>{mentor.timezone}</span>
                                </div>
                              </div>

                              <p className="text-gray-700 mt-3 line-clamp-3">
                                {mentor.bio}
                              </p>

                              <div className="flex flex-wrap gap-2 mt-3">
                                {mentor.expertise.slice(0, 5).map((skill) => (
                                  <Badge key={skill} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                                {mentor.expertise.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{mentor.expertise.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="ml-4 text-right">
                              {mentor.pricingModels.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-sm text-gray-600">Starting from</div>
                                  <div className="text-xl font-bold text-green-600">
                                    {formatCurrency(Math.min(...mentor.pricingModels.map(p => p.price)))}
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2">
                                <Button asChild className="w-full">
                                  <Link href={`/mentors/${mentor.user.id}`}>
                                    View Profile
                                  </Link>
                                </Button>
                                <Button variant="outline" asChild className="w-full">
                                  <Link href={`/book/${mentor.user.id}`}>
                                    Book Session
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {results.pagination.pages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(results.pagination.page - 1)}
                    disabled={results.pagination.page === 1}
                  >
                    Previous
                  </Button>
                  
                  {Array.from({ length: Math.min(5, results.pagination.pages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <Button
                        key={page}
                        variant={page === results.pagination.page ? "default" : "outline"}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(results.pagination.page + 1)}
                    disabled={results.pagination.page === results.pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {results && results.mentors.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No mentors found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search criteria or filters to find more mentors.
                </p>
                <Button onClick={clearFilters}>Clear Filters</Button>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && !results && (
            <div className="space-y-6">
              {Array.from({ length: 3 }, (_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="flex items-start space-x-4">
                        <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                          <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}