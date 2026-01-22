import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { useEvents, useDeleteEvent, useToggleEventStatus } from '../queries';
import EventModal from '../components/EventModal';
import type { Event, EventStatus } from '../types';

export default function CalendarPage() {
  const { data: events = [], isLoading } = useEvents();
  const deleteEvent = useDeleteEvent();
  const toggleStatus = useToggleEventStatus();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      if (!event.start_time) return false;
      return isSameDay(parseISO(event.start_time), date);
    });
  };

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth]);

  // Events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Statistics
  const stats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthEvents = events.filter((e) => {
      if (!e.start_time) return false;
      const eventDate = parseISO(e.start_time);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });

    const completedThisMonth = monthEvents.filter((e) => e.status === 'completed').length;
    const pendingThisMonth = monthEvents.filter((e) => e.status !== 'completed').length;
    const todayEvents = events.filter((e) => e.start_time && isSameDay(parseISO(e.start_time), new Date())).length;

    return {
      total: monthEvents.length,
      completed: completedThisMonth,
      pending: pendingThisMonth,
      today: todayEvents,
    };
  }, [events, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const handleToggleStatus = (event: Event, status: EventStatus) => {
    toggleStatus.mutate({ id: event.id, status });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this event?')) {
      deleteEvent.mutate(id);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEvent(null);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-page">
      <div className="calendar-layout">
        {/* Calendar Grid Card */}
        <div className="calendar-card calendar-grid-card">
          <div className="calendar-nav">
            <div className="calendar-nav-left">
              <button className="nav-btn" onClick={handlePrevMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6" />
                </svg>
              </button>
              <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
              <button className="nav-btn" onClick={handleNextMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </button>
            </div>
            <div className="calendar-nav-actions">
              <button className="btn-secondary btn-sm" onClick={handleToday}>Today</button>
              <button className="btn-primary btn-sm" onClick={handleNewEvent}>+ New Event</button>
            </div>
          </div>

          <div className="calendar-grid">
            {/* Week day headers */}
            {weekDays.map((day) => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={idx}
                  className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className="day-number">{format(day, 'd')}</span>
                  {dayEvents.length > 0 && (
                    <div className="day-events-indicator">
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <span
                          key={i}
                          className={`event-dot ${event.status === 'completed' ? 'completed' : ''}`}
                          style={{ backgroundColor: event.color || undefined }}
                        />
                      ))}
                      {dayEvents.length > 3 && <span className="event-dot more">+</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="calendar-sidebar">
          {/* Selected Date Card */}
          <div className="calendar-card selected-date-card">
            <div className="card-header">
              <span className="card-label">Selected Date</span>
              {selectedDate && (
                <span className="event-count">{selectedDateEvents.length} events</span>
              )}
            </div>
            {selectedDate && (
              <h3 className="selected-date-title">
                {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}
                <span className="date-full">{format(selectedDate, 'MMMM d, yyyy')}</span>
              </h3>
            )}
          </div>

          {/* Events for Selected Date */}
          <div className="calendar-card events-list-card">
            <div className="card-header">
              <span className="card-label">Events</span>
              {selectedDate && (
                <button className="add-event-btn" onClick={handleNewEvent}>+ Add</button>
              )}
            </div>

            {isLoading ? (
              <div className="events-empty">Loading...</div>
            ) : selectedDateEvents.length === 0 ? (
              <div className="events-empty">
                <p>No events for this date</p>
                <button className="btn-secondary" onClick={handleNewEvent}>Create event</button>
              </div>
            ) : (
              <div className="events-list">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`calendar-event-item ${event.status === 'completed' ? 'completed' : ''}`}
                    onClick={() => handleEdit(event)}
                  >
                    <div className="event-checkbox">
                      <div
                        className={`checkbox ${event.status === 'completed' ? 'checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(
                            event,
                            event.status === 'completed' ? 'pending' : 'completed'
                          );
                        }}
                      >
                        {event.status === 'completed' && '✓'}
                      </div>
                    </div>
                    <div className="event-info">
                      <span className={`event-title ${event.status === 'completed' ? 'strikethrough' : ''}`}>
                        {event.title}
                      </span>
                      {event.start_time && (
                        <span className="event-time">
                          {format(parseISO(event.start_time), 'h:mm a')}
                          {event.location && ` · ${event.location}`}
                        </span>
                      )}
                    </div>
                    {event.priority === 'high' && (
                      <span className="priority-indicator">!</span>
                    )}
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(event.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statistics Card */}
          <div className="calendar-card stats-card">
            <div className="card-header">
              <span className="card-label">Statistics</span>
              <span className="stats-month">{format(currentMonth, 'MMM yyyy')}</span>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.completed}</span>
                <span className="stat-label">Completed</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.today}</span>
                <span className="stat-label">Today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <EventModal event={editingEvent} onClose={handleCloseModal} />
      )}
    </div>
  );
}
