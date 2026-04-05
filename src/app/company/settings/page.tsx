'use client';

import { useState, useEffect, useRef } from 'react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setProfile({ ...profile, logoPreview: preview });
    }
  };

  const handleRemoveLogo = () => {
    if (profile.logoPreview && profile.logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(profile.logoPreview);
    }
    setProfile({ ...profile, logoPreview: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <h1 className="font-cormorant text-[32px] font-light leading-tight text-ink">
              Company Settings
            </h1>
            <p className="mt-1.5 font-jost text-[14px] font-light text-ink-2">
              Manage your company profile and preferences.
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 bg-teal/10 px-4 py-2">
              <svg className="h-4 w-4 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-jost text-[13px] font-medium text-teal">Saved</span>
            </div>
          )}
        </div>

        <div className="mt-10 space-y-8">
          {/* Basic Information */}
          <section className="bg-white p-6 md:p-8" style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}>
            <h2 className="font-cormorant text-[22px] font-light text-ink">Basic Information</h2>
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

              {/* Logo Upload */}
              <div>
                <label className={labelClass}>Company Logo</label>
                <div className="mt-2 flex items-center gap-5">
                  {profile.logoPreview ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-cream-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-cream-2">
                      <svg className="h-8 w-8 text-ink-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-jost text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline underline-offset-4 transition-colors hover:text-ink-2"
                    >
                      {profile.logoPreview ? 'Change logo' : 'Upload logo'}
                    </button>
                    {profile.logoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="font-jost text-[12px] font-light text-ink-3 underline underline-offset-4 transition-colors hover:text-ink"
                      >
                        Remove
                      </button>
                    )}
                    <p className="font-jost text-[11px] font-light text-ink-3">PNG, JPG, SVG or WebP. Max 2MB.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Details */}
          <section className="bg-white p-6 md:p-8" style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}>
            <h2 className="font-cormorant text-[22px] font-light text-ink">Contact Details</h2>
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
          <section className="bg-white p-6 md:p-8" style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}>
            <h2 className="font-cormorant text-[22px] font-light text-ink">Services Offered</h2>
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
