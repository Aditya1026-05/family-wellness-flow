import { useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, Bell, CalendarDays, Check, CheckCircle2, ClipboardList, Copy, Download, Heart, Pencil, Plus, QrCode, Share2, Trash2, TrendingUp, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChildShell, StatCard, ParentCard, TaskCard, AlertCard, ActivityTimeline, SectionTitle, EmptyState, QuickAdd, Avatar, StatusBadge, SettingsRow, Settings, ShieldCheck, PageSkeleton } from './components';
import { useCareStore } from './store';
import { history, mockApi, type Category, type CareTask, type Parent } from './data';
import { EditTaskDialog, EditParentDialog, ConfirmDeleteDialog, ParentInviteModal, CompleteTaskDialog } from './modals';
import { api, getCurrentUser } from '@/lib/api';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const { parents, tasks, alerts, updateTask, deleteTask, updateParent, deleteParent, completeTask, dismissAlert } = useCareStore();
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<CareTask | null>(null);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [deletingParent, setDeletingParent] = useState<Parent | null>(null);
  const [viewInviteParent, setViewInviteParent] = useState<Parent | null>(null);
  const [completingTask, setCompletingTask] = useState<CareTask | null>(null);

  const handleTaskComplete = (task: CareTask) => {
    const pCount = (task.parentIds?.length || 0) || (task.parentStatuses?.length || 0) || (task.parentId ? 1 : 0);
    if (pCount > 1) {
      setCompletingTask(task);
    } else {
      completeTask(task.id);
    }
  };

  const currentUser = getCurrentUser();
  const firstName = currentUser?.full_name?.split(' ')[0] || (currentUser?.email ? currentUser.email.split('@')[0] : 'there');
  const completed = tasks.filter(t => t.status === 'completed').length;
  const missed = tasks.filter(t => t.status === 'missed').length;

  return (
    <ChildShell title={`Good morning, ${firstName}`} subtitle="Here's how your family is doing today." action={<QuickAdd to="/tasks/new" label="New task"/>}>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Users} label="Parents" value={parents.length} note="In your circle"/>
        <StatCard icon={TrendingUp} label="Completion rate" value={tasks.length ? `${Math.round(completed / tasks.length * 100)}%` : '0%'} note="Today's progress" tone="green"/>
        <StatCard icon={ClipboardList} label="Active tasks" value={tasks.filter(t => t.status === 'pending').length} note="Still to do today" tone="amber"/>
        <StatCard icon={Bell} label="Missed tasks" value={missed} note="Needs attention" tone="red"/>
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="space-y-9">
          <section>
            <SectionTitle title="Your people" link={parents.length ? "View all" : undefined} to={parents.length ? "/parents" : undefined}/>
            {parents.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {parents.map(p => (
                  <ParentCard
                    key={p.id}
                    parent={p}
                    tasks={tasks.filter(t => t.parentId === p.id || t.parentIds?.includes(p.id))}
                    onEdit={setEditingParent}
                    onDelete={setDeletingParent}
                    onViewInvite={setViewInviteParent}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No parents in your circle" description="Add your first parent to generate a QR invite or short code." action={<Button asChild size="sm"><Link to="/parents/new">Add parent</Link></Button>}/>
            )}
          </section>
          <section>
            <SectionTitle title="Today's tasks" link={tasks.length ? "View all" : undefined} to={tasks.length ? "/tasks" : undefined}/>
            {tasks.length ? (
              <div className="space-y-3">
                {tasks.slice(0,4).map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    parent={parents.find(p => p.id === task.parentId || task.parentIds?.includes(p.id))}
                    onEdit={setEditingTask}
                    onDelete={setDeletingTask}
                    onComplete={handleTaskComplete}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={ClipboardList} title="No tasks scheduled" description="Add a task to support your family's daily wellness." action={<Button asChild size="sm"><Link to="/tasks/new">New task</Link></Button>}/>
            )}
          </section>
        </div>
        <div className="space-y-9">
          <section>
            <SectionTitle title="Needs your attention" link="All alerts" to="/alerts"/>
            <div className="space-y-3">
              {alerts.length ? alerts.slice(0,2).map(a => <AlertCard key={a.id} alert={a} onDismiss={() => dismissAlert(a.id)}/>) : <EmptyState icon={Bell} title="No alerts" description="Everything is looking good right now."/>}
            </div>
          </section>
          <section>
            <SectionTitle title="Recent activity"/>
            <div className="rounded-xl border bg-card p-5 soft-shadow">
              {tasks.filter(t => t.status === 'completed').length ? (
                <ActivityTimeline items={tasks.filter(t => t.status === 'completed').slice(0,4).map(t => {
                  const p = parents.find(parent => parent.id === t.parentId || t.parentIds?.includes(parent.id));
                  const label = p ? (p.relationship || p.name) : 'Parent';
                  const compTime = t.completedTime || t.completed_time
                    ? `Today at ${t.completedTime || t.completed_time}`
                    : (t.completedAt || t.completed_at ? `Today at ${new Date(t.completedAt || t.completed_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `Today · ${t.time}`);
                  return { title: `${label} completed ${t.name}`, time: compTime };
                })}/>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No completed activity recorded yet today.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <EditTaskDialog
        task={editingTask}
        parents={parents}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={updateTask}
      />
      <ConfirmDeleteDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete Care Task"
        description="Are you sure you want to delete this care task? This action cannot be undone."
        itemName={deletingTask?.name}
        onConfirm={() => deletingTask && deleteTask(deletingTask.id)}
      />
      <EditParentDialog
        parent={editingParent}
        open={!!editingParent}
        onOpenChange={(open) => !open && setEditingParent(null)}
        onSave={updateParent}
      />
      <ConfirmDeleteDialog
        open={!!deletingParent}
        onOpenChange={(open) => !open && setDeletingParent(null)}
        title="Delete Parent"
        description="Are you sure you want to remove this parent from your circle? All associated care tasks will also be removed."
        itemName={deletingParent?.name}
        onConfirm={() => deletingParent && deleteParent(deletingParent.id)}
      />
      <ParentInviteModal
        parent={viewInviteParent}
        open={!!viewInviteParent}
        onOpenChange={(open) => !open && setViewInviteParent(null)}
      />
      <CompleteTaskDialog
        task={completingTask}
        parents={parents}
        open={!!completingTask}
        onOpenChange={(open) => !open && setCompletingTask(null)}
        onConfirm={async (taskId, parentIds) => {
          await completeTask(taskId, parentIds ? { parentIds } : { allParents: true });
        }}
      />
    </ChildShell>
  );
}

export function ParentsPage() {
  const { parents, tasks, updateParent, deleteParent } = useCareStore();
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [deletingParent, setDeletingParent] = useState<Parent | null>(null);
  const [viewInviteParent, setViewInviteParent] = useState<Parent | null>(null);

  return (
    <ChildShell title="Your parents" subtitle="Stay close, even from afar." action={<QuickAdd to="/parents/new" label="Add parent"/>}>
      {parents.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {parents.map(p => (
            <ParentCard
              key={p.id}
              parent={p}
              tasks={tasks.filter(t => t.parentId === p.id || t.parentIds?.includes(p.id))}
              onEdit={setEditingParent}
              onDelete={setDeletingParent}
              onViewInvite={setViewInviteParent}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No parents linked" description="Invite a parent to begin caring together." action={<Button asChild><Link to="/parents/new">Add parent</Link></Button>}/>
      )}

      <EditParentDialog
        parent={editingParent}
        open={!!editingParent}
        onOpenChange={(open) => !open && setEditingParent(null)}
        onSave={updateParent}
      />
      <ConfirmDeleteDialog
        open={!!deletingParent}
        onOpenChange={(open) => !open && setDeletingParent(null)}
        title="Delete Parent"
        description="Are you sure you want to remove this parent from your circle? All associated care tasks will also be removed."
        itemName={deletingParent?.name}
        onConfirm={() => deletingParent && deleteParent(deletingParent.id)}
      />
      <ParentInviteModal
        parent={viewInviteParent}
        open={!!viewInviteParent}
        onOpenChange={(open) => !open && setViewInviteParent(null)}
      />
    </ChildShell>
  );
}

export function AddParentPage() {
  const [name,setName]=useState(''); const [relationship,setRelationship]=useState('Mom'); const [code,setCode]=useState(''); const [shortCode,setShortCode]=useState(''); const [copied,setCopied]=useState(false); const addParent=useCareStore(s=>s.addParent);
  const generate=async(e:React.FormEvent)=>{e.preventDefault(); const parent=await addParent(name.trim(),relationship); setCode(parent.invite_code || `carecircle://join/${parent.id}`); setShortCode(parent.short_code || '');};
  const download=()=>{ const svg=document.querySelector('#invite-qr svg'); if(!svg)return; const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}); const url=URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download=`carecircle-${name.toLowerCase().replace(/\s+/g,'-')}.svg`;link.click();URL.revokeObjectURL(url);};
  const share=async()=>{ const inviteMessage = `Join my CareCircle family! Scan the QR code or enter code: ${shortCode}`; if(navigator.share) await navigator.share({title:'Join my CareCircle',text:inviteMessage,url:code}).catch(()=>{});else if(navigator.clipboard) await navigator.clipboard.writeText(`${inviteMessage}\n${code}`);};
  return <ChildShell title="Add a parent" subtitle="A simple way to bring your family together."><div className="max-w-xl"><div className="rounded-xl border bg-card p-6 soft-shadow sm:p-8">{!code ? <form onSubmit={generate} className="space-y-6"><div><Label htmlFor="parent-name">Parent name</Label><Input id="parent-name" placeholder="e.g. Meera Tayal" value={name} onChange={e=>setName(e.target.value)} required className="mt-2 h-12"/></div><div><Label htmlFor="relationship">Relationship</Label><Select value={relationship} onValueChange={setRelationship}><SelectTrigger id="relationship" className="mt-2 h-12"><SelectValue/></SelectTrigger><SelectContent>{['Mom','Dad','Grandmother','Grandfather','Other'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><Button type="submit" size="lg" className="h-12 w-full">Generate QR code & Short code</Button></form> : <div className="text-center"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2/></div><h2 className="text-xl font-bold">Invite {name}</h2><p className="mt-2 text-sm text-muted-foreground">Have {name} scan this QR code or enter the short code below in the parent app.</p><div id="invite-qr" className="mx-auto my-7 w-fit rounded-xl border bg-card p-5"><QRCodeSVG value={code} size={200} fgColor="#2563eb" bgColor="#ffffff"/></div>{shortCode && <div className="mx-auto my-6 max-w-sm rounded-xl border border-primary/20 bg-primary/5 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wider text-primary">Option 2: 6-Character Short Code</div><p className="mt-1 text-xs text-muted-foreground">Your parent can also manually type this code in the parent app instead of scanning:</p><div className="my-3 flex items-center justify-center gap-2"><span className="rounded-lg border bg-card px-4 py-2 font-mono text-2xl font-black tracking-widest text-primary shadow-sm select-all">{shortCode}</span><Button type="button" variant="outline" size="sm" className="h-11" onClick={()=>{navigator.clipboard.writeText(shortCode);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>{copied ? <><Check className="size-4 mr-1 text-success"/> Copied</> : <><Copy className="size-4 mr-1"/> Copy code</>}</Button></div><p className="text-[11px] text-muted-foreground">Case-insensitive · Single-use for privacy</p></div>}<div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={download}><Download/> Download QR</Button><Button onClick={share}><Share2/> Share invite</Button></div><Button variant="ghost" asChild className="mt-5"><Link to="/parents">Back to parents</Link></Button></div>}</div></div></ChildShell>;
}

export function ParentDetailsPage() {
  const navigate = useNavigate();
  const { parentId } = useParams({ from: '/parents/$parentId' });
  const { parents, tasks, updateParent, deleteParent, updateTask, deleteTask, completeTask } = useCareStore();
  const parent = parents.find(p => p.id === parentId);
  const parentTasks = tasks.filter(t => t.parentId === parentId || t.parentIds?.includes(parentId));
  const { data: weekly, isPending } = useQuery({ queryKey: ['adherence', parentId], queryFn: () => mockApi.getWeeklyAdherence(parentId) });

  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [deletingParent, setDeletingParent] = useState<Parent | null>(null);
  const [viewInviteParent, setViewInviteParent] = useState<Parent | null>(null);
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<CareTask | null>(null);
  const [completingTask, setCompletingTask] = useState<CareTask | null>(null);

  const handleTaskComplete = (task: CareTask) => {
    const pCount = (task.parentIds?.length || 0) || (task.parentStatuses?.length || 0) || (task.parentId ? 1 : 0);
    if (pCount > 1) {
      setCompletingTask(task);
    } else {
      completeTask(task.id);
    }
  };

  if (!parent) return (
    <ChildShell title="Parent not found">
      <EmptyState title="Parent not found" description="This person is not in your circle." action={<Button asChild><Link to="/parents">View parents</Link></Button>}/>
    </ChildShell>
  );

  return (
    <ChildShell
      title={parent.name}
      subtitle={`${parent.relationship} · Last active ${parent.lastActivity}`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/parents"><ArrowLeft className="size-4 mr-1"/> Back</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewInviteParent(parent)}>
            <QrCode className="size-3.5 mr-1.5"/> Invite code
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditingParent(parent)}>
            <Pencil className="size-3.5 mr-1.5"/> Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeletingParent(parent)}>
            <Trash2 className="size-3.5 mr-1.5"/> Delete
          </Button>
        </div>
      }
    >
      <div className="mb-6 flex items-center gap-4">
        <Avatar parent={parent} size="large"/>
        <div>
          <div className="font-bold">{parent.completion}% completion</div>
          <div className="text-sm text-muted-foreground">You're doing great together</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Completed" value={parentTasks.filter(t=>t.status==='completed').length} tone="green"/>
        <StatCard icon={Bell} label="Missed" value={parentTasks.filter(t=>t.status==='missed').length} tone="red"/>
        <StatCard icon={CalendarDays} label="Pending" value={parentTasks.filter(t=>t.status==='pending').length}/>
      </div>
      <div className="mt-9 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle title="Upcoming tasks"/>
          <div className="space-y-3">
            {parentTasks.filter(t=>t.status==='pending').length ? (
              parentTasks.filter(t=>t.status==='pending').map(t=>(
                <TaskCard key={t.id} task={t} parent={parent} onEdit={setEditingTask} onDelete={setDeletingTask} onComplete={handleTaskComplete}/>
              ))
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No pending tasks for {parent.name}.</p>
            )}
          </div>
        </section>
        <section>
          <SectionTitle title="Recent activity"/>
          <div className="rounded-xl border bg-card p-5">
            <ActivityTimeline items={parentTasks.filter(t=>t.status!=='pending').map(t=>{
              const compTime = t.status === 'completed'
                ? (t.completedTime || t.completed_time
                    ? `Completed at ${t.completedTime || t.completed_time}`
                    : (t.completedAt || t.completed_at ? `Completed at ${new Date(t.completedAt || t.completed_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `Today · ${t.time}`))
                : `Scheduled · ${t.time}`;
              return { title: t.name, time: compTime, status: t.status };
            })}/>
          </div>
        </section>
      </div>
      <section className="mt-9">
        <SectionTitle title="Weekly adherence"/>
        {isPending ? (
          <PageSkeleton/>
        ) : (
          <div className="rounded-xl border bg-card p-6 soft-shadow">
            <div className="flex h-48 items-end justify-between gap-2 sm:gap-5">
              {weekly?.map(item=>(
                <div key={item.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{item.rate}%</span>
                  <div className="w-full max-w-14 rounded-t-lg bg-primary/75" style={{height:`${item.rate}%`}}/>
                  <span className="text-xs text-muted-foreground">{item.day}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <EditParentDialog
        parent={editingParent}
        open={!!editingParent}
        onOpenChange={(open) => !open && setEditingParent(null)}
        onSave={updateParent}
      />
      <ConfirmDeleteDialog
        open={!!deletingParent}
        onOpenChange={(open) => !open && setDeletingParent(null)}
        title="Delete Parent"
        description="Are you sure you want to remove this parent from your circle? All associated care tasks will also be removed."
        itemName={deletingParent?.name}
        onConfirm={async () => {
          if (deletingParent) {
            await deleteParent(deletingParent.id);
            navigate({ to: '/parents' });
          }
        }}
      />
      <EditTaskDialog
        task={editingTask}
        parents={parents}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={updateTask}
      />
      <ConfirmDeleteDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete Care Task"
        description="Are you sure you want to delete this care task? This action cannot be undone."
        itemName={deletingTask?.name}
        onConfirm={() => deletingTask && deleteTask(deletingTask.id)}
      />
      <ParentInviteModal
        parent={viewInviteParent}
        open={!!viewInviteParent}
        onOpenChange={(open) => !open && setViewInviteParent(null)}
      />
      <CompleteTaskDialog
        task={completingTask}
        parents={parents}
        open={!!completingTask}
        onOpenChange={(open) => !open && setCompletingTask(null)}
        onConfirm={async (taskId, parentIds) => {
          await completeTask(taskId, parentIds ? { parentIds } : { allParents: true });
        }}
      />
    </ChildShell>
  );
}

export function TasksPage() {
  const { tasks, parents, updateTask, deleteTask, completeTask } = useCareStore();
  const [filter, setFilter] = useState('All');
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<CareTask | null>(null);
  const [completingTask, setCompletingTask] = useState<CareTask | null>(null);

  const handleTaskComplete = (task: CareTask) => {
    const pCount = (task.parentIds?.length || 0) || (task.parentStatuses?.length || 0) || (task.parentId ? 1 : 0);
    if (pCount > 1) {
      setCompletingTask(task);
    } else {
      completeTask(task.id);
    }
  };

  const filters = ['All', 'Meals', 'Medicines', 'Exercise', 'Appointments', 'Wellness'];
  const visible = tasks.filter(t => filter === 'All' || ({ Meals: 'Meal', Medicines: 'Medicine', Exercise: 'Exercise', Appointments: 'Appointment', Wellness: 'Wellness' } as Record<string, string>)[filter] === t.category);

  return (
    <ChildShell title="Care tasks" subtitle="A little structure makes every day easier." action={<QuickAdd to="/tasks/new" label="New task"/>}>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter tasks">
        {filters.map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="shrink-0 rounded-full h-9 px-3.5 text-xs sm:text-sm font-semibold">
            {f}
          </Button>
        ))}
      </div>
      {visible.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              parent={parents.find(p => p.id === t.parentId || t.parentIds?.includes(p.id))}
              onEdit={setEditingTask}
              onDelete={setDeletingTask}
              onComplete={handleTaskComplete}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="No tasks scheduled" description="Add a task to make the day a little easier." action={<Button asChild><Link to="/tasks/new">Create task</Link></Button>}/>
      )}

      <EditTaskDialog
        task={editingTask}
        parents={parents}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={updateTask}
      />
      <ConfirmDeleteDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete Care Task"
        description="Are you sure you want to delete this care task? This action cannot be undone."
        itemName={deletingTask?.name}
        onConfirm={() => deletingTask && deleteTask(deletingTask.id)}
      />
      <CompleteTaskDialog
        task={completingTask}
        parents={parents}
        open={!!completingTask}
        onOpenChange={(open) => !open && setCompletingTask(null)}
        onConfirm={async (taskId, parentIds) => {
          await completeTask(taskId, parentIds ? { parentIds } : { allParents: true });
        }}
      />
    </ChildShell>
  );
}

export function CreateTaskPage() {
  const navigate = useNavigate();
  const { parents, addTask } = useCareStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Meal');
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>(
    parents[0] ? [parents[0].id] : []
  );
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [repeat, setRepeat] = useState('Daily');
  const [notes, setNotes] = useState('');

  if (!parents.length) {
    return (
      <ChildShell title="Create a task" subtitle="Set up a thoughtful reminder for someone you love.">
        <EmptyState icon={Users} title="No parents in your circle" description="You must add a parent before you can schedule care tasks." action={<Button asChild><Link to="/parents/new">Add a parent first</Link></Button>}/>
      </ChildShell>
    );
  }

  const toggleParent = (pId: string) => {
    if (selectedParentIds.includes(pId)) {
      if (selectedParentIds.length > 1) {
        setSelectedParentIds(selectedParentIds.filter(id => id !== pId));
      }
    } else {
      setSelectedParentIds([...selectedParentIds, pId]);
    }
  };

  const selectAll = () => {
    if (selectedParentIds.length === parents.length) {
      if (parents[0]) setSelectedParentIds([parents[0].id]);
    } else {
      setSelectedParentIds(parents.map(p => p.id));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentIds.length) return;
    const parts = time.split(':');
    const hour = Number(parts[0] ?? 9);
    const minute = Number(parts[1] ?? 0);
    const timeFormatted = `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

    let endFormatted: string | undefined = undefined;
    if (endTime) {
      const endParts = endTime.split(':');
      const eh = Number(endParts[0] ?? 10);
      const em = Number(endParts[1] ?? 0);
      endFormatted = `${eh % 12 || 12}:${String(em).padStart(2, '0')} ${eh >= 12 ? 'PM' : 'AM'}`;
    }

    await addTask({
      name: name.trim(),
      category,
      parentId: selectedParentIds[0],
      parentIds: selectedParentIds,
      time: timeFormatted,
      endTime: endFormatted,
      repeat,
      notes,
      detail: notes,
    });
    navigate({ to: '/tasks' });
  };

  return (
    <ChildShell title="Create a task" subtitle="Set up a thoughtful reminder for someone you love.">
      <form onSubmit={save} className="max-w-2xl space-y-5 rounded-xl border bg-card p-6 soft-shadow sm:p-8">
        <div>
          <Label htmlFor="task-name">Task name</Label>
          <Input id="task-name" required placeholder="e.g. Take morning medicine" value={name} onChange={e => setName(e.target.value)} className="mt-2 h-12"/>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Assigned parents (select one or multiple)</Label>
            {parents.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {selectedParentIds.length === parents.length ? 'Deselect all' : 'Assign to all parents'}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {parents.map(p => {
              const isSelected = selectedParentIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleParent(p.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className={cn('size-2 rounded-full', isSelected ? 'bg-primary' : 'bg-muted-foreground/30')} />
                  {p.name} ({p.relationship})
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as Category)}>
              <SelectTrigger id="category" className="mt-2 h-12"><SelectValue/></SelectTrigger>
              <SelectContent>
                {['Meal', 'Medicine', 'Exercise', 'Appointment', 'Wellness'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repeat">Repeat</Label>
            <Select value={repeat} onValueChange={setRepeat}>
              <SelectTrigger id="repeat" className="mt-2 h-12"><SelectValue/></SelectTrigger>
              <SelectContent>
                {['Once', 'Daily', 'Weekly', 'Monthly'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-time">Scheduled Start Time</Label>
            <Input id="task-time" type="time" required value={time} onChange={e => setTime(e.target.value)} className="mt-2 h-12"/>
          </div>
          <div>
            <Label htmlFor="task-endtime">
              Scheduled End Time <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input id="task-endtime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-2 h-12" placeholder="Optional end time"/>
          </div>
        </div>
        <div>
          <Label htmlFor="task-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="task-notes" rows={4} placeholder="Anything helpful for your parent to know" value={notes} onChange={e => setNotes(e.target.value)} className="mt-2"/>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" asChild><Link to="/tasks">Cancel</Link></Button>
          <Button type="submit" disabled={!selectedParentIds.length}>Save task</Button>
        </div>
      </form>
    </ChildShell>
  );
}

export function AlertsPage() {
  const alerts = useCareStore(s => s.alerts);
  const dismiss = useCareStore(s => s.dismissAlert);
  return (
    <ChildShell title="Alerts" subtitle="The important things, all in one place.">
      {alerts.length ? ['Escalation', 'Missed task', 'Urgent'].map(type => {
        const group = alerts.filter(a => a.type === type);
        return group.length ? (
          <section className="mb-9" key={type}>
            <SectionTitle title={type === 'Urgent' ? 'Urgent alerts' : type === 'Missed task' ? 'Missed tasks' : 'Escalations'}/>
            <div className="grid gap-3 lg:grid-cols-2">
              {group.map(a => <AlertCard key={a.id} alert={a} onDismiss={() => dismiss(a.id)}/>)}
            </div>
          </section>
        ) : null;
      }) : (
        <EmptyState icon={Bell} title="No alerts" description="Everything is looking good. We'll let you know if anything needs attention."/>
      )}
    </ChildShell>
  );
}

export function ProfilePage() {
  const [dark, setDark] = useState(false);
  const parents = useCareStore(s => s.parents);
  const currentUser = getCurrentUser();
  const fullName = currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Family Admin');
  const email = currentUser?.email || 'Logged in';
  const initials = fullName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || 'FA';
  const toggle = (checked: boolean) => {
    setDark(checked);
    document.documentElement.classList.toggle('dark', checked);
  };

  return (
    <ChildShell title="Profile" subtitle="Your family space, your way.">
      <div className="max-w-2xl space-y-8">
        <section>
          <SectionTitle title="Your profile"/>
          <div className="rounded-xl border bg-card p-5 soft-shadow">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-full bg-info-soft text-xl font-bold text-primary">{initials}</div>
              <div>
                <div className="text-lg font-bold">{fullName}</div>
                <div className="text-sm text-muted-foreground">{email}</div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <SectionTitle title="Family information"/>
          <div className="rounded-xl border bg-card px-5 soft-shadow">
            <SettingsRow icon={Users} title="Your circle" detail={`${parents.length} parents connected`}/>
            <SettingsRow icon={Heart} title="CareCircle family" detail={`${fullName.split(' ')[0]}'s family`}/>
          </div>
        </section>
        <section>
          <SectionTitle title="Settings"/>
          <div className="rounded-xl border bg-card px-5 soft-shadow">
            <SettingsRow icon={Settings} title="Dark mode" detail="Use a darker appearance">
              <Switch checked={dark} onCheckedChange={toggle} aria-label="Dark mode"/>
            </SettingsRow>
            <SettingsRow icon={ShieldCheck} title="Privacy" detail="Your family's care stays in your circle"/>
          </div>
        </section>
        <Button variant="outline" asChild className="w-full" onClick={() => { api.auth.logout(); useCareStore.getState().reset(); }}>
          <Link to="/">{currentUser?.email === 'aditya@example.com' ? 'Leave demo' : 'Sign out'}</Link>
        </Button>
      </div>
    </ChildShell>
  );
}
