'use client'

import React, { useEffect, useState } from 'react'
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { BeforeListClientProps } from 'payload'
// @ts-ignore
import './calendar-styles.css'

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const BRANCH_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#a855f7', // purple
  '#22c55e', // green-500
  '#eab308', // yellow
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#64748b', // slate
  '#78716c', // stone
  '#fb923c', // orange-400
]

const getBranchColor = (branchId: string): string => {
  if (!branchId) return BRANCH_COLORS[0]
  
  // Simple hash function to consistently map branch ID to color
  let hash = 0
  for (let i = 0; i < branchId.length; i++) {
    hash = branchId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % BRANCH_COLORS.length
  return BRANCH_COLORS[index]
}

interface Reservation {
  id: string
  customer: any
  reservationDateTime: string
  numberOfGuests: number
  branch: any
  status: 'Pending' | 'Confirmed' | 'Cancelled'
  specialRequests?: string
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Reservation
}

const CalendarView: React.FC<BeforeListClientProps> = (props) => {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState(new Date())

  useEffect(() => {
    fetchReservations()
  }, [])

  const fetchReservations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reservations?limit=1000&depth=2')
      const data = await response.json()

      if (data.docs) {
        console.log('Fetched reservations:', data.docs.length, 'Sample:', data.docs[0])
        const calendarEvents: CalendarEvent[] = data.docs.map((reservation: Reservation) => {
          const startDate = new Date(reservation.reservationDateTime)
          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)

          const customerName = typeof reservation.customer === 'object' && reservation.customer !== null
            ? (reservation.customer.customerName || reservation.customer.name || reservation.customer.email || `Guest ${reservation.customer.id || ''}`).trim()
            : (typeof reservation.customer === 'string' ? 'Guest' : 'Walk-in')

          const branchName = typeof reservation.branch === 'object' && reservation.branch !== null
            ? (reservation.branch.name || reservation.branch.title || 'Branch')
            : 'Branch'

          const timeString = format(startDate, 'HH:mm')

          return {
            id: reservation.id,
            title: `${timeString} - ${customerName} - ${reservation.numberOfGuests} guests - ${branchName}`,
            start: startDate,
            end: endDate,
            resource: reservation,
          }
        })

        setEvents(calendarEvents)
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
    } finally {
      setLoading(false)
    }
  }

  const eventStyleGetter = (event: CalendarEvent) => {
    const branch = event.resource.branch
    const branchId = typeof branch === 'object' && branch !== null
      ? (branch.id || branch._id || JSON.stringify(branch))
      : (branch || 'default')
    
    console.log('Branch ID for color:', branchId, 'Branch object:', branch)
    const backgroundColor = getBranchColor(String(branchId))

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    }
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    window.location.href = `/admin/collections/reservations/${event.id}`
  }

  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    return (
      <div style={{ 
        height: '100%', 
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
      }}>
        {event.title}
      </div>
    )
  }

  const EventAgenda = ({ event }: { event: CalendarEvent }) => {
    return <span>{event.title}</span>
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading reservations...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', marginBottom: '40px' }}>
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
            Reservations Calendar View
          </h2>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Events are color-coded by branch/location
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          Total Reservations: {events.length}
        </div>
      </div>
      <div style={{ 
        height: '650px',
        backgroundColor: 'var(--theme-bg, white)', 
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          views={[Views.MONTH]}
          view={Views.MONTH}
          date={date}
          onNavigate={(newDate) => setDate(newDate)}
          defaultView={Views.MONTH}
          popup
          components={{
            event: EventComponent,
            agenda: {
              event: EventAgenda,
            },
          }}
          tooltipAccessor={(event: CalendarEvent) => {
            const { resource } = event
            return `${event.title}${resource.specialRequests ? '\n' + resource.specialRequests : ''}`
          }}
        />
      </div>
    </div>
  )
}

export default CalendarView
