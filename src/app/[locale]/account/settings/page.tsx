'use client';

import { useState, useEffect } from 'react';

import { AccountSection, Field } from '@/components/account/primitives';
import PasswordRequirements from '@/components/ui/PasswordRequirements';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

const BTN_PRIMARY =
  'rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';
const BTN_OUTLINE =
  'rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-page';

interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

export default function SettingsPage() {
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
        <p className="text-sm text-ink-3">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <AccountSection
        title="Profile Information"
        action={
          !isEditingProfile && (
            <button
              onClick={() => {
                setProfileForm(profile);
                setIsEditingProfile(true);
              }}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Edit
            </button>
          )
        }
      >
        {profileSaved && (
          <div className="mt-3 rounded-[10px] border border-trust/20 bg-green-50 p-3 text-sm text-trust">
            Profile updated successfully.
          </div>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            <Field
              id="name"
              label="Full Name"
              type="text"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
            <Field
              id="email"
              label="Email"
              type="email"
              disabled
              value={profileForm.email}
              note="Email cannot be changed."
            />
            <Field
              id="phone"
              label="Phone Number"
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            />
            <div className="flex gap-3">
              <button type="submit" className={BTN_PRIMARY}>
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className={BTN_OUTLINE}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-ink-3">Full Name</dt>
              <dd className="text-sm font-medium text-ink">{profile.name || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Email</dt>
              <dd className="text-sm font-medium text-ink">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Phone</dt>
              <dd className="text-sm font-medium text-ink">{profile.phone || 'Not set'}</dd>
            </div>
          </dl>
        )}
      </AccountSection>

      {/* Saved Addresses Section */}
      <AccountSection
        title="Saved Addresses"
        action={
          <button
            onClick={() => setShowAddAddress(!showAddAddress)}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {showAddAddress ? 'Cancel' : '+ Add Address'}
          </button>
        }
      >
        {showAddAddress && (
          <form
            onSubmit={handleAddAddress}
            className="mt-4 space-y-3 rounded-[10px] border border-line bg-page p-4"
          >
            <Field
              id="addr-label"
              label="Label (e.g. Home, Office)"
              type="text"
              required
              inputClassName="text-sm"
              value={newAddress.label}
              onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
            />
            <Field
              id="addr-line1"
              label="Address Line 1"
              type="text"
              required
              inputClassName="text-sm"
              value={newAddress.line1}
              onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
            />
            <Field
              id="addr-line2"
              label="Address Line 2 (optional)"
              type="text"
              inputClassName="text-sm"
              value={newAddress.line2}
              onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="addr-city"
                label="City"
                type="text"
                required
                inputClassName="text-sm"
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
              />
              <Field
                id="addr-postcode"
                label="Postcode"
                type="text"
                required
                inputClassName="text-sm"
                value={newAddress.postcode}
                onChange={(e) => setNewAddress({ ...newAddress, postcode: e.target.value })}
              />
            </div>
            <button type="submit" className={BTN_PRIMARY}>
              Save Address
            </button>
          </form>
        )}

        {addresses.length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">No saved addresses yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {addresses.map((addr) => (
              <li
                key={addr.id}
                className="flex items-start justify-between rounded-[10px] border border-line p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.postcode}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefaultAddress(addr.id)}
                      className="text-xs text-ink-3 hover:text-ink"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveAddress(addr.id)}
                    className="text-xs text-danger hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccountSection>

      {/* Change Password Section */}
      <AccountSection title="Change Password">
        {passwordSuccess && (
          <div className="mt-3 rounded-[10px] border border-trust/20 bg-green-50 p-3 text-sm text-trust">
            Password changed successfully.
          </div>
        )}
        {passwordError && (
          <div className="mt-3 rounded-[10px] border border-danger/20 bg-red-50 p-3 text-sm text-danger">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <Field
            id="current-password"
            label="Current Password"
            type="password"
            required
            inputClassName="sm:max-w-md"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
          />
          <Field
            id="new-password"
            label="New Password"
            type="password"
            required
            minLength={8}
            inputClassName="sm:max-w-md"
            value={passwordForm.new}
            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
            after={<PasswordRequirements password={passwordForm.new} />}
          />
          <Field
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            required
            inputClassName="sm:max-w-md"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          />
          <button type="submit" className={BTN_PRIMARY}>
            Update Password
          </button>
        </form>
      </AccountSection>

      {/* Delete Account Section */}
      <AccountSection title="Danger Zone" tone="danger">
        <p className="mt-1 text-sm text-ink-2">
          Once you delete your account, all your data will be permanently removed. This action
          cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 rounded-[10px] border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-red-50"
        >
          Delete My Account
        </button>
      </AccountSection>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="font-newsreader text-xl font-semibold text-danger">Delete Account</h3>
            <p className="mt-2 text-sm text-ink-2">
              This will permanently delete your account and all associated data including bookings,
              reviews, and payment history.
            </p>
            <p className="mt-3 text-sm text-ink-2">
              Type <span className="font-mono font-bold text-danger">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-2 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="rounded-[10px] bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className={BTN_OUTLINE}
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
