import { useState } from 'react';
import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, Camera, Check, ChevronRight, Clock3, Heart, History, Home, ScanLine, CalendarDays, ArrowLeft, HeartHandshake, CheckCircle2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand, CategoryIcon, EmptyState, StatusBadge } from './components';
import { useCareStore } from './store';
import { defaultHistory } from './data';
import { cn } from '@/lib/utils';
import { api, getCurrentParentProfile } from '@/lib/api';

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

      <nav aria-label="Parent navigation" className="fixed inset-x-0 bottom-4 z-30 mx-auto max-w-md px-4">
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl shadow-slate-300/50 backdrop-blur dark:shadow-black/50">
          {links.map(l => {
            const isActive = path === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-semibold transition',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <l.icon className="size-4.5" />
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
  const tasks = useCareStore(s => s.tasks);
  const complete = useCareStore(s => s.completeTask);
  const snooze = useCareStore(s => s.snoozeTask);
  const snoozed = useCareStore(s => s.snoozedTaskId);

  const active = tasks.find(t => {
    const isAssigned = t.parentId === parentId || t.parentIds?.includes(parentId);
    if (!isAssigned) return false;
    const pStat = (t.parentStatuses || t.parent_statuses || []).find(s => s.parentId === parentId || s.parent_id === parentId);
    const status = pStat?.status || t.status;
    return status === 'pending';
  });

  const isEnded = active ? (active.is_ended || active.isEnded) : false;
  const timeLabel = active ? (active.endTime ? `${active.time} – ${active.endTime}` : active.time) : '';
  const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <ParentShell>
      <div className="pt-2 text-center md:pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {todayLabel}
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">
          Good morning, {parentName}
        </p>
      </div>

      {active ? (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl shadow-slate-200/40 md:p-12">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-blue-100 text-primary dark:bg-blue-950/40">
            <Clock3 className="size-9" />
          </div>

          <p className="mt-8 text-xs font-bold uppercase tracking-[.15em] text-primary">
            Your next step
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl md:text-6xl text-foreground leading-tight">
            {active.name}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {timeLabel}
          </p>

          {(active.detail || active.notes) && (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-muted/60 px-5 py-4 text-sm leading-6 text-muted-foreground">
              {active.detail || active.notes}
            </div>
          )}

          {snoozed === active.id && (
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
                onClick={() => complete(active.id, { parentIds: [parentId] })}
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
      ) : (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-10 text-center shadow-xl shadow-slate-200/40">
          <CheckCircle2 className="mx-auto size-16 text-green-600" />
          <h2 className="mt-6 font-display text-3xl sm:text-4xl">
            You're all set, {parentName}.
          </h2>
          <p className="mt-3 text-muted-foreground">
            There are no more actions for now. Enjoy your day!
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
  const tasks = useCareStore(s => s.tasks).filter(t => t.parentId === parentId || t.parentIds?.includes(parentId));
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
          const pStat = (t.parentStatuses || t.parent_statuses || []).find(s => s.parentId === parentId || s.parent_id === parentId);
          const parentStatus = pStat?.status || t.status;
          const isEnded = (t.is_ended || t.isEnded) && parentStatus !== 'completed';
          const timeLabel = t.endTime ? `${t.time} – ${t.endTime}` : t.time;
          const completedTimeStr = pStat?.completedTime || pStat?.completed_time || t.completedTime || t.completed_time
            ? (pStat?.completedTime || pStat?.completed_time || t.completedTime || t.completed_time)
            : ((pStat?.completedAt || t.completedAt || t.completed_at) ? new Date(pStat?.completedAt || t.completedAt || t.completed_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);

          return (
            <div key={t.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 card-shadow">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-2xl',
                  parentStatus === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : parentStatus === 'missed'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-blue-100 text-primary dark:bg-blue-950/40'
                )}
              >
                {parentStatus === 'completed' ? <Check className="size-5" /> : <Clock3 className="size-5" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={cn('text-base font-bold', parentStatus === 'completed' && 'line-through text-muted-foreground')}>
                    {t.name}
                  </h2>
                  {isEnded && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Ended</span>}
                </div>
                {parentStatus === 'completed' ? (
                  <p className="mt-1 text-xs font-semibold text-green-600 flex items-center gap-1">
                    <Check className="size-3.5 shrink-0" /> Completed {completedTimeStr ? `at ${completedTimeStr}` : 'today'}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{timeLabel}</p>
                )}
              </div>

              <StatusBadge status={parentStatus} />
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
  const { data: weekly } = useQuery({
    queryKey: ['parent-adherence', profile?.parent_profile_id],
    queryFn: () => profile?.parent_profile_id ? api.parents.getWeeklyAdherence(profile.parent_profile_id) : Promise.resolve(defaultHistory),
    enabled: !!profile?.parent_profile_id,
  });

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

  const historyData = weekly || defaultHistory;
  const completedCount = historyData.filter(d => d.rate >= 50).length;

  return (
    <ParentShell>
      <div className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl">{parentName} history</h1>
        <p className="mt-2 text-sm text-muted-foreground">The last seven days, at a glance.</p>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-card p-7 text-center card-shadow">
        <p className="text-sm font-semibold text-muted-foreground">Things you completed</p>
        <p className="mt-3 text-6xl font-bold text-green-600 font-display">{completedCount}</p>
        <p className="mt-2 text-sm text-muted-foreground">days with active care</p>

        <div className="mt-8 grid grid-cols-7 gap-2">
          {historyData.map((item, i) => (
            <div key={item.day}>
              <div
                className={cn(
                  'mx-auto flex h-12 w-8 items-center justify-center rounded-full transition-all',
                  item.rate >= 90
                    ? 'bg-green-500 text-white'
                    : item.rate > 0
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {item.rate >= 90 ? <Check className="size-4" /> : item.rate > 0 ? <Clock3 className="size-3.5" /> : null}
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">{item.day}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{item.rate}%</p>
            </div>
          ))}
        </div>
      </div>

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
