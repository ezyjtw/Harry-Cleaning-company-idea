'use client';

import { useState, useEffect, useCallback } from 'react';

import { useCompany } from '../_context/CompanyContext';

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

export default function TeamPage() {
  const { company } = useCompany();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', role: 'CLEANER' });
  const [addError, setAddError] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const fetchTeam = useCallback(() => {
    if (!company?.id) return;
    fetch(`/api/companies/${company.id}/team?active=false`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(
          (data.members || []).map((m: Record<string, unknown>) => ({
            id: m.id,
            userId: (m as Record<string, unknown>).userId,
            name:
              ((m as Record<string, unknown>).user as Record<string, unknown>)?.name || 'Unknown',
            email: ((m as Record<string, unknown>).user as Record<string, unknown>)?.email || '',
            role: ((m.role as string) || 'CLEANER').toLowerCase(),
            isActive: m.isActive as boolean,
            joinedAt: typeof m.joinedAt === 'string' ? m.joinedAt.split('T')[0] : '',
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAddMember = async () => {
    if (!newMember.email || !company?.id) return;
    setAddError('');

    try {
      const res = await fetch(`/api/companies/${company.id}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMember.email, role: newMember.role }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAddError(err.error || 'Failed to add member');
        return;
      }
      setNewMember({ email: '', role: 'CLEANER' });
      setShowAddForm(false);
      fetchTeam();
    } catch {
      setAddError('Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!company?.id) return;
    try {
      await fetch(`/api/companies/${company.id}/team/${userId}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {}
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (!company?.id) return;
    try {
      await fetch(`/api/companies/${company.id}/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, isActive: !currentActive } : m))
      );
    } catch {}
  };

  const handleChangeRole = async (userId: string, role: string) => {
    if (!company?.id) return;
    try {
      await fetch(`/api/companies/${company.id}/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role.toUpperCase() }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: role.toLowerCase() } : m))
      );
    } catch {}
  };

  const filteredMembers =
    filterRole === 'all' ? members : members.filter((m) => m.role === filterRole);
  const activeCount = members.filter((m) => m.isActive).length;

  const roleStyles: Record<string, string> = {
    cleaner: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-purple-100 text-purple-700',
    manager: 'bg-green-100 text-green-700',
    owner: 'bg-amber-100 text-amber-700',
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-1">
            {members.length} members &middot; {activeCount} active
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Member
          </button>
        </div>
      </div>

      {/* Add member form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Existing User by Email</h3>
          {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g. cleaner@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="CLEANER">Cleaner</option>
                <option value="MANAGER">Manager</option>
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
        {['all', 'cleaner', 'manager', 'owner'].map((role) => (
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
                  Email
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
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
                <tr key={member.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-semibold">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-400">Joined {member.joinedAt}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {member.role === 'owner' ? (
                      <span
                        className={`text-xs font-medium rounded-full px-2.5 py-1 ${roleStyles.owner}`}
                      >
                        Owner
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${roleStyles[member.role] || roleStyles.cleaner}`}
                      >
                        <option value="cleaner">Cleaner</option>
                        <option value="manager">Manager</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {member.role !== 'owner' ? (
                      <button
                        onClick={() => handleToggleActive(member.userId, member.isActive)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          member.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            member.isActive ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
