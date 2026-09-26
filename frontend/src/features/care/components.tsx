import { Link, useRouterState } from '@tanstack/react-router';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  HeartHandshake,
  Home,
  Info,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  UserRound,
  Utensils,
  Pill,
  Footprints,
  Droplets,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { type CareTask, type Parent, type CareAlert, type TaskStatus } from './data';
import { useCareStore } from './store';
import { api, getCurrentUser } from '@/lib/api';
import { cn } from '@/lib/utils';

export const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'Parents', to: '/parents', icon: Users },
  { label: 'Tasks', to: '/tasks', icon: ClipboardList },
  { label: 'Alerts', to: '/alerts', icon: Bell },
  { label: 'Profile', to: '/profile', icon: UserRound },
] as const;

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/" className="focus-ring inline-flex items-center gap-3 rounded-xl" aria-label="CareCircle home">
      <span className={cn('grid size-9 place-items-center rounded-xl transition', light ? 'bg-white/12 text-white' : 'bg-primary/10 text-primary')}>
        <HeartHandshake className="size-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className={cn('text-[18px] font-bold tracking-[-0.02em]', light ? 'text-white' : 'text-foreground')}>
          CareCircle
        </span>
      )}
    </Link>
  );
}

export function Avatar({
  parent,
  size = 'normal',
}: {
  parent: Parent | { name: string; initials?: string; color?: string };
  size?: 'small' | 'normal' | 'large';
}) {
  const initials = parent.initials || parent.name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'P';
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold',
        parent.color === 'peach'
          ? 'bg-peach text-foreground'
          : parent.color === 'mint'
          ? 'bg-mint text-foreground'
          : parent.color === 'lavender'
          ? 'bg-lavender text-foreground'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
        size === 'large' ? 'size-16 text-xl' : size === 'small' ? 'size-8 text-xs' : 'size-11 text-sm'
      )}
    >
      {initials}
    </span>
  );
}

export function ChildShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const path = useRouterState({ select: s => s.location.pathname });
  const alerts = useCareStore(s => s.alerts);
  const currentUser = getCurrentUser();
  const displayName = currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Family Admin');
  const initials = displayName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || 'FA';
  const logout = () => {
    api.auth.logout();
    useCareStore.getState().reset();
  };

  const isDevOrTesting = Boolean(
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.search.includes('test') ||
      window.location.search.includes('dev')
    ))
  );

  const todayDateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="app-grain min-h-[100dvh] bg-background lg:flex">
      {/* Sleek Dark Graphite/Charcoal Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground lg:flex lg:sticky lg:top-0 lg:h-dvh border-r border-sidebar-border">
        <div className="px-2">
          <Brand light />
        </div>
        <div className="mt-10 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-sidebar-foreground/50">
          Family care
        </div>
        <nav className="mt-3 space-y-1.5" aria-label="Main navigation">
          {navItems.map(item => {
            const isActive = path === item.to || (item.to !== '/dashboard' && path.startsWith(`${item.to}/`));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'
                )}
              >
                <item.icon className={cn("size-4.5", isActive ? "text-white" : "text-sidebar-foreground/75")} />
                <span>{item.label}</span>
                {item.label === 'Alerts' && alerts.length > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                    {alerts.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
          <ShieldCheck className="size-4.5 text-emerald-400" />
          <p className="mt-2.5 text-sm font-semibold text-white">A calmer care routine</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/70">
            Small updates keep everyone close, even from a distance.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border pt-4 px-1">
          <div className="grid size-9 place-items-center rounded-full bg-white/10 text-white font-bold text-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Family coordinator</p>
          </div>
          <Link
            to="/"
            onClick={logout}
            title={currentUser?.email === 'aditya@example.com' ? 'Leave demo' : 'Sign out'}
            className="text-sidebar-foreground/60 hover:text-white transition p-1"
          >
            <LogOut className="size-4" />
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top Header */}
        <header className="sticky top-0 z-20 hidden h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-8 backdrop-blur lg:flex">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">Your family, in one gentle view</p>
          </div>
          <div className="flex items-center gap-3">
            {isDevOrTesting && (
              <Link
                to="/parent/home"
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
              >
                <UserRound className="size-3.5" />
                <span>Parent view</span>
              </Link>
            )}
            <Link
              to="/alerts"
              className="relative grid size-10 place-items-center rounded-xl bg-card border border-border hover:bg-muted transition text-foreground"
              aria-label={`${alerts.length} alerts`}
            >
              <Bell className="size-4.5" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-900">
                  {alerts.length}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              className="grid size-10 place-items-center rounded-xl bg-primary/10 font-bold text-sm text-primary hover:brightness-105 transition"
              aria-label="Profile"
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="mx-auto max-w-[1440px] px-4 py-5 pb-28 sm:px-6 sm:py-7 md:px-10 md:py-10 md:pb-10 animate-rise">
          {/* Mobile Top Header */}
          <div className="mb-5 lg:hidden flex items-center justify-between">
            <Brand />
            <div className="flex items-center gap-2">
              {isDevOrTesting && (
                <Link
                  to="/parent/home"
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Parent view
                </Link>
              )}
              <Link
                to="/alerts"
                className="relative grid size-9 place-items-center rounded-lg bg-card border text-foreground"
                aria-label={`${alerts.length} alerts`}
              >
                <Bell className="size-4" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-slate-900">
                    {alerts.length}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                className="grid size-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
              >
                {initials}
              </Link>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                {todayDateFormatted}
              </p>
              <h1 className="mt-1 font-display text-2xl tracking-[-.02em] sm:text-3xl md:text-4xl text-foreground font-normal">
                {title}
              </h1>
              {subtitle && <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm leading-5 sm:leading-6 text-muted-foreground">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0 max-w-full overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">{action}</div>}
          </div>

          {children}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/80 bg-card/95 px-1 py-1 backdrop-blur-md lg:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {navItems.map(item => {
          const isActive = path === item.to || (item.to !== '/dashboard' && path.startsWith(`${item.to}/`));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative flex items-center justify-center">
                <item.icon className="size-4 shrink-0 stroke-[1.8]" />
                {item.label === 'Alerts' && alerts.length > 0 && (
                  <span className="absolute -top-1 -right-2 flex size-3 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-slate-900">
                    {alerts.length}
                  </span>
                )}
              </div>
              <span className="truncate leading-tight text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SectionTitle({
  title,
  link,
  to,
}: {
  title: string;
  link?: string | undefined;
  to?: '/parents' | '/tasks' | '/alerts' | undefined;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-bold sm:text-xl text-foreground">{title}</h2>
      {link && to && (
        <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {link}
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const colors = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    snoozed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', colors[status] || colors.pending)}>
      {status}
    </span>
  );
}

export function CategoryIcon({ category }: { category: CareTask['category'] }) {
  const iconConfigs = {
    Meal: { icon: Utensils, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    Medicine: { icon: Pill, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    Exercise: { icon: Footprints, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    Appointment: { icon: CalendarDays, cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    Wellness: { icon: Droplets, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  };
  const config = iconConfigs[category] || iconConfigs.Wellness;
  const Icon = config.icon;
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', config.cls)} aria-hidden="true">
      <Icon className="size-5" />
    </span>
  );
}

export function TaskCard({
  task,
  parent,
  onEdit,
  onDelete,
  onComplete,
}: {
  task: CareTask;
  parent?: Parent | null | undefined;
  onEdit?: ((task: CareTask) => void) | undefined;
  onDelete?: ((task: CareTask) => void) | undefined;
  onComplete?: ((task: CareTask) => void) | undefined;
}) {
  const isEnded = task.is_ended || task.isEnded;
  const parentStatuses = task.parentStatuses || task.parent_statuses || [];
  const parentLabel = task.assigned_parent_names && task.assigned_parent_names.length > 0
    ? task.assigned_parent_names.join(', ')
    : (parent?.name || parent?.relationship || 'Parent');
  const timeLabel = task.endTime ? `${task.time} – ${task.endTime}` : task.time;
  const completedTimeStr = task.completedTime || task.completed_time
    ? (task.completedTime || task.completed_time)
    : (task.completedAt || task.completed_at ? new Date(task.completedAt || task.completed_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);

  const hasUncompleted = parentStatuses.length > 0
    ? parentStatuses.some(ps => ps.status !== 'completed')
    : task.status !== 'completed';

  return (
    <div className="card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-card-border bg-card p-4 transition-all hover:border-border">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <CategoryIcon category={task.category}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold text-sm sm:text-base text-foreground", !hasUncompleted && "text-muted-foreground line-through")}>
              {task.name}
            </span>
            {isEnded && hasUncompleted && (
              <Badge variant="outline" className="border-warning/50 text-[10px] text-warning px-1.5 py-0">
                Ended
              </Badge>
            )}
            {(task.ring_alarm || task.ringAlarm) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-bold">
                <Bell className="size-3" /> Alarm
              </span>
            )}
            {!hasUncompleted && completedTimeStr && (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold">
                <Check className="size-3" /> Completed {completedTimeStr}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{parentLabel}</span>
            <span>·</span>
            <span>{timeLabel}</span>
            {task.repeat && (
              <>
                <span>·</span>
                <span>{task.repeat}</span>
              </>
            )}
          </div>
          {parentStatuses.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {parentStatuses.map(ps => (
                <span
                  key={ps.parentId}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold",
                    ps.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : ps.status === 'missed'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {ps.status === 'completed' ? <Check className="size-3" /> : <Clock3 className="size-3" />}
                  <span>{ps.relationship || ps.parentName}:</span>
                  <span className="capitalize">{ps.status === 'completed' ? (ps.completedTime ? `Done ${ps.completedTime}` : 'Done') : ps.status}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/60">
        <StatusBadge status={hasUncompleted ? task.status : 'completed'}/>
        <div className="flex items-center gap-1">
          {onComplete && hasUncompleted && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/40"
              onClick={(e) => { e.stopPropagation(); onComplete(task); }}
              title="Mark Completed (Caregiver override)"
            >
              <Check className="size-3.5 mr-1" /> Complete
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={(e)=>{e.stopPropagation();onEdit(task);}}
              aria-label={`Edit ${task.name}`}
              title="Edit task"
            >
              <Pencil className="size-3.5"/>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive rounded-lg"
              onClick={(e)=>{e.stopPropagation();onDelete(task);}}
              aria-label={`Delete ${task.name}`}
              title="Delete task"
            >
              <Trash2 className="size-3.5"/>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ParentCard({
  parent,
  tasks = [],
  onEdit,
  onDelete,
  onViewInvite,
}: {
  parent: Parent;
  tasks?: CareTask[] | undefined;
  onEdit?: ((parent: Parent) => void) | undefined;
  onDelete?: ((parent: Parent) => void) | undefined;
  onViewInvite?: ((parent: Parent) => void) | undefined;
}) {
  const status = parent.completion >= 90
    ? { label: 'On track', tone: 'success' as const }
    : parent.completion >= 75
    ? { label: 'Needs attention', tone: 'warning' as const }
    : { label: 'Needs support', tone: 'danger' as const };

  return (
    <div className="card-shadow rounded-2xl border border-card-border bg-card p-5 transition-all hover:border-border">
      <div className="flex items-start gap-4">
        <Avatar parent={parent} size="large"/>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-foreground">{parent.name}</div>
          <div className="text-sm text-muted-foreground">{parent.relationship}</div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{parent.completion}%</p>
          <span className={cn(
            'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold mt-0.5',
            status.tone === 'success'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : status.tone === 'warning'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          )}>
            {status.label}
          </span>
        </div>
      </div>
      {tasks.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{task.name}</span>
              <StatusBadge status={task.status}/>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground">Last activity · {parent.lastActivity}</span>
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {onViewInvite && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary rounded-lg"
              onClick={(e)=>{e.stopPropagation();onViewInvite(parent);}}
              aria-label={`View QR and code for ${parent.name}`}
              title="View QR & invite code"
            >
              <QrCode className="size-3.5"/>
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={(e)=>{e.stopPropagation();onEdit(parent);}}
              aria-label={`Edit ${parent.name}`}
              title="Edit parent"
            >
              <Pencil className="size-3.5"/>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive rounded-lg"
              onClick={(e)=>{e.stopPropagation();onDelete(parent);}}
              aria-label={`Delete ${parent.name}`}
              title="Delete parent"
            >
              <Trash2 className="size-3.5"/>
            </Button>
          )}
          <Link
            to="/parents/$parentId"
            params={{ parentId: parent.id }}
            className="flex items-center text-sm font-semibold text-primary ml-1 hover:underline"
          >
            View <ChevronRight className="size-4 ml-0.5"/>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AlertCard({ alert, onDismiss }: { alert: CareAlert; onDismiss?: () => void }) {
  const isUrgent = alert.priority === 'High' || alert.priority === 'Critical';
  const isCallAction = alert.action_type === 'call_parent' || alert.actionType === 'call_parent' || alert.title.toLowerCase().includes('call');
  const parents = useCareStore(s => s.parents);
  const matchedParent = parents.find(p =>
    (alert.parent_id && p.id === alert.parent_id) ||
    (alert.parentId && p.id === alert.parentId) ||
    (alert.parent_name && p.name && alert.parent_name.toLowerCase() === p.name.toLowerCase()) ||
    (alert.title && p.name && alert.title.toLowerCase().includes(p.name.toLowerCase()))
  );
  const rawPhone = alert.parent_phone || alert.parentPhone || matchedParent?.phone || '';
  const sanitizedPhone = rawPhone ? rawPhone.replace(/[^\d+*#]/g, '') : '';
  const telHref = sanitizedPhone ? `tel:${sanitizedPhone}` : (rawPhone ? `tel:${rawPhone}` : 'tel:');

  const handleCallParent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Resolve phone number from alert, parent store, or fallback
    let targetPhone = sanitizedPhone || rawPhone;
    if (!targetPhone) {
      for (const p of parents) {
        if (p.phone) {
          targetPhone = p.phone.replace(/[^\d+*#]/g, '');
          break;
        }
      }
    }

    if (!targetPhone) {
      const parentLabel = matchedParent?.name || alert.parent_name || 'parent';
      const entered = window.prompt(
        `Enter phone number to call ${parentLabel}:`,
        '+91 98765 43210'
      );
      if (entered) {
        targetPhone = entered.replace(/[^\d+*#]/g, '');
      }
    }

    if (!targetPhone) {
      alert(`No phone number available to call ${matchedParent?.name || 'parent'}.`);
      return;
    }

    // 2. Dispatch via native React Native bridge if inside companion app
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      try {
        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'CALL_PARENT',
            phone: targetPhone,
            parent_name: matchedParent?.name || alert.parent_name || 'Parent',
          })
        );
      } catch (err) {
        console.warn('Bridge postMessage error:', err);
      }
    }

    // 3. Trigger phone dialer navigation
    window.location.href = `tel:${targetPhone}`;
  };

  const cleanTitle = (alert.title || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F680}-\u{1F6FF}\u{1F600}-\u{1F64F}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\bAlarm:\s*/gi, ': ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanDetail = (alert.detail || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F680}-\u{1F6FF}\u{1F600}-\u{1F64F}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className="card-shadow flex flex-col rounded-2xl border border-card-border bg-card p-4 transition hover:border-border">
      {/* Header Row: Icon + Title & Badges */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl',
            isUrgent
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
          )}
        >
          {isCallAction ? <Phone className="size-4 text-rose-600" /> : <Info className="size-4 text-amber-600" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug break-words">
              {cleanTitle}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  isUrgent
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                )}
              >
                {alert.priority}
              </span>
              {alert.time && (
                <span className="text-[11px] text-muted-foreground">{alert.time}</span>
              )}
            </div>
          </div>

          {cleanDetail && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed break-words">
              {cleanDetail}
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 flex items-center gap-2">
        {isCallAction && (
          <Button
            type="button"
            size="sm"
            onClick={handleCallParent}
            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-medium text-xs h-8.5 shadow-none inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none"
          >
            <Phone className="size-3.5 shrink-0 pointer-events-none" />
            <span>Call Parent</span>
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            aria-label={`Resolve ${cleanTitle}`}
            title="Resolve alert"
            className={cn(
              "rounded-xl text-xs font-medium h-8.5 border-border/80 text-muted-foreground hover:text-foreground",
              isCallAction ? "flex-1" : "w-full"
            )}
          >
            <Check className="size-3.5 mr-1 text-muted-foreground" /> Resolve
          </Button>
        )}
      </div>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = 'blue',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    blue: 'bg-blue-100 text-primary dark:bg-blue-950/40',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="card-shadow rounded-2xl border border-card-border bg-card p-3.5 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{label}</p>
        <span className={cn('grid size-7 sm:size-9 place-items-center rounded-lg sm:rounded-xl shrink-0', toneClass[tone])}>
          <Icon className="size-3.5 sm:size-4.5" />
        </span>
      </div>
      <p className="mt-2 sm:mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {note && <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground truncate">{note}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40">
        <Sparkles className="size-5" />
      </div>
      <h3 className="font-semibold text-foreground text-base">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ActivityTimeline({ items }: { items: { title: string; time: string; status?: TaskStatus }[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const isPositive = item.status === 'completed' || item.title.toLowerCase().includes('completed');
        return (
          <div key={`${item.title}-${index}`} className="flex gap-3.5 items-start">
            <span
              className={cn(
                'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                isPositive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              )}
            >
              {isPositive ? <Check className="size-4" /> : <Info className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map(x => (
          <Skeleton key={x} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function QuickAdd({ to, label }: { to: '/tasks/new' | '/parents/new'; label: string }) {
  return (
    <Button asChild size="lg" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
      <Link to={to}>
        <Plus className="size-4 mr-1.5" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">Add</span>
      </Link>
    </Button>
  );
}

export function SettingsRow({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-4 border-b border-border/60 py-4 last:border-b-0">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground">{title}</div>
        {detail && <div className="text-sm text-muted-foreground">{detail}</div>}
      </div>
      {children}
    </div>
  );
}

export { Settings, ShieldCheck };
