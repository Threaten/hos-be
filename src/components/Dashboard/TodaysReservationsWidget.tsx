'use client'

import React, { useEffect, useState } from 'react'
import './widget-styles.css'

interface ReservationStats {
  branchName: string
  branchId: string
  count: number
}

const TodaysReservationsWidget: React.FC = () => {
  const [stats, setStats] = useState<ReservationStats[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchTodaysReservations()
  }, [])

  const fetchTodaysReservations = async () => {
    try {
      // Get today's date range (start and end of day)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Fetch all reservations for today
      const response = await fetch(
        `/api/reservations?limit=1000&depth=2&where[reservationDateTime][greater_than_equal]=${today.toISOString()}&where[reservationDateTime][less_than]=${tomorrow.toISOString()}`
      )
      const data = await response.json()

      if (data.docs) {
        // Group by branch
        const branchMap = new Map<string, { name: string; count: number }>()

        data.docs.forEach((reservation: any) => {
          const branch = reservation.branch
          if (branch && typeof branch === 'object') {
            const branchId = branch.id || branch._id || ''
            const branchName = branch.name || branch.title || 'Unknown Branch'

            if (branchMap.has(branchId)) {
              branchMap.get(branchId)!.count += 1
            } else {
              branchMap.set(branchId, { name: branchName, count: 1 })
            }
          }
        })

        // Convert to array and sort by count (descending)
        const statsArray: ReservationStats[] = Array.from(branchMap.entries())
          .map(([branchId, data]) => ({
            branchId,
            branchName: data.name,
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count)

        setStats(statsArray)
        setTotalCount(data.docs.length)
      }
    } catch (error) {
      console.error('Error fetching today\'s reservations:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="todays-reservations-widget">
        <h3 className="widget-title">Today's Reservations</h3>
        <div className="widget-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="todays-reservations-widget">
      <div className="widget-header">
        <h3 className="widget-title">Today's Reservations</h3>
        <div className="widget-total">Total: {totalCount}</div>
      </div>
      
      {stats.length === 0 ? (
        <div className="widget-empty">No reservations for today</div>
      ) : (
        <div className="widget-stats">
          {stats.map((stat) => (
            <div key={stat.branchId} className="branch-stat">
              <div className="branch-name">{stat.branchName}</div>
              <div className="branch-count">{stat.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TodaysReservationsWidget
