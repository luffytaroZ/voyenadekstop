import { useState } from 'react';
import { useEvents, useDeleteEvent, useToggleEventStatus } from '../queries';
import EventCard from '../components/EventCard';
import EventModal from '../components/EventModal';
import type { Event, EventStatus } from '../types';

type FilterType = 'all' | 'pending' | 'completed' | 'today' | 'upcoming';

export default function EventsPage() {
  const { data: events = [], isLoading } = useEvents();
  const deleteEvent = useDeleteEvent();
  const toggleStatus = useToggleEventStatus();

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState<FilterType>('pending');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return event.status === 'completed';
    if (filter === 'pending') return event.status !== 'completed';
    if (filter === 'today') {
      if (!event.start_time) return false;
      const eventDate = new Date(event.start_time);
      return eventDate >= today && eventDate < tomorrow;
    }
    if (filter === 'upcoming') {
      if (!event.start_time) return false;
      return new Date(event.start_time) >= today && event.status !== 'completed';
    }
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aCompleted = a.status === 'completed';
    const bCompleted = b.status === 'completed';
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

    if (a.start_time && b.start_time) {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    }
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleToggleStatus = (event: Event, status: EventStatus) => {
    toggleStatus.mutate({ id: event.id, status });
  };

  const handleDelete = (id: string) => {
    deleteEvent.mutate(id);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEvent(null);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const pendingCount = events.filter(e => e.status !== 'completed').length;
  const todayCount = events.filter(e => {
    if (!e.start_time || e.status === 'completed') return false;
    const d = new Date(e.start_time);
    return d >= today && d < tomorrow;
  }).length;

  return (
    <div className="events-page">
      <div className="events-page-header">
        <div className="events-page-title">
          <h1>Events</h1>
          <span className="events-page-count">{pendingCount} pending</span>
        </div>
        <button className="btn-primary" onClick={handleNewEvent}>
          + New Event
        </button>
      </div>

      <div className="events-page-filters">
        <button
          className={`filter-pill ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`filter-pill ${filter === 'today' ? 'active' : ''}`}
          onClick={() => setFilter('today')}
        >
          Today {todayCount > 0 && <span className="filter-badge">{todayCount}</span>}
        </button>
        <button
          className={`filter-pill ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          Upcoming
        </button>
        <button
          className={`filter-pill ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
        <button
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      <div className="events-page-content">
        {isLoading ? (
          <div className="events-page-empty">Loading events...</div>
        ) : sortedEvents.length === 0 ? (
          <div className="events-page-empty">
            <p>{getEmptyMessage(filter)}</p>
            <button className="btn-secondary" onClick={handleNewEvent}>
              Create an event
            </button>
          </div>
        ) : (
          <div className="events-page-list">
            {sortedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => handleEdit(event)}
                onToggleStatus={(status) => handleToggleStatus(event, status)}
                onDelete={() => handleDelete(event.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <EventModal event={editingEvent} onClose={handleCloseModal} />
      )}
    </div>
  );
}

function getEmptyMessage(filter: FilterType): string {
  switch (filter) {
    case 'today':
      return 'No events scheduled for today';
    case 'upcoming':
      return 'No upcoming events';
    case 'completed':
      return 'No completed events';
    case 'pending':
      return 'No pending events';
    default:
      return 'No events yet';
  }
}
