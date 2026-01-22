import { useState } from 'react';
import { useCreateEvent, useUpdateEvent } from '../queries';
import type { Event, EventCreate, EventCategory, Priority, TimeMode, RecurringPattern, EventReminder } from '../types';

interface EventModalProps {
  event?: Event | null;
  onClose: () => void;
}

const TIME_MODES: { value: TimeMode; label: string; description: string }[] = [
  { value: 'at_time', label: 'Specific Time', description: 'Set exact date and time' },
  { value: 'all_day', label: 'All Day', description: 'No specific time' },
  { value: 'morning', label: 'Morning', description: 'Before noon' },
  { value: 'day', label: 'Daytime', description: 'During work hours' },
  { value: 'evening', label: 'Evening', description: 'After work hours' },
  { value: 'anytime', label: 'Flexible', description: 'No time constraint' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

const RECURRING_OPTIONS: { value: RecurringPattern; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

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
  const [timeMode, setTimeMode] = useState<TimeMode>(event?.time_mode || 'at_time');
  const [category, setCategory] = useState<EventCategory>(event?.category || 'personal');
  const [priority, setPriority] = useState<Priority>(event?.priority || 'medium');
  const [location, setLocation] = useState(event?.location || '');
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring || false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern | undefined>(
    event?.recurring_pattern
  );
  const [reminders, setReminders] = useState<EventReminder[]>(event?.reminders || []);

  const addReminder = (minutesBefore: number) => {
    if (reminders.some((r) => r.minutes_before === minutesBefore)) return;
    setReminders([
      ...reminders,
      { id: `reminder_${Date.now()}`, minutes_before: minutesBefore, type: 'notification' },
    ]);
  };

  const removeReminder = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const isAllDay = timeMode === 'all_day';
    const needsSpecificTime = timeMode === 'at_time';

    const startDateTime = startDate
      ? isAllDay
        ? `${startDate}T00:00:00`
        : needsSpecificTime && startTime
          ? `${startDate}T${startTime}:00`
          : `${startDate}T00:00:00`
      : null;

    const data: EventCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: startDateTime,
      time_mode: timeMode,
      category,
      priority,
      location: location.trim() || undefined,
      is_all_day: isAllDay,
      is_recurring: isRecurring,
      recurring_pattern: isRecurring ? recurringPattern : undefined,
      reminders,
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

          {/* Time Mode Selector */}
          <div className="form-group">
            <label>When</label>
            <div className="time-mode-grid">
              {TIME_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`time-mode-btn ${timeMode === mode.value ? 'active' : ''}`}
                  onClick={() => setTimeMode(mode.value)}
                >
                  <span className="time-mode-label">{mode.label}</span>
                  <span className="time-mode-desc">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date/Time inputs based on time mode */}
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {timeMode === 'at_time' && (
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

          {/* Recurring Section */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span>Repeat</span>
            </label>
            {isRecurring && (
              <div className="recurring-options">
                {RECURRING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`recurring-btn ${recurringPattern === opt.value ? 'active' : ''}`}
                    onClick={() => setRecurringPattern(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reminders Section */}
          <div className="form-group">
            <label>Reminders</label>
            <div className="reminders-list">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="reminder-item">
                  <span>
                    {REMINDER_OPTIONS.find((o) => o.value === reminder.minutes_before)?.label ||
                      `${reminder.minutes_before} min before`}
                  </span>
                  <button
                    type="button"
                    className="reminder-remove"
                    onClick={() => removeReminder(reminder.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <select
                className="reminder-add"
                value=""
                onChange={(e) => {
                  if (e.target.value) addReminder(parseInt(e.target.value));
                }}
              >
                <option value="">+ Add reminder</option>
                {REMINDER_OPTIONS.filter((o) => !reminders.some((r) => r.minutes_before === o.value)).map(
                  (opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  )
                )}
              </select>
            </div>
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
