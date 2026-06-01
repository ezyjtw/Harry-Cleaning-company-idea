'use client';

import { useState, useEffect } from 'react';

import PasswordRequirements from '@/components/ui/PasswordRequirements';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

export default function AccountPage() {
  // Profile state
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Addresses state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    postcode: '',
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch profile and addresses on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/profile').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/addresses').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([userData, addressData]) => {
        if (userData) {
          const p = {
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
          };
          setProfile(p);
          setProfileForm(p);
        }
        if (Array.isArray(addressData)) {
          setAddresses(
            addressData.map((a: Record<string, unknown>) => ({
              id: a.id as string,
              label: (a.label as string) || 'Address',
              line1: a.line1 as string,
              line2: (a.line2 as string) || undefined,
              city: a.city as string,
              postcode: a.postcode as string,
              isDefault: a.isDefault as boolean,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name, phone: profileForm.phone }),
      });
      if (res.ok) {
        setProfile(profileForm);
        setIsEditingProfile(false);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch {}
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newAddress.label,
          line1: newAddress.line1,
          line2: newAddress.line2 || null,
          city: newAddress.city,
          postcode: newAddress.postcode,
          isDefault: addresses.length === 0,
        }),
      });
      if (res.ok) {
        const addr = await res.json();
        setAddresses((prev) => [
          ...prev,
          {
            id: addr.id,
            label: addr.label || 'Address',
            line1: addr.line1,
            line2: addr.line2 || undefined,
            city: addr.city,
            postcode: addr.postcode,
            isDefault: addr.isDefault,
          },
        ]);
        setNewAddress({ label: '', line1: '', line2: '', city: '', postcode: '' });
        setShowAddAddress(false);
      }
    } catch {}
  };

  const handleRemoveAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {}
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      }
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    const pwResult = validatePasswordPolicy(passwordForm.new);
    if (!pwResult.valid) {
      setPasswordError(pwResult.errors[0]);
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setPasswordForm({ current: '', new: '', confirm: '' });
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password.');
      }
    } catch {
      setPasswordError('Failed to change password.');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      await fetch('/api/auth/profile', {
        method: 'DELETE',
      });
      window.location.href = '/';
    } catch {}
    setShowDeleteModal(false);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          {!isEditingProfile && (
            <button
              onClick={() => {
                setProfileForm(profile);
                setIsEditingProfile(true);
              }}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Edit
            </button>
          )}
        </div>

        {profileSaved && (
          <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Profile updated successfully.
          </div>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                disabled
                value={profileForm.email}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">Email cannot be changed.</p>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Full Name</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.name || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.phone || 'Not set'}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Saved Addresses Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Saved Addresses</h2>
          <button
            onClick={() => setShowAddAddress(!showAddAddress)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {showAddAddress ? 'Cancel' : '+ Add Address'}
          </button>
        </div>

        {showAddAddress && (
          <form
            onSubmit={handleAddAddress}
            className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div>
              <label htmlFor="addr-label" className="block text-sm font-medium text-gray-700">
                Label (e.g. Home, Office)
              </label>
              <input
                id="addr-label"
                type="text"
                required
                value={newAddress.label}
                onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="addr-line1" className="block text-sm font-medium text-gray-700">
                Address Line 1
              </label>
              <input
                id="addr-line1"
                type="text"
                required
                value={newAddress.line1}
                onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="addr-line2" className="block text-sm font-medium text-gray-700">
                Address Line 2 (optional)
              </label>
              <input
                id="addr-line2"
                type="text"
                value={newAddress.line2}
                onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="addr-city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  id="addr-city"
                  type="text"
                  required
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label htmlFor="addr-postcode" className="block text-sm font-medium text-gray-700">
                  Postcode
                </label>
                <input
                  id="addr-postcode"
                  type="text"
                  required
                  value={newAddress.postcode}
                  onChange={(e) => setNewAddress({ ...newAddress, postcode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Save Address
            </button>
          </form>
        )}

        {addresses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No saved addresses yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {addresses.map((addr) => (
              <li
                key={addr.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.postcode}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefaultAddress(addr.id)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveAddress(addr.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Change Password Section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>

        {passwordSuccess && (
          <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Password changed successfully.
          </div>
        )}
        {passwordError && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-md"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={passwordForm.new}
              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-md"
            />
            <PasswordRequirements password={passwordForm.new} />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-md"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Update Password
          </button>
        </form>
      </section>

      {/* Delete Account Section */}
      <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-1 text-sm text-gray-600">
          Once you delete your account, all your data will be permanently removed. This action
          cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Delete My Account
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete your account and all associated data including bookings,
              reviews, and payment history.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
