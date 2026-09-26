import { useState } from 'react';
import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Camera, Check, ChevronRight, Clock3, Heart, History, Home, ScanLine, CalendarDays, ArrowLeft, HeartHandshake, CheckCircle2, Pause, Moon, Sun, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand, CategoryIcon, EmptyState, StatusBadge } from './components';
import { useCareStore } from './store';
import { defaultHistory } from './data';
import { cn } from '@/lib/utils';
import { api, getCurrentParentProfile } from '@/lib/api';
import { AdherenceTracker } from './adherence-view';

export function ParentShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const links = [
    { to: '/parent/home', label: 'Next', icon: Clock3 },
    { to: '/parent/today', label: 'Today', icon: CalendarDays },
    { to: '/parent/history', label: 'History', icon: History },
  ] as const;

  return (
    <div className="min-h-[100dvh] bg-[#f4f8fc] pb-28 text-slate-800 dark:bg-background dark:text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-[#f4f8fc]/90 px-6 py-4 backdrop-blur dark:bg-background/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
              Parent view
            </span>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> Exit
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-6 sm:pt-10">
        {children}
      </main>

      <nav aria-label="Parent navigation" className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-sm px-4">
        <div className="grid grid-cols-3 rounded-2xl border border-border/80 bg-card/95 p-1 shadow-lg shadow-slate-300/40 backdrop-blur-md dark:shadow-black/50">
          {links.map(l => {
            const isActive = path === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <l.icon className="size-4 shrink-0 stroke-[1.8]" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function ScanPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const proceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.invites.accept(code.trim());
      await useCareStore.getState().init();
      navigate({ to: '/parent/welcome' });
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired invite code. Please check your 6-character code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f4f8fc] dark:bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Brand />
        <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          Exit
        </Link>
      </header>

      <main className="mx-auto max-w-md px-6 py-8 text-center sm:py-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-primary dark:bg-blue-950/40">
          <ScanLine className="size-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl sm:text-4xl text-foreground">
          Connect to your family
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Enter the 6-character code your family shared with you, or scan their QR code.
        </p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
          <div className="mx-auto grid aspect-square w-full max-w-[200px] place-items-center rounded-2xl border-2 border-dashed border-primary/40 bg-blue-50 text-primary dark:bg-blue-950/20">
            <div className="text-center">
              <Camera className="mx-auto size-12" />
              <p className="mt-2 text-xs font-semibold">QR scanner preview</p>
            </div>
          </div>

          <form onSubmit={proceed} className="mt-6 space-y-4">
            <div>
              <label htmlFor="invite-input" className="mb-2 block text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                6-Character Invite Code
              </label>
              <Input
                id="invite-input"
                aria-label="Invite code"
                placeholder="e.g. K8N2XP"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={50}
                className="h-14 text-center font-mono text-xl font-bold uppercase tracking-widest rounded-xl"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive font-medium">{error}</p>}
            <Button type="submit" size="lg" disabled={loading || !code.trim()} className="h-14 w-full rounded-xl text-base font-bold">
              {loading ? 'Connecting...' : 'Connect to family'} <ChevronRight className="size-5 ml-1" />
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            Tip: You can type the 6-character code or paste the full link
          </p>
        </div>

        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-muted-foreground hover:text-foreground">
          Back to start
        </Link>
      </main>
    </div>
  );
}

export function WelcomePage() {
  const profile = getCurrentParentProfile();
  const parentName = profile?.relationship || profile?.parent_name || 'family';

  if (!profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f4f8fc] px-6 text-center dark:bg-background">
        <EmptyState
          icon={ScanLine}
          title="No circle connected"
          description="Please enter your 6-character code or scan your invite."
          action={<Button asChild><Link to="/parent/scan">Connect with code</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f4f8fc] dark:bg-background">
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-12 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <HeartHandshake className="size-10" />
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.14em] text-primary">
          Welcome to CareCircle
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl text-foreground">
          Good to see you, {parentName}.
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          We’ll show you one simple thing at a time. Your family will be nearby, helping keep the day on track.
        </p>
        <Button asChild size="lg" className="mt-9 min-h-14 w-full rounded-2xl text-base font-bold">
          <Link to="/parent/home">
            See today’s next step <ChevronRight className="size-5 ml-1" />
          </Link>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          Nothing to learn. Just one next action.
        </p>
      </main>
    </div>
  );
}

function parseTimeStringToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d+)(?::(\d+))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function ParentHomePage() {
  const profile = getCurrentParentProfile();
  if (!profile) {
    return (
      <ParentShell>
        <EmptyState
          icon={ScanLine}
          title="No family circle connected"
          description="Please scan your family's QR code or enter your 6-character code."
          action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}
        />
      </ParentShell>
    );
  }

  const parentId = profile.parent_profile_id;
  const parentName = profile.relationship || profile.parent_name || 'friend';
  const queryClient = useQueryClient();
  const [snoozedId, setSnoozedId] = useState<string | null>(null);

  const { data: todayTasks = [] } = useQuery({
    queryKey: ['today-instances', parentId],
    queryFn: () => api.tasks.getTodaySchedule(parentId),
    enabled: !!parentId,
    refetchInterval: 10000,
  });

  const complete = async (taskOrInstId: string) => {
    try {
      await api.tasks.complete(taskOrInstId, { parentIds: [parentId] });
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['today-instances', parentId] });
    queryClient.invalidateQueries({ queryKey: ['adherence', parentId] });
    useCareStore.getState().init();
  };

  const snooze = async (taskOrInstId: string) => {
    setSnoozedId(taskOrInstId);
    try {
      await api.tasks.snooze(taskOrInstId, 10);
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['today-instances', parentId] });
    queryClient.invalidateQueries({ queryKey: ['adherence', parentId] });
  };

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = currentHour * 60 + now.getMinutes();

  let greeting = `Good morning, ${parentName}`;
  let GreetingIcon = Sun;
  if (currentHour < 5 || currentHour >= 21) {
    greeting = `Rest well, ${parentName}`;
    GreetingIcon = Moon;
  } else if (currentHour >= 12 && currentHour < 17) {
    greeting = `Good afternoon, ${parentName}`;
    GreetingIcon = Sun;
  } else if (currentHour >= 17 && currentHour < 21) {
    greeting = `Good evening, ${parentName}`;
    GreetingIcon = Coffee;
  }

  const pendingItems = todayTasks
    .filter(t => t.status === 'pending' || t.status === 'snoozed')
    .map(t => {
      const startM = parseTimeStringToMinutes(t.scheduled_time || t.time) ?? 9 * 60;
      const endM = parseTimeStringToMinutes(t.scheduled_end_time || t.endTime) ?? (startM + 60);
      return { task: t, startM, endM };
    })
    .sort((a, b) => a.startM - b.startM);

  // 1. Is there a task scheduled for this time slot (from 30 mins before start to 30 mins after end)?
  const currentSlotItem = pendingItems.find(item => {
    return currentMinutes >= item.startM - 30 && currentMinutes <= item.endM + 30;
  });

  // 2. Is there an overdue task earlier today that was missed/still pending?
  const overdueItem = pendingItems.find(item => {
    return currentMinutes > item.endM + 30;
  });

  // Pick active task: currently due first, otherwise overdue task, otherwise first pending task
  const activeItem = currentSlotItem || overdueItem || (pendingItems.length > 0 ? pendingItems[0] : null);
  const active = activeItem?.task;
  const isOverdue = !!overdueItem && !currentSlotItem && activeItem === overdueItem;
  const nextUpcomingItem = !activeItem && pendingItems.length > 0 ? pendingItems[0] : null;

  const isEnded = active ? (active.is_ended || active.isEnded) : false;
  const timeLabel = active ? (active.endTime || active.scheduled_end_time ? `${active.time || active.scheduled_time} – ${active.endTime || active.scheduled_end_time}` : (active.time || active.scheduled_time)) : '';
  const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <ParentShell>
      <div className="pt-2 text-center md:pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {todayLabel}
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">
          {greeting}
        </p>
      </div>

      {active ? (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl shadow-slate-200/40 md:p-12">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-blue-100 text-primary dark:bg-blue-950/40">
            <Clock3 className="size-9" />
          </div>

          <p className="mt-8 text-xs font-bold uppercase tracking-[.15em] text-primary">
            {isOverdue ? 'Needs attention' : 'Your next step'}
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl md:text-6xl text-foreground leading-tight">
            {active.name || active.title}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {timeLabel}
          </p>

          {(active.detail || active.notes) && (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-muted/60 px-5 py-4 text-sm leading-6 text-muted-foreground">
              {active.detail || active.notes}
            </div>
          )}

          {snoozedId === active.id && (
            <div role="status" className="mx-auto mt-5 max-w-sm rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Okay, we'll remind you again in 10 minutes.
            </div>
          )}

          {isEnded ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center dark:border-amber-900 dark:bg-amber-950/30">
              <div className="text-base font-bold text-amber-900 dark:text-amber-200">Scheduled time has ended</div>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                This task's window has passed ({timeLabel}). Please ask your family caregiver to confirm completion.
              </p>
            </div>
          ) : (
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => complete(active.id)}
                className="min-h-14 rounded-2xl bg-success text-base font-bold text-white hover:bg-success/90 shadow-md shadow-green-600/20"
              >
                <CheckCircle2 className="size-5 mr-1" /> I've done this
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => snooze(active.id)}
                className="min-h-14 rounded-2xl text-base font-bold"
              >
                <Pause className="size-5 mr-1" /> Remind me later
              </Button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            If you need help, your family is just a call away.
          </p>
        </div>
      ) : nextUpcomingItem ? (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl shadow-slate-200/40 md:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-primary dark:bg-blue-950/40">
            <GreetingIcon className="size-8" />
          </div>

          <span className="mt-6 inline-block rounded-full bg-blue-100 px-3.5 py-1 text-xs font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
            NO TASK IN THIS TIME SLOT
          </span>

          <h2 className="mt-4 font-display text-2xl sm:text-3xl text-foreground">
            You're all caught up for now
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No care actions scheduled right at this hour.
          </p>

          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-muted/30 p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Next Upcoming
              </span>
              <span className="text-xs font-semibold text-primary">
                {nextUpcomingItem.task.time || nextUpcomingItem.task.scheduled_time}
              </span>
            </div>
            <p className="mt-1 text-base font-bold text-foreground">
              {nextUpcomingItem.task.name || nextUpcomingItem.task.title}
            </p>
            {(nextUpcomingItem.task.detail || nextUpcomingItem.task.notes) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {nextUpcomingItem.task.detail || nextUpcomingItem.task.notes}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row justify-center max-w-sm mx-auto">
            <div className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <Clock3 className="size-4 shrink-0 text-rose-600" />
              <span>Available in time slot ({nextUpcomingItem.task.time || nextUpcomingItem.task.scheduled_time})</span>
            </div>
            <Button
              asChild
              size="lg"
              className="min-h-12 flex-1 rounded-2xl font-bold"
            >
              <Link to="/parent/today">
                Today's list ({pendingItems.length})
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-10 text-center shadow-xl shadow-slate-200/40">
          <CheckCircle2 className="mx-auto size-16 text-green-600" />
          <h2 className="mt-6 font-display text-3xl sm:text-4xl">
            You're all set, {parentName}.
          </h2>
          <p className="mt-3 text-muted-foreground">
            All tasks for today are completed! Enjoy your day.
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          to="/parent/today"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          See the rest of today <ChevronRight className="size-4" />
        </Link>
      </div>
    </ParentShell>
  );
}

export function ParentTodayPage() {
  const profile = getCurrentParentProfile();
  if (!profile) {
    return (
      <ParentShell>
        <EmptyState
          icon={ScanLine}
          title="No family circle connected"
          description="Please enter your invite code to see today's care tasks."
          action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}
        />
      </ParentShell>
    );
  }

  const parentId = profile.parent_profile_id;
  const parentName = profile.relationship || profile.parent_name || 'Your';

  const { data: tasks = [] } = useQuery({
    queryKey: ['today-instances', parentId],
    queryFn: () => api.tasks.getTodaySchedule(parentId),
    enabled: !!parentId,
    refetchInterval: 10000,
  });

  const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <ParentShell>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{todayLabel}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">{parentName} today</h1>
        <p className="mt-2 text-sm text-muted-foreground">A simple look at your day.</p>
      </div>

      <div className="mt-8 space-y-3">
        {tasks.length ? tasks.map(t => {
          const parentStatus = t.status;
          const isEnded = (t.is_ended || t.isEnded) && parentStatus !== 'completed';
          const timeLabel = (t.endTime || t.scheduled_end_time)
            ? `${t.time || t.scheduled_time} – ${t.endTime || t.scheduled_end_time}`
            : (t.time || t.scheduled_time);
          const completedTimeStr = t.completedTime || t.completed_time;
          const isTaskCompleted = parentStatus === 'completed';

          const startM = parseTimeStringToMinutes(t.scheduled_time || t.time) ?? 9 * 60;
          const currentM = new Date().getHours() * 60 + new Date().getMinutes();
          const isUpcoming = currentM < startM - 30;

          return (
            <div key={t.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 card-shadow">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-2xl',
                  isTaskCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : isEnded || parentStatus === 'missed'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : isUpcoming
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                )}
              >
                {isTaskCompleted ? <Check className="size-5" /> : <Clock3 className="size-5" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={cn('text-base font-bold', isTaskCompleted && 'line-through text-muted-foreground')}>
                    {t.name || t.title}
                  </h2>
                  {isEnded && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-950 dark:text-red-200">Ended</span>}
                </div>
                {isTaskCompleted ? (
                  <p className="mt-1 text-xs font-semibold text-green-600 flex items-center gap-1">
                    <Check className="size-3.5 shrink-0" /> Completed {completedTimeStr ? `at ${completedTimeStr}` : 'today'}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{timeLabel}</p>
                )}
              </div>

              {isTaskCompleted ? (
                <StatusBadge status="completed" />
              ) : isEnded ? (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">Ended</span>
              ) : parentStatus === 'missed' ? (
                <StatusBadge status="missed" />
              ) : isUpcoming ? (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">Opens at {t.time || t.scheduled_time}</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Due now</span>
              )}
            </div>
          );
        }) : (
          <EmptyState title="No tasks scheduled" description="Your family hasn't added any tasks for today yet." />
        )}
      </div>
    </ParentShell>
  );
}

export function ParentHistoryPage() {
  const profile = getCurrentParentProfile();
  const parentName = profile?.relationship || profile?.parent_name || 'Your';

  if (!profile) {
    return (
      <ParentShell>
        <EmptyState
          icon={ScanLine}
          title="No family circle connected"
          description="Please enter your invite code to view your care history."
          action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}
        />
      </ParentShell>
    );
  }

  return (
    <ParentShell>
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl sm:text-4xl">{parentName} history</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track your wellness streak, daily adherence, and completed care routines.
        </p>
      </div>

      <AdherenceTracker
        parentId={profile.parent_profile_id}
        parentName={parentName}
        isParentView
      />

      <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-center text-sm leading-6 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100 border border-blue-100 dark:border-blue-900/40">
        Every completed action is a small way of taking care of yourself.
      </div>
    </ParentShell>
  );
}

export function NotificationDemo() {
  return (
    <ParentShell>
      <h1 className="font-display text-3xl sm:text-4xl">Reminders</h1>
      <div className="mt-8 space-y-4">
        <EmptyState icon={Bell} title="No reminders" description="You have no pending reminders right now." />
      </div>
      <Button variant="ghost" asChild className="mt-5">
        <Link to="/parent/home"><ArrowLeft className="mr-1 size-4" /> Back home</Link>
      </Button>
    </ParentShell>
  );
}
