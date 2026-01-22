import { useState, useMemo } from 'react';
import { format, startOfDay, parseISO, differenceInMinutes } from 'date-fns';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../queries';
import { generateAIResponse } from '../services/aiService';
import type { Event, EventCreate } from '../types';

type ViewMode = 'tracker' | 'audit';

interface AuditBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  title: string;
  type: 'gap' | 'event';
  color: string;
  duration: number;
  notes?: string;
  category?: string;
}

interface AIInsights {
  severity: 'solid' | 'needs-work' | 'poor';
  verdict: string;
  summary: string;
  fixes: string[];
  metrics: {
    loggedPercentage: number;
    totalGaps: number;
    gapMinutes: number;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  work: '#3B82F6',
  meeting: '#F59E0B',
  personal: '#10B981',
  todo: '#8B5CF6',
};

const getCategoryColor = (cat?: string) => CATEGORY_COLORS[cat || 'todo'] || '#6B7280';

const fmtTime = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')}${h < 12 ? 'a' : 'p'}`;
};

const fmtDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function DayTrackerPage() {
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>('tracker');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [noDate, setNoDate] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const { data: events = [] } = useEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = format(date, 'yyyy-MM-dd');

  // Filter events for the selected date
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (!e.start_time) return false;
        const eventDate = startOfDay(parseISO(e.start_time));
        return eventDate.getTime() === startOfDay(date).getTime() && e.category !== 'todo';
      })
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  }, [events, date]);

  const dayTodos = useMemo(() => {
    return events
      .filter((e) => {
        if (e.category !== 'todo') return false;
        if (!e.start_time) return true; // Show todos without date
        const eventDate = startOfDay(parseISO(e.start_time));
        return eventDate.getTime() === startOfDay(date).getTime();
      })
      .sort((a, b) => new Date(a.start_time || a.created_at).getTime() - new Date(b.start_time || b.created_at).getTime());
  }, [events, date]);

  const pendingEvents = dayEvents.filter((e) => e.status !== 'completed');
  const pendingTodos = dayTodos.filter((e) => e.status !== 'completed');
  const completed = [...dayEvents, ...dayTodos].filter((e) => e.status === 'completed');

  // Audit blocks for timeline view
  const auditBlocks = useMemo(() => {
    const dayItems = events
      .filter((e) => e.start_time && e.end_time && e.start_time.startsWith(dateStr))
      .map((e) => ({
        id: e.id,
        startTime: parseISO(e.start_time!),
        endTime: parseISO(e.end_time!),
        title: e.title,
        type: 'event' as const,
        category: e.category,
        notes: e.notes,
        color: getCategoryColor(e.category),
        duration: differenceInMinutes(parseISO(e.end_time!), parseISO(e.start_time!)) * 60,
      }))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const result: AuditBlock[] = [];
    const dayStart = new Date(date);
    dayStart.setHours(6, 0, 0, 0);
    const dayEnd = new Date(date);
    const now = new Date();
    date.toDateString() === now.toDateString() ? dayEnd.setTime(now.getTime()) : dayEnd.setHours(23, 0, 0, 0);

    const gap = (s: Date, e: Date): AuditBlock => ({
      id: `gap-${s.getTime()}`,
      startTime: s,
      endTime: e,
      title: 'Untracked',
      type: 'gap',
      color: 'var(--border)',
      duration: Math.floor((e.getTime() - s.getTime()) / 1000),
    });

    if (!dayItems.length) return [];

    if (dayItems[0].startTime > dayStart) result.push(gap(dayStart, dayItems[0].startTime));
    for (let i = 0; i < dayItems.length; i++) {
      result.push(dayItems[i]);
      if (i < dayItems.length - 1) {
        const diff = dayItems[i + 1].startTime.getTime() - dayItems[i].endTime.getTime();
        if (diff > 5 * 60 * 1000) result.push(gap(dayItems[i].endTime, dayItems[i + 1].startTime));
      }
    }
    const last = dayItems[dayItems.length - 1];
    if (last && last.endTime < dayEnd) result.push(gap(last.endTime, dayEnd));

    return result;
  }, [events, date, dateStr]);

  const changeDate = (dir: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d);
  };

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return;

    const eventData: EventCreate = {
      title: quickTitle.trim(),
      category: 'todo',
      time_mode: noDate ? 'todo' : 'at_time',
      show_on_calendar: !noDate,
    };

    if (!noDate) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const start = new Date(date);
      start.setHours(startH, startM, 0, 0);
      const end = new Date(date);
      end.setHours(endH, endM, 0, 0);
      eventData.start_time = start.toISOString();
      eventData.end_time = end.toISOString();
    }

    await createEvent.mutateAsync(eventData);
    setQuickTitle('');
    setShowQuickAdd(false);
    setNoDate(false);
  };

  const toggleComplete = async (event: Event) => {
    await updateEvent.mutateAsync({
      id: event.id,
      data: { status: event.status === 'completed' ? 'pending' : 'completed' },
    });
  };

  const handleDelete = async (event: Event) => {
    if (confirm('Delete this item?')) {
      await deleteEvent.mutateAsync(event.id);
    }
  };

  const generateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const eventsSummary = auditBlocks
        .map((b) => `${fmtTime(b.startTime)}-${fmtTime(b.endTime)}: ${b.title} (${b.type})`)
        .join('\n');

      const prompt = `Analyze this day's activities and provide structured feedback:

Date: ${format(date, 'EEEE, MMMM d, yyyy')}
Activities:
${eventsSummary || 'No activities logged'}

Provide a JSON response with:
- severity: "solid", "needs-work", or "poor"
- verdict: A brief one-liner assessment
- summary: 2-3 sentences about the day
- fixes: Array of 3-4 actionable improvements for tomorrow
- metrics: { loggedPercentage, totalGaps, gapMinutes }

Respond ONLY with valid JSON, no markdown.`;

      const response = await generateAIResponse(prompt);
      const parsed = JSON.parse(response);
      setInsights(parsed);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const renderEventCard = (event: Event) => {
    const done = event.status === 'completed';
    const start = event.start_time ? new Date(event.start_time) : null;
    const end = event.end_time ? new Date(event.end_time) : null;

    return (
      <div
        key={event.id}
        className={`tracker-card ${done ? 'completed' : ''} ${event.priority === 'high' ? 'high-priority' : ''}`}
      >
        <button className={`tracker-checkbox ${done ? 'checked' : ''}`} onClick={() => toggleComplete(event)}>
          {done && <span>&#10003;</span>}
        </button>
        <div className="tracker-card-content">
          <span className="tracker-card-title">{event.title}</span>
          {start && end && (
            <span className="tracker-card-time">
              {fmtTime(start)} - {fmtTime(end)}
            </span>
          )}
        </div>
        <button className="tracker-card-delete" onClick={() => handleDelete(event)}>
          &#10005;
        </button>
      </div>
    );
  };

  return (
    <div className="day-tracker-page">
      {/* Header */}
      <div className="tracker-header">
        <div className="tracker-tabs">
          <button className={view === 'tracker' ? 'active' : ''} onClick={() => setView('tracker')}>
            TRACKER
          </button>
          <button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}>
            AUDIT
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="tracker-date-nav">
        <button onClick={() => changeDate(-1)}>&lt;</button>
        <button className="tracker-date-display" onClick={() => setDate(new Date())}>
          {isToday ? 'Today' : format(date, 'EEE, MMM d')}
          {isToday && <span className="today-dot" />}
        </button>
        <button onClick={() => changeDate(1)}>&gt;</button>
      </div>

      {/* Content */}
      {view === 'tracker' ? (
        <div className="tracker-content">
          {/* Quick Add */}
          <div className="tracker-section">
            <button className="tracker-add-btn" onClick={() => setShowQuickAdd(!showQuickAdd)}>
              {showQuickAdd ? 'CLOSE' : 'ADD EVENT'}
            </button>

            {showQuickAdd && (
              <div className="tracker-quick-add">
                <input
                  type="text"
                  placeholder="What did you work on?"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                />
                <label className="tracker-no-date">
                  <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
                  No date (simple todo)
                </label>
                {!noDate && (
                  <div className="tracker-time-inputs">
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    <span>to</span>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                )}
                <button className="tracker-submit-btn" onClick={handleQuickAdd} disabled={!quickTitle.trim()}>
                  ADD
                </button>
              </div>
            )}
          </div>

          {/* Scheduled Events */}
          <div className="tracker-section">
            <div className="tracker-section-header">
              <span className="tracker-section-title">SCHEDULED</span>
              <span className="tracker-badge">{pendingEvents.length}</span>
            </div>
            {pendingEvents.length === 0 ? (
              <div className="tracker-empty">No scheduled events</div>
            ) : (
              <div className="tracker-list">{pendingEvents.map(renderEventCard)}</div>
            )}
          </div>

          {/* Todos */}
          <div className="tracker-section">
            <div className="tracker-section-header">
              <span className="tracker-section-title">TODOS</span>
              <span className="tracker-badge">{pendingTodos.length}</span>
            </div>
            {pendingTodos.length === 0 ? (
              <div className="tracker-empty">No todos</div>
            ) : (
              <div className="tracker-list">{pendingTodos.map(renderEventCard)}</div>
            )}
          </div>

          {/* Completed */}
          <div className="tracker-section">
            <div className="tracker-section-header">
              <span className="tracker-section-title">COMPLETED</span>
              <span className="tracker-badge muted">{completed.length}</span>
            </div>
            {completed.length === 0 ? (
              <div className="tracker-empty">No completed items</div>
            ) : (
              <div className="tracker-list">{completed.map(renderEventCard)}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="tracker-content">
          {/* AI Insights */}
          <div className="tracker-section">
            <div className="tracker-insights-card">
              <div className="tracker-section-header">
                <span className="tracker-section-title">AI INSIGHTS</span>
                {!insights && (
                  <button className="tracker-gen-btn" onClick={generateInsights} disabled={generatingInsights}>
                    {generatingInsights ? 'GENERATING...' : 'GENERATE'}
                  </button>
                )}
              </div>

              {insights ? (
                <div className="tracker-insights">
                  <span className={`tracker-severity ${insights.severity}`}>{insights.severity.toUpperCase()}</span>
                  <p className="tracker-verdict">{insights.verdict}</p>
                  <p className="tracker-summary">{insights.summary}</p>
                  {insights.fixes.length > 0 && (
                    <>
                      <span className="tracker-section-title">FIXES FOR TOMORROW</span>
                      <ul className="tracker-fixes">
                        {insights.fixes.map((fix, i) => (
                          <li key={i}>{fix}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="tracker-metrics">
                    <div className="tracker-metric">
                      <span className="tracker-metric-value">{insights.metrics.loggedPercentage}%</span>
                      <span className="tracker-metric-label">logged</span>
                    </div>
                    <div className="tracker-metric">
                      <span className="tracker-metric-value">{insights.metrics.totalGaps}</span>
                      <span className="tracker-metric-label">gaps</span>
                    </div>
                    <div className="tracker-metric">
                      <span className="tracker-metric-value">{Math.round(insights.metrics.gapMinutes / 60)}h</span>
                      <span className="tracker-metric-label">untracked</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="tracker-insights-empty">
                  <span>Generate AI insights for personalized feedback</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="tracker-section">
            <div className="tracker-section-header">
              <span className="tracker-section-title">TIMELINE</span>
            </div>
            {auditBlocks.length === 0 ? (
              <div className="tracker-empty">No activities logged for this day</div>
            ) : (
              <div className="tracker-timeline">
                {auditBlocks.map((block) => (
                  <div key={block.id} className={`tracker-timeline-block ${block.type}`}>
                    <div className="tracker-timeline-time">
                      {fmtTime(block.startTime)} - {fmtTime(block.endTime)}
                    </div>
                    <div className="tracker-timeline-bar" style={{ backgroundColor: block.color }} />
                    <div className="tracker-timeline-info">
                      <span className="tracker-timeline-title">{block.title}</span>
                      <span className="tracker-timeline-duration">{fmtDuration(block.duration)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
