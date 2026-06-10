export const EMPLOYEES = [
  { id: 1, name: 'Arjun Kumar', initials: 'AK', color: '#1E88E5', role: 'Engineering', department: 'Tech' },
  { id: 2, name: 'Priya Sharma', initials: 'PS', color: '#8E24AA', role: 'Design', department: 'Creative' },
  { id: 3, name: 'Rahul Singh', initials: 'RS', color: '#00ACC1', role: 'Operations', department: 'Ops' },
  { id: 4, name: 'Meena Patel', initials: 'MP', color: '#FB8C00', role: 'HR', department: 'People' },
  { id: 5, name: 'Karthik Raj', initials: 'KR', color: '#43A047', role: 'Sales', department: 'Revenue' },
];

export function resolveEmployee(name) {
  const q = (name || '').trim().toLowerCase();
  const emp = EMPLOYEES.find((e) => e.name.toLowerCase() === q);
  if (!emp) throw new Error('Invalid employee. Please select from the list.');
  return emp;
}

export function findEmployee(name) {
  return EMPLOYEES.find((e) => e.name.toLowerCase() === (name || '').trim().toLowerCase());
}