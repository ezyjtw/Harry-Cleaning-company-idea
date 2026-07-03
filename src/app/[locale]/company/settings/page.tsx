'use client';

import { useState, useEffect } from 'react';

import { useCompany } from '../_context/CompanyContext';

interface CompanyProfile {
  name: string;
  description: string;
  logoPreview: string;
  email: string;
  phone: string;
  website: string;
  specialties: string[];
}

const allSpecialties = [
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'AirBnB Turnover',
  'Carpet Cleaning',
  'Window Cleaning',
  'Post-Construction',
  'Move-In/Move-Out',
  'Spring Cleaning',
];

export default function SettingsPage() {
  const { company } = useCompany();
  const [profile, setProfile] = useState<CompanyProfile>({
    name: '',
    description: '',
    logoPreview: '',
    email: '',
    phone: '',
    website: '',
    specialties: [],
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) return;

    fetch(`/api/companies/${company.id}`)
      .then((r) => r.json())
      .then((data) => {
        const c = data.company;
        if (c) {
          setProfile({
            name: c.name || '',
            description: c.description || '',
            logoPreview: c.logo || '',
            email: c.email || '',
            phone: c.phone || '',
            website: c.website || '',
            specialties: c.specialties || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          description: profile.description,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
          logo: profile.logoPreview || null,
          specialties: profile.specialties,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    setSaving(false);
  };

  const toggleSpecialty = (specialty: string) => {
    setProfile((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const inputClass =
    'w-full border-b border-ink/15 bg-transparent px-1 py-3 font-jost text-[14px] font-light text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none';
  const labelClass = 'block font-jost text-[13px] font-medium tracking-wide text-ink mb-1';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-newsreader text-[32px] font-semibold leading-tight text-ink">
              Company Settings
            </h1>
            <p className="mt-1.5 font-jost text-[14px] font-light text-ink-2">
              Manage your company profile and preferences.
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 bg-teal/10 px-4 py-2">
              <svg
                className="h-4 w-4 text-teal"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-jost text-[13px] font-medium text-teal">Saved</span>
            </div>
          )}
        </div>

        <div className="mt-10 space-y-8">
          {/* Basic Information */}
          <section
            className="bg-white p-6 md:p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
          >
            <h2 className="font-newsreader text-[22px] font-semibold text-ink">Basic Information</h2>
            <div className="mt-6 space-y-5">
              <div>
                <label className={labelClass}>Company Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={profile.description}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </section>

          {/* Contact Details */}
          <section
            className="bg-white p-6 md:p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
          >
            <h2 className="font-newsreader text-[22px] font-semibold text-ink">Contact Details</h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Website</label>
                <input
                  type="url"
                  value={profile.website}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Specialties */}
          <section
            className="bg-white p-6 md:p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
          >
            <h2 className="font-newsreader text-[22px] font-semibold text-ink">Services Offered</h2>
            <p className="mt-1 font-jost text-[13px] font-light text-ink-3">
              Select the services your company provides.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {allSpecialties.map((specialty) => {
                const isActive = profile.specialties.includes(specialty);
                return (
                  <button
                    key={specialty}
                    onClick={() => toggleSpecialty(specialty)}
                    className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                      isActive
                        ? 'bg-ink text-cream'
                        : 'border border-ink/15 text-ink hover:border-ink/30'
                    }`}
                  >
                    {specialty}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-ink px-8 py-3 font-jost text-[13px] font-medium tracking-wide text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
