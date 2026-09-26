import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Bell, Check, Copy, Download, Loader2, QrCode, RefreshCw, Share2, Users } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { type CareTask, type Parent, type Category } from './data';
import { cn, copyToClipboard, downloadSvgAsPng, shareOrCopyInvite } from '@/lib/utils';
import { api } from '@/lib/api';

function formatTimeTo24h(timeStr?: string): string {
  if (!timeStr) return '';
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return '09:00';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function format24hToDisplay(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  const hour = Number(parts[0] ?? 9);
  const minute = Number(parts[1] ?? 0);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function EditTaskDialog({
  task,
  parents,
  open,
  onOpenChange,
  onSave,
}: {
  task: CareTask | null;
  parents: Parent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Omit<CareTask, 'id'>>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Meal');
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [repeat, setRepeat] = useState('Daily');
  const [notes, setNotes] = useState('');
  const [ringAlarm, setRingAlarm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setCategory(task.category || 'Meal');
      const assigned = task.parentIds && task.parentIds.length > 0
        ? task.parentIds
        : (task.parentId ? [task.parentId] : (parents[0]?.id ? [parents[0].id] : []));
      setSelectedParentIds(assigned);
      setTime(formatTimeTo24h(task.time) || '09:00');
      setEndTime(formatTimeTo24h(task.endTime || task.end_time));
      setRepeat(task.repeat || 'Daily');
      setNotes(task.notes || task.detail || '');
      setRingAlarm(Boolean(task.ring_alarm ?? task.ringAlarm));
    }
  }, [task, parents]);

  if (!task) return null;

  const toggleParent = (pId: string) => {
    if (selectedParentIds.includes(pId)) {
      if (selectedParentIds.length > 1) {
        setSelectedParentIds(selectedParentIds.filter(id => id !== pId));
      }
    } else {
      setSelectedParentIds([...selectedParentIds, pId]);
    }
  };

  const selectAllParents = () => {
    if (selectedParentIds.length === parents.length) {
      if (parents[0]) setSelectedParentIds([parents[0].id]);
    } else {
      setSelectedParentIds(parents.map(p => p.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedParentIds.length) return;
    setSaving(true);
    try {
      await onSave(task.id, {
        name: name.trim(),
        category,
        parentId: selectedParentIds[0],
        parentIds: selectedParentIds,
        time: format24hToDisplay(time),
        endTime: endTime ? format24hToDisplay(endTime) : undefined,
        repeat,
        notes,
        detail: notes,
        ring_alarm: ringAlarm,
        ringAlarm: ringAlarm,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Care Task</DialogTitle>
          <DialogDescription>
            Update details, assigned parents, and schedule for this activity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="edit-task-name">Task Name</Label>
            <Input
              id="edit-task-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Assigned Parents (select one or multiple)</Label>
              {parents.length > 1 && (
                <button
                  type="button"
                  onClick={selectAllParents}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {selectedParentIds.length === parents.length ? 'Deselect all' : 'Assign to all'}
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
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        isSelected ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    />
                    {p.name} ({p.relationship})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-task-cat">Category</Label>
              <Select value={category} onValueChange={v => setCategory(v as Category)}>
                <SelectTrigger id="edit-task-cat" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Meal', 'Medicine', 'Exercise', 'Appointment', 'Wellness'].map(v => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-task-repeat">Repeat Pattern</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger id="edit-task-repeat" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Once', 'Daily', 'Weekly', 'Monthly'].map(v => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-task-time">Scheduled Start Time</Label>
              <Input
                id="edit-task-time"
                type="time"
                required
                value={time}
                onChange={e => setTime(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="edit-task-endtime">
                End Time <span className="font-normal text-muted-foreground text-xs">(locks parent completion)</span>
              </Label>
              <Input
                id="edit-task-endtime"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="mt-1.5"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Urgent Task Alarm Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-card-border bg-muted/40 p-3.5 transition-colors">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center gap-2">
                <Bell className="size-3.5 text-primary shrink-0" />
                <Label htmlFor="edit-task-ring-alarm" className="text-xs font-semibold text-foreground cursor-pointer">
                  Ring phone like an alarm (Urgent task)
                </Label>
                {ringAlarm && (
                  <span className="rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                    Alarm ON
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Triggers loud alarm tone & vibration on parent's phone when due and during follow-ups (0m, 15m, 30m).
              </p>
            </div>
            <Switch
              id="edit-task-ring-alarm"
              checked={ringAlarm}
              onCheckedChange={setRingAlarm}
            />
          </div>

          <div>
            <Label htmlFor="edit-task-notes">Notes & Instructions (optional)</Label>
            <Textarea
              id="edit-task-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Take with water after eating"
              className="mt-1.5"
            />
          </div>

          <DialogFooter className="mt-6 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedParentIds.length}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditParentDialog({
  parent,
  open,
  onOpenChange,
  onSave,
}: {
  parent: Parent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: { name: string; relationship: string; color: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Mom');
  const [color, setColor] = useState('peach');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parent) {
      setName(parent.name || '');
      setRelationship(parent.relationship || 'Mom');
      setColor(parent.color || 'peach');
    }
  }, [parent]);

  if (!parent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(parent.id, {
        name: name.trim(),
        relationship,
        color,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const colors = [
    { id: 'peach', label: 'Peach', bgClass: 'bg-peach' },
    { id: 'mint', label: 'Mint', bgClass: 'bg-mint' },
    { id: 'lavender', label: 'Lavender', bgClass: 'bg-lavender' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Parent Profile</DialogTitle>
          <DialogDescription>
            Update profile details for {parent.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="edit-parent-name">Parent Name</Label>
            <Input
              id="edit-parent-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="edit-parent-relationship">Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger id="edit-parent-relationship" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Mom', 'Dad', 'Grandmother', 'Grandfather', 'Other'].map(r => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Avatar Theme Color</Label>
            <div className="mt-2 flex gap-3">
              {colors.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 font-semibold text-xs transition-all',
                    color === c.id
                      ? 'border-primary ring-2 ring-primary/20 bg-accent font-bold'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <span className={cn('size-4 rounded-full border border-black/10', c.bgClass)} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-6 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ParentInviteModal({
  parent,
  open,
  onOpenChange,
}: {
  parent: Parent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inviteData, setInviteData] = useState<{
    code: string;
    qr_value: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [shared, setShared] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (open && parent) {
      setLoading(true);
      api.invites
        .getForParent(parent.id)
        .then(res => {
          setInviteData({
            code: res.code,
            qr_value: res.qr_value,
          });
        })
        .catch(() => {
          setInviteData({
            code: parent.short_code || 'CARE12',
            qr_value: parent.invite_code || `carecircle://join/${parent.id}`,
          });
        })
        .finally(() => setLoading(false));
    }
  }, [open, parent]);

  if (!parent) return null;

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await api.invites.regenerateForParent(parent.id);
      setInviteData({
        code: res.code,
        qr_value: res.qr_value,
      });
    } catch {
      const freshCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setInviteData({
        code: freshCode,
        qr_value: `carecircle://join/${parent.id}?code=${freshCode}`,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const downloadQR = async () => {
    const canvas = document.querySelector('#modal-invite-qr canvas') as HTMLCanvasElement | null;
    const ok = await downloadSvgAsPng(
      canvas || '#modal-invite-qr',
      `carecircle-${parent.name.toLowerCase().replace(/\s+/g, '-')}-qr`
    );
    if (ok) {
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    }
  };

  const shareInvite = async () => {
    if (!inviteData) return;
    const inviteMessage = `Join my CareCircle family! Scan the QR code or enter short code: ${inviteData.code}`;
    const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/parent/scan?code=${inviteData.code}` : undefined;
    const res = await shareOrCopyInvite({
      title: 'Join CareCircle',
      text: inviteMessage,
      url: joinUrl,
    });
    if (res === 'shared' || res === 'copied') {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-info-soft text-primary">
            <QrCode className="size-6" />
          </div>
          <DialogTitle className="text-xl">Invite for {parent.name}</DialogTitle>
          <DialogDescription>
            Scan with the parent app camera or enter the 6-character short code.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Retrieving invite credentials...</p>
          </div>
        ) : (
          <div className="py-2">
            <div id="modal-invite-qr" className="mx-auto my-3 w-fit rounded-2xl border bg-card p-4 shadow-sm flex flex-col items-center">
              <QRCodeCanvas
                id="modal-invite-qr-canvas"
                value={inviteData?.qr_value || `carecircle://join/${parent.id}`}
                size={180}
                fgColor="#2563eb"
                bgColor="#ffffff"
                level="M"
                includeMargin={true}
                className="rounded-xl shadow-xs"
              />
              <p className="mt-2 text-[10px] text-muted-foreground sm:hidden">
                Tip: Tap and hold QR code to save to photos
              </p>
            </div>

            {inviteData?.code && (
              <div className="mx-auto my-4 max-w-sm rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-center">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  6-Character Short Code
                </div>
                <div className="my-2.5 flex items-center justify-center gap-2">
                  <span
                    onClick={async () => {
                      const ok = await copyToClipboard(inviteData.code);
                      if (ok) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    title="Click or tap to copy code"
                    className="rounded-lg border bg-card px-4 py-1.5 font-mono text-2xl font-black tracking-widest text-primary shadow-xs select-all cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {inviteData.code}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={async () => {
                      const ok = await copyToClipboard(inviteData.code);
                      if (ok) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 mr-1 text-success" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Valid for linking {parent.name} · Never expires until used
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={downloadQR}>
                {downloaded ? (
                  <>
                    <Check className="size-4 mr-1.5 text-success" /> Downloaded!
                  </>
                ) : (
                  <>
                    <Download className="size-4 mr-1.5" /> Download QR
                  </>
                )}
              </Button>
              <Button size="sm" onClick={shareInvite}>
                {shared ? (
                  <>
                    <Check className="size-4 mr-1.5 text-white" /> Invite copied!
                  </>
                ) : (
                  <>
                    <Share2 className="size-4 mr-1.5" /> Share invite
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("size-3.5 mr-1.5", regenerating && "animate-spin")} />
                New code
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-start sm:text-left">
          <div className="mb-2 grid size-12 place-items-center rounded-full bg-danger-soft text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">
            {description}
            {itemName && (
              <span className="mt-2 block font-semibold text-foreground">
                "{itemName}"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteTaskDialog({
  task,
  parents,
  open,
  onOpenChange,
  onConfirm,
}: {
  task: CareTask | null;
  parents: Parent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (taskId: string, parentIds?: string[]) => Promise<void>;
}) {
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const assignedParentIds = Array.from(new Set([
    ...(task?.parentIds && task.parentIds.length > 0 ? task.parentIds : (task?.parentId ? [task.parentId] : [])),
    ...((task?.parentStatuses || task?.parent_statuses || []).map(s => s.parentId || s.parent_id).filter(Boolean) as string[]),
  ]));

  const parentStatuses = task?.parentStatuses || task?.parent_statuses || [];

  const assignedParents = assignedParentIds.map(pid => {
    const p = parents.find(parent => parent.id === pid);
    const ps = parentStatuses.find(s => s.parentId === pid || s.parent_id === pid);
    const isCompleted = ps?.status === 'completed';
    return {
      id: pid,
      name: p?.name || ps?.parentName || ps?.parent_name || 'Parent',
      relationship: p?.relationship || ps?.relationship || 'Parent',
      status: ps?.status || (task?.status === 'completed' ? 'completed' : 'pending'),
      isCompleted,
      completedTime: ps?.completedTime || ps?.completed_time || task?.completedTime || task?.completed_time,
    };
  });

  const uncompletedParents = assignedParents.filter(p => !p.isCompleted);

  useEffect(() => {
    if (open && task) {
      setSelectedParentIds(uncompletedParents.map(p => p.id));
    }
  }, [open, task]);

  if (!task) return null;

  const toggleParent = (pId: string) => {
    if (selectedParentIds.includes(pId)) {
      setSelectedParentIds(selectedParentIds.filter(id => id !== pId));
    } else {
      setSelectedParentIds([...selectedParentIds, pId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedParentIds.length === uncompletedParents.length) {
      setSelectedParentIds([]);
    } else {
      setSelectedParentIds(uncompletedParents.map(p => p.id));
    }
  };

  const handleConfirm = async () => {
    if (!selectedParentIds.length) return;
    setSubmitting(true);
    try {
      const isAll = selectedParentIds.length === uncompletedParents.length && assignedParents.length === uncompletedParents.length;
      await onConfirm(task.id, isAll ? undefined : selectedParentIds);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="items-center text-center sm:items-start sm:text-left">
          <div className="mb-2 grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-6" />
          </div>
          <DialogTitle>Mark Task Completed</DialogTitle>
          <DialogDescription className="mt-1">
            Choose which parent(s) completed <span className="font-semibold text-foreground">"{task.name}"</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          {uncompletedParents.length > 1 && (
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Parents
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-primary hover:underline"
              >
                {selectedParentIds.length === uncompletedParents.length ? 'Deselect all' : 'Select all pending'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {assignedParents.map(p => {
              if (p.isCompleted) {
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-success/30 bg-success-soft/30 p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-5 place-items-center rounded-full bg-success text-success-foreground">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{p.name} ({p.relationship})</div>
                        <div className="text-xs text-success font-medium">
                          Completed {p.completedTime ? `at ${p.completedTime}` : 'today'}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                      Done
                    </span>
                  </div>
                );
              }

              const isChecked = selectedParentIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleParent(p.id)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all',
                    isChecked
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'grid size-5 place-items-center rounded-md border text-primary-foreground transition-colors',
                        isChecked ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-card'
                      )}
                    >
                      {isChecked && <Check className="size-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{p.name} ({p.relationship})</div>
                      <div className="text-xs text-muted-foreground capitalize">Status: {p.status}</div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-bold',
                      p.status === 'missed' ? 'bg-danger-soft text-destructive' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {p.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !selectedParentIds.length}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
              </>
            ) : (
              `Mark Completed (${selectedParentIds.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
