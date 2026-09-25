export type Category = 'Meal' | 'Medicine' | 'Exercise' | 'Appointment' | 'Wellness';
export type TaskStatus = 'completed' | 'pending' | 'missed';
export type CareTask = { id: string; name: string; category: Category; parentId: string; time: string; status: TaskStatus; repeat: string; notes?: string; detail?: string };
export type Parent = { id: string; name: string; relationship: string; initials: string; color: string; lastActivity: string; completion: number };
export type CareAlert = { id: string; title: string; detail: string; priority: 'Low' | 'Medium' | 'High' | 'Critical'; time: string; type: 'Escalation' | 'Missed task' | 'Urgent' };
export const initialParents: Parent[] = [
  { id: 'mom', name: 'Meera Tayal', relationship: 'Mom', initials: 'MT', color: 'peach', lastActivity: 'Today at 9:15 AM', completion: 92 },
  { id: 'dad', name: 'Rajesh Tayal', relationship: 'Dad', initials: 'RT', color: 'mint', lastActivity: 'Today at 8:42 AM', completion: 78 },
];
export const initialTasks: CareTask[] = [
  { id: '1', name: 'Breakfast', category: 'Meal', parentId: 'mom', time: '8:00 AM', status: 'completed', repeat: 'Daily', detail: 'Oats, banana & milk' },
  { id: '2', name: 'Morning medicine', category: 'Medicine', parentId: 'mom', time: '9:30 AM', status: 'pending', repeat: 'Daily', detail: 'Vitamin D & calcium' },
  { id: '3', name: 'Morning walk', category: 'Exercise', parentId: 'mom', time: '10:30 AM', status: 'completed', repeat: 'Daily', detail: 'A gentle walk outside' },
  { id: '4', name: 'Lunch', category: 'Meal', parentId: 'mom', time: '1:00 PM', status: 'pending', repeat: 'Daily', detail: 'Dal, rice & vegetables' },
  { id: '5', name: 'BP medicine', category: 'Medicine', parentId: 'dad', time: '8:30 AM', status: 'completed', repeat: 'Daily', detail: 'Amlodipine 5mg' },
  { id: '6', name: 'Breakfast', category: 'Meal', parentId: 'dad', time: '9:00 AM', status: 'missed', repeat: 'Daily', detail: 'Toast & fruit' },
  { id: '7', name: 'Evening stretches', category: 'Exercise', parentId: 'dad', time: '5:00 PM', status: 'pending', repeat: 'Daily', detail: '15 minutes of gentle stretches' },
  { id: '8', name: 'Doctor check-in', category: 'Appointment', parentId: 'dad', time: '4:00 PM', status: 'pending', repeat: 'Once', detail: 'Routine check-up with Dr. Shah' },
];
export const initialAlerts: CareAlert[] = [
  { id: 'a1', title: 'Dad missed Breakfast', detail: 'Rajesh has not confirmed his 9:00 AM breakfast.', priority: 'High', time: 'Today, 9:45 AM', type: 'Missed task' },
  { id: 'a2', title: 'Morning medicine is still pending', detail: 'A gentle reminder was sent to Mom.', priority: 'Medium', time: 'Today, 9:40 AM', type: 'Escalation' },
  { id: 'a3', title: 'Doctor check-in today', detail: 'Dad has an appointment at 4:00 PM.', priority: 'Low', time: 'Today, 8:00 AM', type: 'Urgent' },
];
export const history = [
  { day: 'Mon', rate: 86 }, { day: 'Tue', rate: 100 }, { day: 'Wed', rate: 80 }, { day: 'Thu', rate: 92 }, { day: 'Fri', rate: 75 }, { day: 'Sat', rate: 100 }, { day: 'Sun', rate: 92 },
];
export const mockApi = {
  getWeeklyAdherence: async (_parentId: string) => { await new Promise(resolve => setTimeout(resolve, 200)); return history; },
};
