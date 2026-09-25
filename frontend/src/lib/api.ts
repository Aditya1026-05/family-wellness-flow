import { CareTask, Parent, CareAlert } from '@/features/care/data';

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) || 'http://localhost:8001/api/v1';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('carecircle_token');
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('carecircle_token', token);
  }
}

export function getParentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('carecircle_parent_token');
}

export function setParentToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('carecircle_parent_token', token);
  }
}

export function getCurrentParentProfile(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('carecircle_parent_profile');
  return raw ? JSON.parse(raw) : null;
}

export function setCurrentParentProfile(profile: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('carecircle_parent_profile', JSON.stringify(profile));
  }
}

export function getCurrentUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('carecircle_user');
  return raw ? JSON.parse(raw) : null;
}

export function setCurrentUser(user: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('carecircle_user', JSON.stringify(user));
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken() || getParentToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  auth: {
    register: async (data: { email: string; password: string; full_name: string }) => {
      const res = await request<{ access_token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...data, role: 'child' }),
      });
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      return res;
    },
    login: async (data: { email: string; password: string }) => {
      const res = await request<{ access_token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      return res;
    },
    me: () => request<any>('/auth/me'),
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('carecircle_token');
        localStorage.removeItem('carecircle_user');
        localStorage.removeItem('carecircle_parent_token');
        localStorage.removeItem('carecircle_parent_profile');
      }
    }
  },

  parents: {
    list: () => request<Parent[]>('/parents'),
    create: (data: { name: string; relationship: string; color?: string }) =>
      request<{ id: string; name: string; relationship: string; initials: string; color: string; invite_token: string; short_code: string; invite_code: string; completion: number; lastActivity: string }>('/parents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<Parent>(`/parents/${id}`),
    update: (id: string, data: { name?: string; relationship?: string; color?: string; avatar_url?: string }) =>
      request<Parent>(`/parents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<void>(`/parents/${id}`, { method: 'DELETE' }),
    getInvite: (id: string) => request<{ id: string; token: string; code: string; qr_value: string; expires_at: string; is_used: boolean; parent_profile_id: string; parent_name: string; family_id: string }>(`/parents/${id}/invite`),
    getWeeklyAdherence: (id: string) => request<{ day: string; rate: number }[]>(`/parents/${id}/adherence`),
  },

  invites: {
    create: (parentProfileId: string) =>
      request<any>('/invites', {
        method: 'POST',
        body: JSON.stringify({ parent_profile_id: parentProfileId }),
      }),
    getForParent: (parentId: string) =>
      request<{ id: string; token: string; code: string; qr_value: string; expires_at: string; is_used: boolean; parent_profile_id: string; parent_name: string; family_id: string }>(`/invites/parent/${parentId}`),
    regenerateForParent: (parentId: string) =>
      request<{ id: string; token: string; code: string; qr_value: string; expires_at: string; is_used: boolean; parent_profile_id: string; parent_name: string; family_id: string }>(`/invites/parent/${parentId}/regenerate`, {
        method: 'POST',
      }),
    accept: async (code: string) => {
      const res = await request<{ access_token: string; parent_profile_id: string; parent_name: string; relationship: string; family_id: string }>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setParentToken(res.access_token);
      setCurrentParentProfile(res);
      return res;
    },
  },

  tasks: {
    list: (parentId?: string, category?: string) => {
      const params = new URLSearchParams();
      if (parentId) params.set('parent_id', parentId);
      if (category && category !== 'All') params.set('category', category);
      const q = params.toString();
      return request<CareTask[]>(`/tasks${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<CareTask>(`/tasks/${id}`),
    create: (data: { name: string; category: string; parentId?: string; parentIds?: string[]; time: string; endTime?: string; repeat?: string; notes?: string }) =>
      request<CareTask>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: data.name,
          category: data.category,
          parent_profile_id: data.parentId,
          parent_ids: data.parentIds || (data.parentId ? [data.parentId] : []),
          scheduled_time: data.time,
          scheduled_end_time: data.endTime,
          repeat_pattern: data.repeat || 'Daily',
          notes: data.notes,
          detail: data.notes,
        }),
      }),
    update: (id: string, data: { name?: string; category?: string; parentId?: string; parentIds?: string[]; time?: string; endTime?: string; repeat?: string; notes?: string }) =>
      request<CareTask>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: data.name,
          category: data.category,
          parent_profile_id: data.parentId,
          parent_ids: data.parentIds || (data.parentId ? [data.parentId] : undefined),
          scheduled_time: data.time,
          scheduled_end_time: data.endTime,
          repeat_pattern: data.repeat,
          notes: data.notes,
          detail: data.notes,
        }),
      }),
    delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    getTodaySchedule: (parentId: string) =>
      request<any[]>(`/task-instances/parent/${parentId}/today`),
    getActiveTask: (parentId: string) =>
      request<any | null>(`/task-instances/parent/${parentId}/active`),
    complete: async (id: string, options?: { parentIds?: string[]; allParents?: boolean }) => {
      const body = options ? JSON.stringify(options) : undefined;
      try {
        return await request<any>(`/tasks/${id}/complete`, { method: 'POST', body });
      } catch (err) {
        return await request<any>(`/task-instances/${id}/complete`, { method: 'POST', body });
      }
    },
    snooze: (id: string, minutes: number = 10) =>
      request<any>(`/task-instances/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ action: 'snooze', snooze_minutes: minutes }),
      }),
  },

  alerts: {
    list: () => request<CareAlert[]>('/alerts'),
    dismiss: (id: string) => request<void>(`/alerts/${id}/dismiss`, { method: 'POST' }),
  },

  notifications: {
    list: () => request<any[]>('/notifications'),
    markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  }
};
