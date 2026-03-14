'use client';

import { useState } from 'react';

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
  const [profile, setProfile] = useState({
    name: 'Sarah Johnson',
    email: 'client@rena.com',
    phone: '+44 7700 900000',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(profile);
  const [profileSaved, setProfileSaved] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      label: 'Home',
      line1: '42 Baker Street',
      city: 'London',
      postcode: 'NW1 6XE',
      isDefault: true,
    },
    {
      id: '2',
      label: 'Office',
      line1: '10 Downing Street',
      city: 'London',
      postcode: 'SW1A 2AA',
      isDefault: false,
    },
  ]);
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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call API to update profile
    setProfile(profileForm);
    setIsEditingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call API to save address
    const addr: Address = {
      id: Date.now().toString(),
      label: newAddress.label,
      line1: newAddress.line1,
      line2: newAddress.line2 || undefined,
      city: newAddress.city,
      postcode: newAddress.postcode,
      isDefault: addresses.length === 0,
    };
    setAddresses([...addresses, addr]);
    setNewAddress({ label: '', line1: '', line2: '', city: '', postcode: '' });
    setShowAddAddress(false);
  };

  const handleRemoveAddress = (id: string) => {
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  const handleSetDefaultAddress = (id: string) => {
    setAddresses(addresses.map((a) => ({ ...a, isDefault: a.id === id })));
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordForm.new.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }
    // TODO: Call API to change password
    setPasswordSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== 'DELETE') return;
    // TODO: Call API to delete account
    // eslint-disable-next-line no-alert
    alert('Account deletion requested. You will be signed out.');
    setShowDeleteModal(false);
  };

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
                required
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                required
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
              <dd className="text-sm font-medium text-gray-900">{profile.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.phone}</dd>
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
            <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters.</p>
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
