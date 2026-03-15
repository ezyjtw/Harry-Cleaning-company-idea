'use client';

import { useState } from 'react';

interface CompanyProfile {
  name: string;
  description: string;
  logoUrl: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  operatingAreas: string[];
  specialties: string[];
}

const initialProfile: CompanyProfile = {
  name: 'Sparkle Co.',
  description:
    'Professional residential and commercial cleaning services across London. We pride ourselves on eco-friendly products, reliable scheduling, and exceptional attention to detail.',
  logoUrl: 'https://example.com/sparkle-logo.png',
  email: 'hello@sparkle.co',
  phone: '020 7946 0958',
  website: 'https://sparkle.co',
  address: '45 Commercial St, London, E1 6BD',
  operatingAreas: ['Central London', 'East London', 'South London', 'West London'],
  specialties: [
    'Regular Cleaning',
    'Deep Cleaning',
    'End of Tenancy',
    'AirBnB Turnover',
    'Office Cleaning',
  ],
};

const allAreas = [
  'Central London',
  'North London',
  'East London',
  'South London',
  'West London',
  'Canary Wharf',
  'Richmond',
  'Greenwich',
  'Hampstead',
  'Brixton',
];
const allSpecialties = [
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'AirBnB Turnover',
  'Office Cleaning',
  'Carpet Cleaning',
  'Window Cleaning',
  'Post-Construction',
  'Move-In/Move-Out',
  'Spring Cleaning',
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile>(initialProfile);
  const [saved, setSaved] = useState(false);
  const [newArea, setNewArea] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddArea = (area: string) => {
    if (area && !profile.operatingAreas.includes(area)) {
      setProfile({ ...profile, operatingAreas: [...profile.operatingAreas, area] });
      setNewArea('');
    }
  };

  const handleRemoveArea = (area: string) => {
    setProfile({ ...profile, operatingAreas: profile.operatingAreas.filter((a) => a !== area) });
  };

  const handleAddSpecialty = (specialty: string) => {
    if (specialty && !profile.specialties.includes(specialty)) {
      setProfile({ ...profile, specialties: [...profile.specialties, specialty] });
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setProfile({ ...profile, specialties: profile.specialties.filter((s) => s !== specialty) });
  };

  const availableAreas = allAreas.filter((a) => !profile.operatingAreas.includes(a));
  const availableSpecialties = allSpecialties.filter((s) => !profile.specialties.includes(s));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-gray-500 mt-1">Manage your company profile and preferences.</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">Changes saved</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={profile.logoUrl}
                onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Operating Areas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Operating Areas</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.operatingAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700"
              >
                {area}
                <button
                  onClick={() => handleRemoveArea(area)}
                  className="text-green-500 hover:text-green-800 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          {availableAreas.length > 0 && (
            <div className="flex gap-2">
              <select
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select an area to add...</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleAddArea(newArea)}
                disabled={!newArea}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Specialties */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Specialties</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.specialties.map((specialty) => (
              <span
                key={specialty}
                className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700"
              >
                {specialty}
                <button
                  onClick={() => handleRemoveSpecialty(specialty)}
                  className="text-purple-500 hover:text-purple-800 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          {availableSpecialties.length > 0 && (
            <div className="flex gap-2">
              <select
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a specialty to add...</option>
                {availableSpecialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleAddSpecialty(newSpecialty)}
                disabled={!newSpecialty}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
