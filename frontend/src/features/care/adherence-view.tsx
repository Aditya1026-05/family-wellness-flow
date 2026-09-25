import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock3,
  Utensils,
  Pill,
  Footprints,
  Droplets,
  HeartHandshake,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type ParentAdherenceDay, type TaskDayDetail } from './data';

interface AdherenceTrackerProps {
  parentId: string;
  parentName?: string;
  isParentView?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCategoryIcon(category?: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('meal') || cat.includes('food') || cat.includes('breakfast') || cat.includes('lunch') || cat.includes('dinner')) {
    return Utensils;
  }
  if (cat.includes('med') || cat.includes('pill') || cat.includes('drug')) {
    return Pill;
  }
  if (cat.includes('walk') || cat.includes('exercise') || cat.includes('activity')) {
    return Footprints;
  }
  if (cat.includes('water') || cat.includes('hydrat')) {
    return Droplets;
  }
  return HeartHandshake;
}

export function AdherenceTracker({ parentId, parentName = 'Parent', isParentView = false }: AdherenceTrackerProps) {
  const [range, setRange] = useState<'week' | 'month'>('week');

  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);

  const { data: adherenceData, isPending } = useQuery<ParentAdherenceDay[]>({
    queryKey: ['adherence', parentId, range, currentYear, currentMonth],
    queryFn: () => {
      if (!parentId) return Promise.resolve([]);
      if (range === 'month') {
        return api.parents.getAdherence(parentId, 'month', currentYear, currentMonth);
      }
      return api.parents.getAdherence(parentId, 'week');
    },
    enabled: !!parentId,
  });

  const daysList: ParentAdherenceDay[] = useMemo(() => adherenceData || [], [adherenceData]);

  // Find the selected day's adherence record
  const selectedDayRecord = useMemo(() => {
    if (!selectedDate || daysList.length === 0) return null;
    return daysList.find(d => d.date === selectedDate) || null;
  }, [selectedDate, daysList]);

  // Compute month calendar layout details
  const calendarCells = useMemo(() => {
    if (range !== 'month') return [];

    // First day of selected month: Day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    // Convert to Mon=0, Tue=1, ..., Sun=6
    const startDayOffset = (firstDay.getDay() + 6) % 7;

    // Total days in this month
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Map existing adherence data by date string
    const dataByDate = new Map<string, ParentAdherenceDay>();
    for (const d of daysList) {
      if (d.date) {
        dataByDate.set(d.date, d);
      }
    }

    const cells: Array<{
      dayNum: number | null;
      dateStr: string | null;
      data: ParentAdherenceDay | null;
    }> = [];

    // Leading empty padding
    for (let i = 0; i < startDayOffset; i++) {
      cells.push({ dayNum: null, dateStr: null, data: null });
    }

    // Days of month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = dataByDate.get(dateStr) || null;
      cells.push({ dayNum: d, dateStr, data: dayData });
    }

    return cells;
  }, [range, currentYear, currentMonth, daysList]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(todayDateStr);
  };

  // Format selected date display header
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return 'Select a date';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const isToday = selectedDate === todayDateStr;
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const isYesterday = selectedDate === yStr;

      const prefix = isToday ? 'Today · ' : isYesterday ? 'Yesterday · ' : '';
      return `${prefix}${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate, todayDateStr, today]);

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold font-display text-foreground flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <span>{range === 'week' ? 'Weekly adherence' : 'Monthly adherence'}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {range === 'week'
              ? 'Click any day bar to view completed and missed tasks.'
              : 'Calendar view showing adherence rate above each date. Click a date to inspect tasks.'}
          </p>
        </div>

        {/* View Toggle (Week / Month) */}
        <div className="flex items-center gap-2">
          {range === 'month' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleJumpToToday}
              className="h-8 text-xs font-semibold px-2.5 rounded-lg text-muted-foreground hover:text-foreground"
            >
              Today
            </Button>
          )}
          <div className="inline-flex items-center rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setRange('week');
                setSelectedDate(todayDateStr);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
                range === 'week'
                  ? 'bg-card text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => {
                setRange('month');
                if (!selectedDate) setSelectedDate(todayDateStr);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
                range === 'month'
                  ? 'bg-card text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Main Visual Card */}
      <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-6 card-shadow">
        {isPending ? (
          <div className="space-y-4 py-8">
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : range === 'week' ? (
          /* WEEKLY VIEW: BAR-ONLY DESIGN */
          <div className="space-y-3">
            <div className="flex h-44 sm:h-52 items-end justify-between gap-1.5 sm:gap-4 pt-4 pb-2 px-1 sm:px-2">
              {daysList.map(item => {
                const isSelected = selectedDate === item.date;
                const isToday = item.date === todayDateStr;
                const hasTasks = item.has_tasks ?? (item.total_tasks ? item.total_tasks > 0 : false);

                return (
                  <button
                    key={item.day || item.date}
                    type="button"
                    onClick={() => item.date && setSelectedDate(item.date)}
                    className={cn(
                      'group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-xl p-1.5 sm:p-2 transition-all cursor-pointer focus:outline-none',
                      isSelected
                        ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                        : 'hover:bg-muted/40'
                    )}
                  >
                    {/* Rate Percentage on Top */}
                    <span
                      className={cn(
                        'text-[10px] sm:text-xs font-bold transition-colors',
                        item.rate >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.rate > 0
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      )}
                    >
                      {hasTasks || item.rate > 0 ? `${item.rate}%` : '-'}
                    </span>

                    {/* Vertical Adherence Bar */}
                    <div className="relative w-full max-w-8 sm:max-w-12 h-24 sm:h-32 rounded-lg bg-muted/40 overflow-hidden flex items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-lg transition-all duration-300',
                          item.rate >= 80
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : item.rate > 0
                            ? 'bg-primary'
                            : hasTasks
                            ? 'bg-rose-400/70'
                            : 'bg-muted-foreground/20'
                        )}
                        style={{ height: `${Math.max(item.rate, hasTasks ? 8 : 4)}%` }}
                      />
                    </div>

                    {/* Day Label with Today badge */}
                    <div className="text-center">
                      <span
                        className={cn(
                          'block text-[11px] sm:text-xs font-semibold truncate',
                          isSelected
                            ? 'text-primary font-bold'
                            : isToday
                            ? 'text-foreground font-bold'
                            : 'text-muted-foreground'
                        )}
                      >
                        {item.day}
                      </span>
                      {isToday && (
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-primary">
                          Today
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Tip: Click any bar above to view the tasks completed and missed for that day.
            </p>
          </div>
        ) : (
          /* MONTHLY VIEW: CALENDAR WITH PERCENTAGE ABOVE DATE */
          <div className="space-y-4">
            {/* Calendar Month Navigation Header */}
            <div className="flex items-center justify-between px-1 sm:px-2">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold font-display text-foreground">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={handlePrevMonth}
                  title="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={handleNextMonth}
                  title="Next month"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Weekday Columns */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
              {WEEKDAY_NAMES.map(dayName => (
                <div key={dayName} className="py-1 text-[11px] sm:text-xs font-bold text-muted-foreground">
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarCells.map((cell, idx) => {
                if (cell.dayNum === null) {
                  return <div key={`empty-${idx}`} className="h-14 sm:h-16 rounded-xl bg-transparent" />;
                }

                const dateStr = cell.dateStr!;
                const dayData = cell.data;
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayDateStr;
                const hasTasks = dayData?.has_tasks ?? (dayData?.total_tasks ? dayData.total_tasks > 0 : false);
                const rate = dayData?.rate ?? 0;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      'group relative flex h-14 sm:h-16 flex-col items-center justify-between p-1 sm:p-1.5 rounded-xl border transition-all text-center focus:outline-none cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-sm font-semibold'
                        : hasTasks
                        ? 'border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
                        : 'border-border/30 hover:border-border/70 hover:bg-muted/15'
                    )}
                  >
                    {/* PERCENTAGE SHOWN ABOVE DATE */}
                    <div className="w-full flex items-center justify-center pt-0.5">
                      {hasTasks ? (
                        <span
                          className={cn(
                            'text-[10px] sm:text-xs font-extrabold tracking-tight',
                            rate >= 80
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : rate > 0
                              ? 'text-primary'
                              : 'text-rose-500 dark:text-rose-400'
                          )}
                        >
                          {rate}%
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground/35">-</span>
                      )}
                    </div>

                    {/* DATE NUMBER */}
                    <div className="flex items-center justify-center pb-0.5">
                      <span
                        className={cn(
                          'grid size-6 sm:size-7 place-items-center rounded-full text-xs font-bold transition-all',
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : isToday
                            ? 'bg-foreground text-background font-extrabold'
                            : 'text-foreground group-hover:text-primary'
                        )}
                      >
                        {cell.dayNum}
                      </span>
                    </div>

                    {/* Today indicator dot */}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] text-muted-foreground border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>80-100% adherence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                <span>1-79% adherence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span>0% adherence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/50 font-bold">-</span>
                <span>No tasks scheduled</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SELECTED DAY TASK DETAILS BREAKDOWN (FOR BOTH WEEK & MONTH) */}
      <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 card-shadow space-y-4 animate-in fade-in-50 duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h4 className="font-bold text-sm sm:text-base text-foreground font-display flex items-center gap-2">
              <span>{formattedSelectedDate}</span>
              {selectedDayRecord?.has_tasks && (
                <Badge
                  variant={selectedDayRecord.rate >= 80 ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    selectedDayRecord.rate >= 80
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : selectedDayRecord.rate > 0
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  )}
                >
                  {selectedDayRecord.rate}% adherence
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Care activity and completion breakdown for {parentName}.
            </p>
          </div>

          {/* Quick counters */}
          {selectedDayRecord?.has_tasks && (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="size-3.5" />
                {selectedDayRecord.completed_tasks} completed
              </span>
              {selectedDayRecord.total_tasks - selectedDayRecord.completed_tasks > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                  <XCircle className="size-3.5" />
                  {selectedDayRecord.tasks.filter(t => t.status === 'missed').length} missed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Task list for selected date */}
        {selectedDayRecord && selectedDayRecord.tasks && selectedDayRecord.tasks.length > 0 ? (
          <div className="space-y-2.5">
            {selectedDayRecord.tasks.map(task => {
              const Icon = getCategoryIcon(task.category);
              const isCompleted = task.status === 'completed';
              const isMissed = task.status === 'missed';
              const isPending = task.status === 'pending';

              return (
                <div
                  key={task.instance_id || task.task_id}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border transition-all',
                    isCompleted
                      ? 'border-emerald-500/25 bg-emerald-500/5'
                      : isMissed
                      ? 'border-rose-500/25 bg-rose-500/5'
                      : 'border-border/60 bg-muted/20'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl',
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : isMissed
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate flex items-center gap-2">
                        <span>{task.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                          ({task.category})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Clock3 className="size-3 shrink-0" />
                        <span>Scheduled: {task.scheduled_time}</span>
                        {task.completed_time && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Completed at {task.completed_time}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="size-3" />
                        Completed
                      </Badge>
                    ) : isMissed ? (
                      <Badge variant="destructive" className="gap-1 text-[11px] px-2.5 py-1 rounded-lg">
                        <XCircle className="size-3" />
                        Missed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[11px] px-2.5 py-1 rounded-lg text-muted-foreground border-border">
                        <Clock3 className="size-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground space-y-1">
            <CalendarDays className="size-8 mx-auto text-muted-foreground/40 stroke-1 mb-2" />
            <p className="text-sm font-medium text-foreground">No tasks scheduled</p>
            <p className="text-xs">There were no care tasks scheduled for {parentName} on this day.</p>
          </div>
        )}
      </div>
    </div>
  );
}
