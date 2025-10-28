import SessionBooking from '@/components/booking/session-booking'

interface BookingPageProps {
  params: {
    mentorId: string
  }
}

export default function BookingPage({ params }: BookingPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SessionBooking mentorId={params.mentorId} />
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Book Session - Mentor Platform',
  description: 'Schedule a mentorship session with your chosen mentor',
}