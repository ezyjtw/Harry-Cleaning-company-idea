'use client';

import { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'cleaner' | 'supervisor' | 'manager';
  active: boolean;
  rating: number;
  jobsCompleted: number;
  joinDate: string;
}

const initialMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@sparkle.co',
    phone: '07700 900001',
    role: 'supervisor',
    active: true,
    rating: 4.9,
    jobsCompleted: 214,
    joinDate: '2025-06-15',
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria@sparkle.co',
    phone: '07700 900002',
    role: 'cleaner',
    active: true,
    rating: 4.8,
    jobsCompleted: 187,
    joinDate: '2025-07-20',
  },
  {
    id: '3',
    name: 'Ewa Kowalski',
    email: 'ewa@sparkle.co',
    phone: '07700 900003',
    role: 'cleaner',
    active: true,
    rating: 4.7,
    jobsCompleted: 156,
    joinDate: '2025-08-10',
  },
  {
    id: '4',
    name: 'Fatima Al-Rashid',
    email: 'fatima@sparkle.co',
    phone: '07700 900004',
    role: 'cleaner',
    active: true,
    rating: 4.6,
    jobsCompleted: 132,
    joinDate: '2025-09-01',
  },
  {
    id: '5',
    name: 'Priya Sharma',
    email: 'priya@sparkle.co',
    phone: '07700 900005',
    role: 'cleaner',
    active: false,
    rating: 4.5,
    jobsCompleted: 98,
    joinDate: '2025-10-05',
  },
  {
    id: '6',
    name: 'Ana Popescu',
    email: 'ana@sparkle.co',
    phone: '07700 900006',
    role: 'supervisor',
    active: true,
    rating: 4.8,
    jobsCompleted: 176,
    joinDate: '2025-07-01',
  },
  {
    id: '7',
    name: 'Li Wei',
    email: 'li@sparkle.co',
    phone: '07700 900007',
    role: 'cleaner',
    active: true,
    rating: 4.4,
    jobsCompleted: 67,
    joinDate: '2025-12-15',
  },
  {
    id: '8',
    name: 'Olga Petrov',
    email: 'olga@sparkle.co',
    phone: '07700 900008',
    role: 'manager',
    active: true,
    rating: 4.9,
    jobsCompleted: 245,
    joinDate: '2025-05-01',
  },
];

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cleaner' as TeamMember['role'],
  });
  const [filterRole, setFilterRole] = useState<string>('all');

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email) return;
    const member: TeamMember = {
      id: String(Date.now()),
      name: newMember.name,
      email: newMember.email,
      phone: newMember.phone,
      role: newMember.role,
      active: true,
      rating: 0,
      jobsCompleted: 0,
      joinDate: new Date().toISOString().split('T')[0],
    };
    setMembers((prev) => [...prev, member]);
    setNewMember({ name: '', email: '', phone: '', role: 'cleaner' });
    setShowAddForm(false);
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m)));
  };

  const handleChangeRole = (id: string, role: TeamMember['role']) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  };

  const filteredMembers =
    filterRole === 'all' ? members : members.filter((m) => m.role === filterRole);
  const activeCount = members.filter((m) => m.active).length;

  const roleStyles: Record<string, string> = {
    cleaner: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-purple-100 text-purple-700',
    manager: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-1">
            {members.length} members &middot; {activeCount} active
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </button>
      </div>

      {/* Add member form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g. jane@sparkle.co"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g. 07700 900000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={newMember.role}
                onChange={(e) =>
                  setNewMember({ ...newMember, role: e.target.value as TeamMember['role'] })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="cleaner">Cleaner</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAddMember}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Add Member
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'cleaner', 'supervisor', 'manager'].map((role) => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterRole === role
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
            {role === 'all'
              ? ` (${members.length})`
              : ` (${members.filter((m) => m.role === role).length})`}
          </button>
        ))}
      </div>

      {/* Team members list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Contact
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Performance
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-semibold">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-400">Joined {member.joinDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-400">{member.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleChangeRole(member.id, e.target.value as TeamMember['role'])
                      }
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${roleStyles[member.role]}`}
                    >
                      <option value="cleaner">Cleaner</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <svg
                        className="w-3.5 h-3.5 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{member.rating > 0 ? member.rating : 'N/A'}</span>
                      <span className="text-gray-400 mx-1">&middot;</span>
                      <span>{member.jobsCompleted} jobs</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(member.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        member.active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          member.active ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
