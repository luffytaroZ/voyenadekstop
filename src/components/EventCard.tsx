import type { Event, EventStatus } from '../types';

interface EventCardProps {
  event: Event;
  isSelected?: boolean;
  onClick?: () => void;
  onToggleStatus?: (status: EventStatus) => void;
  onDelete?: () => void;
}

export default function EventCard({
  event,
  isSelected,
  onClick,
  onToggleStatus,
  onDelete,
}: EventCardProps) {
  const isCompleted = event.status === 'completed';
  const isPast = event.start_time && new Date(event.start_time) < new Date();

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStatus) {
      onToggleStatus(isCompleted ? 'pending' : 'completed');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm('Delete this event?')) {
      onDelete();
    }
  };

  return (
    <div
      className={`event-card ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isPast && !isCompleted ? 'overdue' : ''}`}
      onClick={onClick}
    >
      <div className="event-checkbox" onClick={handleCheckbox}>
        <div className={`checkbox ${isCompleted ? 'checked' : ''}`}>
          {isCompleted && <span>*</span>}
        </div>
      </div>

      <div className="event-content">
        <div className="event-header">
          <span className={`event-title ${isCompleted ? 'strikethrough' : ''}`}>
            {event.title}
          </span>
          {event.priority && event.priority !== 'medium' && (
            <span className={`priority-badge ${event.priority}`}>
              {event.priority === 'high' ? '!' : '-'}
            </span>
          )}
        </div>

        {(event.start_time || event.location || event.description) && (
          <div className="event-meta">
            {event.start_time && (
              <span className="event-time">
                {formatEventTime(event)}
              </span>
            )}
            {event.location && (
              <span className="event-location">@ {event.location}</span>
            )}
          </div>
        )}

        {event.description && (
          <div className="event-description">
            {event.description.slice(0, 80)}
            {event.description.length > 80 ? '...' : ''}
          </div>
        )}

        {event.tags.length > 0 && (
          <div className="event-tags">
            {event.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="event-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <button className="event-delete" onClick={handleDelete} title="Delete">
        x
      </button>
    </div>
  );
}

function formatEventTime(event: Event): string {
  if (!event.start_time) return '';

  const date = new Date(event.start_time);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const timeStr = event.is_all_day
    ? 'All day'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${event.is_all_day ? '' : timeStr}`;
  if (isTomorrow) return `Tomorrow ${event.is_all_day ? '' : timeStr}`;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }) + (event.is_all_day ? '' : ` ${timeStr}`);
}
