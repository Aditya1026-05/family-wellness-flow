import { useState } from 'react';
import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, Camera, Check, ChevronRight, Clock3, Heart, History, Home, ScanLine, CalendarDays, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input';
import { Brand, CategoryIcon, EmptyState, StatusBadge } from './components'; import { useCareStore } from './store'; import { defaultHistory } from './data';
import { cn } from '@/lib/utils';
import { api, getCurrentParentProfile } from '@/lib/api';

export function ParentShell({children}: {children:React.ReactNode}) {
  const path=useRouterState({select:s=>s.location.pathname});
  const links=[{to:'/parent/home',label:'Home',icon:Home},{to:'/parent/today',label:'Today',icon:CalendarDays},{to:'/parent/history',label:'History',icon:History}] as const;
  return <div className="min-h-dvh bg-background pb-24"><header className="border-b bg-card"><div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-5"><Brand/><span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Parent view</span></div></header><div className="mx-auto max-w-3xl px-5 pt-8 sm:pt-12">{children}</div><nav aria-label="Parent navigation" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card pb-[env(safe-area-inset-bottom)]"><div className="mx-auto grid max-w-3xl grid-cols-3">{links.map(l=><Link key={l.to} to={l.to} className={cn('flex h-20 flex-col items-center justify-center gap-1 text-sm font-bold',path===l.to?'text-primary':'text-muted-foreground')}><l.icon className="size-6"/>{l.label}</Link>)}</div></nav></div>;
}

export function ScanPage(){
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const navigate=useNavigate();
  const proceed=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!code.trim())return;
    setLoading(true);
    setError('');
    try {
      await api.invites.accept(code.trim());
      await useCareStore.getState().init();
      navigate({to:'/parent/welcome'});
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired invite code. Please check your 6-character code and try again.');
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center"><Brand/><div className="mt-12 grid size-20 place-items-center rounded-2xl bg-info-soft text-primary"><ScanLine className="size-10"/></div><h1 className="mt-6 text-3xl font-extrabold">Join your family circle</h1><p className="mt-3 max-w-sm text-lg text-muted-foreground">Enter the 6-character invite code your family shared with you, or scan their QR code.</p><div className="mt-9 grid aspect-square w-full max-w-xs place-items-center rounded-2xl border-4 border-dashed border-primary/40 bg-card"><div className="text-center text-primary"><Camera className="mx-auto size-16"/><p className="mt-4 font-semibold">QR scanner preview</p></div></div><form onSubmit={proceed} className="mt-8 w-full max-w-xs space-y-4"><Input aria-label="Invite code" placeholder="e.g. K8N2XP" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={50} className="h-14 text-center text-xl font-mono uppercase tracking-widest"/>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" size="lg" disabled={loading} className="h-14 w-full text-lg">{loading ? 'Connecting...' : 'Continue'} <ChevronRight/></Button></form><p className="mt-3 text-xs text-muted-foreground">Tip: You can type the 6-character code or paste the link</p><Link to="/" className="mt-6 text-sm font-semibold text-muted-foreground">Back to start</Link></div>;
}

export function WelcomePage(){
  const profile=getCurrentParentProfile();
  const parentName=profile?.relationship || profile?.parent_name || 'there';
  if(!profile){
    return <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center"><EmptyState icon={ScanLine} title="No circle connected" description="Please enter your 6-character code or scan your invite." action={<Button asChild><Link to="/parent/scan">Connect with code</Link></Button>}/></div>;
  }
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center"><div className="grid size-24 place-items-center rounded-full bg-peach text-5xl">👋</div><h1 className="mt-8 text-4xl font-extrabold">Welcome, {parentName}</h1><p className="mt-4 max-w-sm text-xl text-muted-foreground">Your family is here with you, every step of the way.</p><Button asChild size="lg" className="mt-10 h-16 w-full max-w-xs rounded-xl text-xl"><Link to="/parent/home">Continue <ChevronRight/></Link></Button></div>;
}

export function ParentHomePage(){
  const profile=getCurrentParentProfile();
  if(!profile){
    return <ParentShell><EmptyState icon={ScanLine} title="No family circle connected" description="Please scan your family's QR code or enter your 6-character code." action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}/></ParentShell>;
  }
  const parentId=profile.parent_profile_id;
  const parentName=profile.relationship || profile.parent_name || 'there';
  const tasks=useCareStore(s=>s.tasks);
  const complete=useCareStore(s=>s.completeTask);
  const snooze=useCareStore(s=>s.snoozeTask);
  const snoozed=useCareStore(s=>s.snoozedTaskId);
  const active = tasks.find(t => {
    const isAssigned = t.parentId === parentId || t.parentIds?.includes(parentId);
    if (!isAssigned) return false;
    const pStat = (t.parentStatuses || t.parent_statuses || []).find(s => s.parentId === parentId || s.parent_id === parentId);
    const status = pStat?.status || t.status;
    return status === 'pending';
  });
  const isEnded = active ? (active.is_ended || active.isEnded) : false;
  const timeLabel = active ? (active.endTime ? `${active.time} – ${active.endTime}` : active.time) : '';

  return <ParentShell><div className="mb-10"><div className="text-base font-semibold text-primary">A gentle reminder for today</div><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Good morning, {parentName} <Heart aria-hidden="true" className="inline size-7 fill-destructive text-destructive"/></h1><p className="mt-3 text-lg text-muted-foreground">One thing at a time. You've got this.</p></div>{active?<div className="rounded-2xl border bg-card p-6 soft-shadow sm:p-10"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><CategoryIcon category={active.category}/><span className="text-base font-bold text-primary">It's time for</span></div><span className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="size-4"/>{timeLabel}</span></div><h2 className="mt-9 text-4xl font-extrabold sm:text-5xl">{active.name}</h2><p className="mt-4 text-xl text-muted-foreground">{active.detail || active.notes || 'A little moment of care for yourself.'}</p>{snoozed===active.id&&<div role="status" className="mt-5 rounded-lg bg-warning-soft p-3 text-base font-semibold text-foreground">Okay, we'll remind you again in 10 minutes.</div>}{isEnded ? (
    <div className="mt-8 rounded-xl border border-warning/30 bg-warning-soft p-5 text-center">
      <div className="text-base font-bold text-foreground">Scheduled time has ended</div>
      <p className="mt-1 text-sm text-muted-foreground">
        This task's window has passed ({timeLabel}). Please ask your family caregiver to confirm completion.
      </p>
    </div>
  ) : (
    <div className="mt-10 space-y-4">
      <Button size="lg" onClick={()=>complete(active.id, { parentIds: [parentId] })} className="h-16 w-full rounded-xl bg-success text-lg font-bold text-primary-foreground hover:bg-success/90"><Check className="size-6"/> Completed</Button>
      <Button size="lg" variant="outline" onClick={()=>snooze(active.id)} className="h-16 w-full rounded-xl text-lg font-bold"><Clock3 className="size-5"/> Snooze 10 minutes</Button>
    </div>
  )}</div>:<EmptyState icon={Heart} title="All done for now!" description="You've completed everything on your list. Enjoy your day."/>}<Link to="/parent/today" className="mt-8 flex items-center justify-center gap-1 text-base font-bold text-primary">See the rest of today <ChevronRight className="size-5"/></Link></ParentShell>;
}

export function ParentTodayPage(){
  const profile=getCurrentParentProfile();
  if(!profile){
    return <ParentShell><EmptyState icon={ScanLine} title="No family circle connected" description="Please enter your invite code to see today's care tasks." action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}/></ParentShell>;
  }
  const parentId=profile.parent_profile_id;
  const tasks=useCareStore(s=>s.tasks).filter(t=>t.parentId===parentId || t.parentIds?.includes(parentId));
  return <ParentShell><h1 className="text-3xl font-extrabold">Your day</h1><p className="mt-2 text-lg text-muted-foreground">Every little step counts.</p><div className="mt-9 space-y-3">{tasks.length?tasks.map(t=>{
    const pStat = (t.parentStatuses || t.parent_statuses || []).find(s => s.parentId === parentId || s.parent_id === parentId);
    const parentStatus = pStat?.status || t.status;
    const isEnded = (t.is_ended || t.isEnded) && parentStatus !== 'completed';
    const timeLabel = t.endTime ? `${t.time} – ${t.endTime}` : t.time;
    const completedTimeStr = pStat?.completedTime || pStat?.completed_time || t.completedTime || t.completed_time
      ? (pStat?.completedTime || pStat?.completed_time || t.completedTime || t.completed_time)
      : ((pStat?.completedAt || t.completedAt || t.completed_at) ? new Date(pStat?.completedAt || t.completedAt || t.completed_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);
    return (
      <div key={t.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <CategoryIcon category={t.category}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{t.name}</h2>
            {isEnded && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Ended</span>}
          </div>
          {parentStatus === 'completed' ? (
            <p className="mt-1 text-sm font-semibold text-success flex items-center gap-1">
              <Check className="size-4 shrink-0" /> Completed {completedTimeStr ? `at ${completedTimeStr}` : 'today'}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{timeLabel}</p>
          )}
        </div>
        <StatusBadge status={parentStatus}/>
      </div>
    );
  }):<EmptyState title="No tasks scheduled" description="Your family hasn't added any tasks for today yet."/>}</div></ParentShell>;
}

export function ParentHistoryPage(){
  const profile=getCurrentParentProfile();
  const {data:weekly}=useQuery({
    queryKey:['parent-adherence',profile?.parent_profile_id],
    queryFn:()=>profile?.parent_profile_id ? api.parents.getWeeklyAdherence(profile.parent_profile_id) : Promise.resolve(defaultHistory),
    enabled:!!profile?.parent_profile_id,
  });
  if(!profile){
    return <ParentShell><EmptyState icon={ScanLine} title="No family circle connected" description="Please enter your invite code to view your care history." action={<Button asChild><Link to="/parent/scan">Connect now</Link></Button>}/></ParentShell>;
  }
  const historyData = weekly || defaultHistory;
  return <ParentShell><h1 className="text-3xl font-extrabold">Your last 7 days</h1><p className="mt-2 text-lg text-muted-foreground">Look at all the care you've given yourself.</p><div className="mt-9 space-y-3">{historyData.map((item,i)=><div key={item.day} className="flex min-h-20 items-center gap-4 rounded-xl border bg-card p-5"><span className={cn('grid size-11 place-items-center rounded-full',item.rate>=90?'bg-success-soft text-success':item.rate>0?'bg-info-soft text-primary':'bg-muted text-muted-foreground')}>{item.rate>=90?<Check className="size-6"/>:<Clock3 className="size-5"/>}</span><div className="flex-1"><h2 className="text-lg font-bold">{item.day}{i===6?' · Today':''}</h2><p className="text-sm text-muted-foreground">{item.rate>=90?'A wonderful day':item.rate>0?'You kept going':'No tasks recorded'}</p></div><span className="text-lg font-bold">{item.rate}%</span></div>)}</div></ParentShell>;
}

export function NotificationDemo(){
  return <ParentShell><h1 className="text-3xl font-extrabold">Reminders</h1><div className="mt-8 space-y-4"><EmptyState icon={Bell} title="No reminders" description="You have no pending reminders right now."/></div><Button variant="ghost" asChild className="mt-5"><Link to="/parent/home"><ArrowLeft/> Back home</Link></Button></ParentShell>;
}
