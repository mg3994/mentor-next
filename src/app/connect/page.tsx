import StudentSearch from '@/components/search/student-search'

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <StudentSearch />
    </div>
  )
}

export const metadata = {
  title: 'Connect with Students - Mentor Platform',
  description: 'Find study partners and join study groups to learn together',
}