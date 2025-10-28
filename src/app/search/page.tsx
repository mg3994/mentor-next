import MentorSearch from '@/components/search/mentor-search'

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MentorSearch />
    </div>
  )
}

export const metadata = {
  title: 'Find Mentors - Mentor Platform',
  description: 'Search and discover experienced mentors to guide your learning journey',
}