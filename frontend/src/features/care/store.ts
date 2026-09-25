import { create } from 'zustand';
import { initialParents, initialTasks, initialAlerts, type Parent, type CareTask, type CareAlert } from './data';
type CareState = {
  parents: Parent[]; tasks: CareTask[]; alerts: CareAlert[]; snoozedTaskId: string | null;
  addParent: (name: string, relationship: string) => Parent;
  addTask: (task: Omit<CareTask, 'id' | 'status'>) => void;
  completeTask: (id: string) => void;
  snoozeTask: (id: string) => void;
  dismissAlert: (id: string) => void;
};
export const useCareStore = create<CareState>((set) => ({
  parents: initialParents, tasks: initialTasks, alerts: initialAlerts, snoozedTaskId: null,
  addParent: (name, relationship) => {
    const parent = { id: `parent-${Date.now()}`, name, relationship, initials: name.split(' ').map(part => part[0]).slice(0,2).join('').toUpperCase(), color: 'lavender', lastActivity: 'Just linked', completion: 0 };
    set(state => ({ parents: [...state.parents, parent] })); return parent;
  },
  addTask: task => set(state => ({ tasks: [...state.tasks, { ...task, id: `task-${Date.now()}`, status: 'pending' }] })),
  completeTask: id => set(state => ({ tasks: state.tasks.map(task => task.id === id ? { ...task, status: 'completed' } : task), snoozedTaskId: null })),
  snoozeTask: id => set({ snoozedTaskId: id }),
  dismissAlert: id => set(state => ({ alerts: state.alerts.filter(alert => alert.id !== id) })),
}));
