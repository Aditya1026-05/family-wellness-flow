import { Link, useRouterState } from '@tanstack/react-router';
import { Bell, CalendarDays, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, Heart, Home, LogOut, Pencil, Plus, QrCode, Settings, ShieldCheck, Trash2, Users, UserRound, Utensils, Pill, Footprints, Droplets, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { type CareTask, type Parent, type CareAlert, type TaskStatus } from './data';
import { useCareStore } from './store';
import { cn } from '@/lib/utils';

export const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home }, { label: 'Parents', to: '/parents', icon: Users },
  { label: 'Tasks', to: '/tasks', icon: ClipboardList }, { label: 'Alerts', to: '/alerts', icon: Bell }, { label: 'Profile', to: '/profile', icon: UserRound },
] as const;
export function Brand({ compact = false }: { compact?: boolean }) { return <Link to="/" className="inline-flex items-center gap-3 font-extrabold text-foreground" aria-label="CareCircle home"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Heart className="size-5 fill-current" strokeWidth={2.4}/></span>{!compact && <span className="text-xl">CareCircle</span>}</Link>; }
export function Avatar({ parent, size = 'normal' }: { parent: Parent; size?: 'normal' | 'large' }) { return <span className={cn('grid shrink-0 place-items-center rounded-full font-bold text-foreground', parent.color === 'peach' ? 'bg-peach' : parent.color === 'mint' ? 'bg-mint' : 'bg-lavender', size === 'large' ? 'size-16 text-xl' : 'size-12 text-sm')}>{parent.initials}</span>; }
import { api, getCurrentUser } from '@/lib/api';

export function ChildShell({ children, title, subtitle, action }: { children: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  const path = useRouterState({ select: s => s.location.pathname }); const alerts = useCareStore(s => s.alerts);
  const currentUser = getCurrentUser();
  const displayName = currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Family Admin');
  const initials = displayName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || 'FA';
  const logout = () => {
    api.auth.logout();
    useCareStore.getState().reset();
  };

  return <div className="min-h-dvh bg-background lg:flex">
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar px-5 py-8 lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-dvh"><div className="px-3"><Brand /></div><div className="mt-12 px-3 text-xs font-bold uppercase text-muted-foreground">Workspace</div><nav className="mt-4 space-y-1" aria-label="Main navigation">{navItems.map(item => <NavItem key={item.to} {...item} active={path === item.to || (item.to === '/parents' && path.startsWith('/parents/')) || (item.to === '/tasks' && path.startsWith('/tasks/'))} count={item.label === 'Alerts' ? alerts.length : undefined}/>)}</nav><div className="mt-auto border-t pt-6"><div className="flex items-center gap-3 px-3"><div className="grid size-10 place-items-center rounded-full bg-info-soft font-bold text-primary">{initials}</div><div><div className="text-sm font-bold">{displayName}</div><div className="text-xs text-muted-foreground">Family admin</div></div></div><Link to="/" onClick={logout} className="mt-5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><LogOut className="size-4"/> {currentUser?.email === 'aditya@example.com' ? 'Leave demo' : 'Sign out'}</Link></div></aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 hidden h-20 items-center justify-between border-b bg-card px-8 lg:flex">
        <div className="text-sm text-muted-foreground">Family workspace <ChevronRight className="inline size-4"/> <span className="font-semibold text-foreground">{title}</span></div>
        <div className="flex items-center gap-4">
          <Link to="/alerts" className="relative grid size-10 place-items-center rounded-full bg-muted" aria-label={`${alerts.length} alerts`}>
            <Bell className="size-5"/>
            {alerts.length > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive"/>}
          </Link>
          <Link to="/profile" className="grid size-10 place-items-center rounded-full bg-info-soft font-semibold text-primary" aria-label="Profile">{initials}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-8 lg:px-10 lg:pb-14 lg:pt-10">
        <div className="mb-6 lg:hidden flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <Link to="/alerts" className="relative grid size-9 place-items-center rounded-full bg-muted text-foreground" aria-label={`${alerts.length} alerts`}>
              <Bell className="size-4.5"/>
              {alerts.length > 0 && <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{alerts.length}</span>}
            </Link>
            <Link to="/profile" className="grid size-9 place-items-center rounded-full bg-info-soft text-xs font-bold text-primary" aria-label="Profile">{initials}</Link>
          </div>
        </div>
        <div className="mb-6 sm:mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </div>
    </div>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden">
      {navItems.map(item => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            'relative flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
            path === item.to || path.startsWith(`${item.to}/`) ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <div className="relative">
            <item.icon className="size-5"/>
            {item.label === 'Alerts' && alerts.length > 0 && (
              <span className="absolute -top-1 -right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {alerts.length}
              </span>
            )}
          </div>
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  </div>;
}
function NavItem({ label, to, icon: Icon, active, count }: { label: string; to: string; icon: LucideIcon; active: boolean; count?: number | undefined }) { return <Link to={to} className={cn('flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors', active ? 'bg-info-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-5"/>{label}{count !== undefined && count > 0 && <span className="ml-auto rounded-full bg-danger-soft px-2 py-0.5 text-xs text-destructive">{count}</span>}</Link>; }
export function SectionTitle({ title, link, to }: { title: string; link?: string | undefined; to?: '/parents' | '/tasks' | '/alerts' | undefined }) { return <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-bold sm:text-xl">{title}</h2>{link && to && <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">{link}<ChevronRight className="size-4"/></Link>}</div>; }
export function StatusBadge({ status }: { status: TaskStatus }) { return <Badge variant="secondary" className={cn('rounded-full px-2.5 py-1 text-xs font-bold capitalize shadow-none', status === 'completed' ? 'bg-success-soft text-success' : status === 'missed' ? 'bg-danger-soft text-destructive' : 'bg-info-soft text-primary')}>{status}</Badge>; }
export function CategoryIcon({ category }: { category: CareTask['category'] }) { const icons = { Meal: Utensils, Medicine: Pill, Exercise: Footprints, Appointment: CalendarDays, Wellness: Droplets }; const Icon = icons[category]; return <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-primary" aria-hidden="true"><Icon className="size-5"/></span>; }

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-3.5 sm:p-4 soft-shadow">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CategoryIcon category={task.category}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="truncate font-bold text-sm sm:text-base">{task.name}</span>
            {isEnded && hasUncompleted && (
              <Badge variant="outline" className="border-warning/50 text-[10px] text-warning px-1.5 py-0">
                Ended
              </Badge>
            )}
            {!hasUncompleted && completedTimeStr && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold text-success">
                <Check className="size-3" /> Completed {completedTimeStr}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{parentLabel}</span>
            <span>·</span>
            <span>{timeLabel}</span>
          </div>
          {parentStatuses.length > 1 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {parentStatuses.map(ps => (
                <span
                  key={ps.parentId}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold",
                    ps.status === 'completed'
                      ? 'bg-success-soft text-success'
                      : ps.status === 'missed'
                      ? 'bg-danger-soft text-destructive'
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
      <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
        <StatusBadge status={hasUncompleted ? task.status : 'completed'}/>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {onComplete && hasUncompleted && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold text-success hover:bg-success-soft hover:text-success"
              onClick={(e) => { e.stopPropagation(); onComplete(task); }}
              title="Mark Completed (Caregiver override)"
            >
              <Check className="size-3.5 mr-1" /> Complete
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={(e)=>{e.stopPropagation();onEdit(task);}} aria-label={`Edit ${task.name}`} title="Edit task">
              <Pencil className="size-3.5"/>
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={(e)=>{e.stopPropagation();onDelete(task);}} aria-label={`Delete ${task.name}`} title="Delete task">
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
  return (
    <div className="rounded-xl border bg-card p-5 soft-shadow">
      <div className="flex items-start gap-4">
        <Avatar parent={parent} size="large"/>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">{parent.name}</div>
          <div className="text-sm text-muted-foreground">{parent.relationship}</div>
        </div>
        <span className="rounded-full bg-success-soft px-3 py-1 text-sm font-bold text-success">{parent.completion}%</span>
      </div>
      {tasks.length > 0 && (
        <div className="mt-5 space-y-2 border-t pt-4">
          {tasks.slice(0, 2).map(task => (
            <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{task.name}</span>
              <StatusBadge status={task.status}/>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground">Last activity · {parent.lastActivity}</span>
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {onViewInvite && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={(e)=>{e.stopPropagation();onViewInvite(parent);}}
              aria-label={`View QR and code for ${parent.name}`}
              title="View QR & invite code"
            >
              <QrCode className="size-3.5"/>
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={(e)=>{e.stopPropagation();onEdit(parent);}} aria-label={`Edit ${parent.name}`} title="Edit parent">
              <Pencil className="size-3.5"/>
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={(e)=>{e.stopPropagation();onDelete(parent);}} aria-label={`Delete ${parent.name}`} title="Delete parent">
              <Trash2 className="size-3.5"/>
            </Button>
          )}
          <Link to="/parents/$parentId" params={{ parentId: parent.id }} className="flex items-center text-sm font-bold text-primary ml-1">
            View <ChevronRight className="size-4"/>
          </Link>
        </div>
      </div>
    </div>
  );
}
export function AlertCard({ alert, onDismiss }: { alert: CareAlert; onDismiss?: () => void }) { return <div className="flex gap-4 rounded-xl border bg-card p-4 soft-shadow sm:p-5"><div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', alert.priority === 'High' || alert.priority === 'Critical' ? 'bg-danger-soft text-destructive' : 'bg-warning-soft text-warning')}><Bell className="size-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{alert.title}</h3><Badge variant="secondary" className={cn('rounded-full text-xs', alert.priority === 'High' || alert.priority === 'Critical' ? 'bg-danger-soft text-destructive' : 'bg-warning-soft text-warning')}>{alert.priority}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p><p className="mt-2 text-xs text-muted-foreground">{alert.time}</p></div>{onDismiss && <Button variant="ghost" size="sm" onClick={onDismiss} aria-label={`Dismiss ${alert.title}`} title="Dismiss alert"><Check/></Button>}</div>; }
export function StatCard({ icon: Icon, label, value, note, tone = 'blue' }: { icon: LucideIcon; label: string; value: string | number; note?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) { const toneClass = { blue: 'bg-info-soft text-primary', green: 'bg-success-soft text-success', amber: 'bg-warning-soft text-warning', red: 'bg-danger-soft text-destructive' }; return <div className="rounded-xl border bg-card p-5 soft-shadow"><div className={cn('mb-5 grid size-11 place-items-center rounded-xl', toneClass[tone])}><Icon className="size-5"/></div><div className="text-3xl font-extrabold">{value}</div><div className="mt-1 text-sm font-semibold">{label}</div>{note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}</div>; }
export function EmptyState({ icon: Icon = CircleHelp, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode }) { return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-info-soft text-primary"><Icon className="size-7"/></div><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function ActivityTimeline({ items }: { items: { title: string; time: string; status?: TaskStatus }[] }) { return <div className="space-y-0">{items.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-4"><div className="flex flex-col items-center"><div className={cn('z-10 grid size-9 shrink-0 place-items-center rounded-full', item.status === 'missed' ? 'bg-danger-soft text-destructive' : item.status === 'pending' ? 'bg-info-soft text-primary' : 'bg-success-soft text-success')}>{item.status === 'missed' ? <Bell className="size-4"/> : item.status === 'pending' ? <CalendarDays className="size-4"/> : <Check className="size-4"/>}</div>{index < items.length - 1 && <div className="min-h-9 w-px flex-1 bg-border"/>}</div><div className="pb-7"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.time}</p></div></div>)}</div>; }
export function PageSkeleton() { return <div className="space-y-4"><Skeleton className="h-10 w-1/3"/><div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map(x => <Skeleton key={x} className="h-40 rounded-xl"/>)}</div></div>; }
export function QuickAdd({ to, label }: { to: '/tasks/new' | '/parents/new'; label: string }) { return <Button asChild size="lg" className="h-11 rounded-xl"><Link to={to}><Plus className="size-4"/><span className="hidden sm:inline">{label}</span><span className="sm:hidden">Add</span></Link></Button>; }
export function SettingsRow({ icon: Icon, title, detail, children }: { icon: LucideIcon; title: string; detail?: string; children?: React.ReactNode }) { return <div className="flex min-h-16 items-center gap-4 border-b py-4 last:border-b-0"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-5"/></div><div className="min-w-0 flex-1"><div className="font-semibold">{title}</div>{detail && <div className="text-sm text-muted-foreground">{detail}</div>}</div>{children}</div>; }
export { Settings, ShieldCheck };
