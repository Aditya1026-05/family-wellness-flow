import { create } from 'zustand';
import { type Parent, type CareTask, type CareAlert } from './data';
import { api, getAuthToken } from '@/lib/api';

type CareState = {
  parents: Parent[];
  tasks: CareTask[];
  alerts: CareAlert[];
  snoozedTaskId: string | null;
  isLoaded: boolean;
  init: () => Promise<void>;
  reset: () => void;
  addParent: (name: string, relationship: string) => Promise<any>;
  updateParent: (id: string, updates: { name?: string; relationship?: string; color?: string }) => Promise<void>;
  deleteParent: (id: string) => Promise<void>;
  addTask: (task: Omit<CareTask, 'id' | 'status'>) => Promise<void>;
  updateTask: (id: string, task: Partial<Omit<CareTask, 'id'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (taskOrId: string | any, options?: { parentIds?: string[]; allParents?: boolean }) => Promise<void>;
  snoozeTask: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
};

export const useCareStore = create<CareState>((set, get) => ({
  parents: [],
  tasks: [],
  alerts: [],
  snoozedTaskId: null,
  isLoaded: false,

  reset: () => {
    set({
      parents: [],
      tasks: [],
      alerts: [],
      snoozedTaskId: null,
      isLoaded: false,
    });
  },

  init: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ parents: [], tasks: [], alerts: [], isLoaded: true });
      return;
    }

    try {
      const [parents, tasks, alerts] = await Promise.all([
        api.parents.list(),
        api.tasks.list(),
        api.alerts.list(),
      ]);
      set({
        parents: Array.isArray(parents) ? parents : [],
        tasks: Array.isArray(tasks) ? tasks : [],
        alerts: Array.isArray(alerts) ? alerts : [],
        isLoaded: true,
      });
    } catch {
      set({ parents: [], tasks: [], alerts: [], isLoaded: true });
    }
  },

  addParent: async (name, relationship) => {
    try {
      const created = await api.parents.create({ name, relationship });
      const parent: Parent = {
        id: created.id,
        name: created.name,
        relationship: created.relationship,
        initials: created.initials,
        color: created.color,
        lastActivity: created.lastActivity || 'Just linked',
        completion: created.completion ?? 100,
      };
      set(state => ({ parents: [...state.parents, parent] }));
      return {
        ...parent,
        invite_code: created.invite_code || `carecircle://join/${created.invite_token || created.id}`,
        short_code: created.short_code || 'DEMO12',
      };
    } catch {
      const fallbackShortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const parent: Parent = {
        id: `parent-${Date.now()}`,
        name,
        relationship,
        initials: name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(),
        color: 'lavender',
        lastActivity: 'Invite pending',
        completion: 100,
      };
      set(state => ({ parents: [...state.parents, parent] }));
      return {
        ...parent,
        invite_code: `carecircle://join/${parent.id}`,
        short_code: fallbackShortCode,
      };
    }
  },

  updateParent: async (id, updates) => {
    try {
      const updated = await api.parents.update(id, updates);
      set(state => ({
        parents: state.parents.map(p => (p.id === id ? { ...p, ...updated } : p)),
      }));
    } catch {
      set(state => ({
        parents: state.parents.map(p => (p.id === id ? { ...p, ...updates } : p)),
      }));
    }
  },

  deleteParent: async (id) => {
    set(state => ({
      parents: state.parents.filter(p => p.id !== id),
      tasks: state.tasks.filter(t => t.parentId !== id),
    }));
    try {
      await api.parents.delete(id);
    } catch (e) {
      console.warn('Backend delete parent sync notice:', e);
    }
  },

  addTask: async (task) => {
    try {
      const created = await api.tasks.create(task);
      set(state => ({ tasks: [...state.tasks, created] }));
    } catch {
      set(state => ({
        tasks: [...state.tasks, { ...task, id: `task-${Date.now()}`, status: 'pending' }],
      }));
    }
  },

  updateTask: async (id, updates) => {
    try {
      const updated = await api.tasks.update(id, updates as any);
      set(state => ({
        tasks: state.tasks.map(t => (t.id === id ? { ...t, ...updated } : t)),
      }));
    } catch {
      set(state => ({
        tasks: state.tasks.map(t => (t.id === id ? { ...t, ...updates } : t)),
      }));
    }
  },

  deleteTask: async (id) => {
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== id),
    }));
    try {
      await api.tasks.delete(id);
    } catch (e) {
      console.warn('Backend delete task sync notice:', e);
    }
  },

  completeTask: async (taskOrId, options) => {
    const targetId = typeof taskOrId === 'object' && taskOrId !== null ? (taskOrId as any).id : taskOrId;
    if (!targetId) return;

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const targetParentIds = options?.parentIds;

    set(state => {
      const targetTask = state.tasks.find(t => t.id === targetId);
      const targetTitle = targetTask?.name?.toLowerCase();

      return {
        tasks: state.tasks.map(task => {
          if (task.id !== targetId) return task;

          const currentStatuses = task.parentStatuses || task.parent_statuses || [];
          const updatedStatuses = currentStatuses.map(ps => {
            const matches = !targetParentIds || targetParentIds.includes(ps.parentId) || targetParentIds.includes(ps.parent_id || '');
            if (matches) {
              return {
                ...ps,
                status: 'completed' as const,
                completedTime: nowTimeStr,
                completed_time: nowTimeStr,
                completedAt: new Date().toISOString(),
              };
            }
            return ps;
          });

          const allCompleted = updatedStatuses.length > 0
            ? updatedStatuses.every(ps => ps.status === 'completed')
            : true;

          return {
            ...task,
            status: allCompleted ? 'completed' : task.status,
            parentStatuses: updatedStatuses,
            parent_statuses: updatedStatuses,
            completedTime: allCompleted ? nowTimeStr : task.completedTime,
            completed_time: allCompleted ? nowTimeStr : task.completed_time,
            completedAt: allCompleted ? new Date().toISOString() : task.completedAt,
          };
        }),
        alerts: targetTitle
          ? state.alerts.filter(a => !a.title.toLowerCase().includes(targetTitle) && !a.detail.toLowerCase().includes(targetTitle))
          : state.alerts,
        snoozedTaskId: null,
      };
    });

    try {
      await api.tasks.complete(targetId, options);
      const [updatedTasks, updatedAlerts] = await Promise.all([
        api.tasks.list().catch(() => null),
        api.alerts.list().catch(() => null),
      ]);
      set(state => ({
        tasks: updatedTasks || state.tasks,
        alerts: updatedAlerts || state.alerts,
      }));
    } catch (e) {
      console.warn('Backend task completion sync notice:', e);
    }
  },

  snoozeTask: async (id) => {
    set({ snoozedTaskId: id });
    try {
      await api.tasks.snooze(id, 10);
    } catch (e) {
      console.warn('Backend task snooze sync notice:', e);
    }
  },

  dismissAlert: async (id) => {
    set(state => ({ alerts: state.alerts.filter(alert => alert.id !== id) }));
    try {
      await api.alerts.dismiss(id);
    } catch (e) {
      console.warn('Backend alert dismiss sync notice:', e);
    }
  },
}));

// Initialize store from API when browser window is available
if (typeof window !== 'undefined') {
  useCareStore.getState().init();
}
