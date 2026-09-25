export type Category = 'Meal' | 'Medicine' | 'Exercise' | 'Appointment' | 'Wellness';
export type TaskStatus = 'completed' | 'pending' | 'missed';
export type ParentTaskStatus = {
  parent_id?: string;
  parentId: string;
  parent_name?: string;
  parentName: string;
  relationship?: string;
  status: TaskStatus;
  completed_at?: string;
  completedAt?: string;
  completed_time?: string;
  completedTime?: string;
};

export type CareTask = {
  id: string;
  name: string;
  category: Category;
  parentId: string;
  parentIds?: string[];
  assigned_parent_names?: string[];
  parent_statuses?: ParentTaskStatus[];
  parentStatuses?: ParentTaskStatus[];
  time: string;
  endTime?: string;
  end_time?: string;
  status: TaskStatus;
  repeat: string;
  notes?: string;
  detail?: string;
  is_ended?: boolean;
  isEnded?: boolean;
  completed_at?: string;
  completedAt?: string;
  completed_time?: string;
  completedTime?: string;
};
export type Parent = {
  id: string;
  name: string;
  relationship: string;
  initials: string;
  color: string;
  lastActivity: string;
  completion: number;
  invite_code?: string;
  short_code?: string;
};
export type CareAlert = {
  id: string;
  title: string;
  detail: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  time: string;
  type: 'Escalation' | 'Missed task' | 'Urgent';
};
export const initialParents: Parent[] = [];
export const initialTasks: CareTask[] = [];
export const initialAlerts: CareAlert[] = [];

export type TaskDayDetail = {
  task_id: string;
  instance_id: string;
  title: string;
  category?: string;
  status: TaskStatus;
  scheduled_time?: string;
  completed_time?: string;
};

export type ParentAdherenceDay = {
  day: string;
  rate: number;
  date?: string;
  day_number?: number;
  has_tasks?: boolean;
  total_tasks?: number;
  completed_tasks?: number;
  tasks?: TaskDayDetail[];
};

export const defaultHistory: ParentAdherenceDay[] = [
  { day: 'Mon', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Tue', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Wed', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Thu', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Fri', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Sat', rate: 0, has_tasks: false, tasks: [] },
  { day: 'Sun', rate: 0, has_tasks: false, tasks: [] },
];
export const history = defaultHistory;

import { api } from '@/lib/api';

export const mockApi = {
  getWeeklyAdherence: async (parentId: string) => {
    try {
      const res = await api.parents.getWeeklyAdherence(parentId);
      if (res && res.length) return res;
    } catch {}
    return defaultHistory;
  },
};
