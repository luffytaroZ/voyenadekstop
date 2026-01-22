import { useState } from 'react';
import { useCreateEvent, useUpdateEvent } from '../queries';
import type { Event, EventCreate, EventCategory, Priority } from '../types';

interface EventModalProps {
  event?: Event | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const isEditing = !!event;
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [startDate, setStartDate] = useState(
    event?.start_time ? event.start_time.split('T')[0] : ''
  );
  const [startTime, setStartTime] = useState(
    event?.start_time ? event.start_time.split('T')[1]?.slice(0, 5) : ''
  );
  const [category, setCategory] = useState<EventCategory>(event?.category || 'personal');
  const [priority, setPriority] = useState<Priority>(event?.priority || 'medium');
  const [location, setLocation] = useState(event?.location || '');
  const [isAllDay, setIsAllDay] = useState(event?.is_all_day || false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const startDateTime = startDate
      ? isAllDay
        ? `${startDate}T00:00:00`
        : startTime
          ? `${startDate}T${startTime}:00`
          : `${startDate}T00:00:00`
      : null;

    const data: EventCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: startDateTime,
      time_mode: isAllDay ? 'all_day' : 'at_time',
      category,
      priority,
      location: location.trim() || undefined,
      is_all_day: isAllDay,
      show_on_calendar: true,
      tags: [],
    };

    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({ id: event.id, data });
      } else {
        await createEvent.mutateAsync(data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-title"
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {!isAllDay && (
              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-row" style={{ marginBottom: '16px' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
              />
              <span>All day</span>
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
              >
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="meeting">Meeting</option>
                <option value="todo">To-do</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <input
              type="text"
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <textarea
              placeholder="Notes (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isPending || !title.trim()}>
              {isPending ? 'Saving...' : isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
