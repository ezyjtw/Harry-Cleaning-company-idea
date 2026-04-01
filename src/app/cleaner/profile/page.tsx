'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const specialtyOptions = [
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'AirBnB / Short-Let',
  'Carpet Cleaning',
  'Window Cleaning',
  'Oven Cleaning',
];

const languageOptions = [
  'English',
  'Spanish',
  'French',
  'Portuguese',
  'Polish',
  'Romanian',
  'Arabic',
  'Hindi',
  'Mandarin',
  'Tagalog',
  'Italian',
  'German',
];

export default function CleanerProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('15');
  const [rateError, setRateError] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [travelRadius, setTravelRadius] = useState('10');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [customLanguages, setCustomLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch profile data on mount
  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setBio(data.bio || '');
        setHourlyRate(String(data.hourlyRate || 15));
        setSelectedSpecialties(data.specialties || []);
        setTravelRadius(String(data.radius || 10));
        setPhoto(data.image || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setSaved(false);
  };

  const toggleLanguage = (l: string) => {
    setSelectedLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
    setSaved(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    const res = await fetch('/api/cleaner/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio,
        hourlyRate: Number(hourlyRate),
        specialties: selectedSpecialties,
        radius: Number(travelRadius),
        image: photo,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }, [bio, hourlyRate, selectedSpecialties, travelRadius, photo]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 w-32" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-ink/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Edit Profile</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Update your public profile information
        </p>
      </div>

      <div className="space-y-6">
        {/* Photo upload */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Profile Photo</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-cream-2 border-2 border-dashed border-ink-3/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {photo ? (
                <Image
                  src={photo}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-8 h-8 text-ink-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              )}
            </div>
            <div>
              <label
                className="inline-flex items-center gap-2 px-4 py-2 bg-cream text-ink font-jost text-sm font-light cursor-pointer hover:bg-cream-2 transition-colors"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
                JPG, PNG. Max 5MB. A clear headshot works best.
              </p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">About You</h2>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setSaved(false);
            }}
            placeholder="Tell customers about yourself, your experience, and what makes you a great cleaner..."
            className="w-full px-4 py-3 font-jost font-light text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 resize-none bg-cream"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            rows={4}
          />
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Hourly rate */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Hourly Rate</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-jost text-sm font-light text-ink-2">
                £
              </span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => {
                  const val = e.target.value;
                  setHourlyRate(val);
                  setSaved(false);
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    if (num < 14) setRateError('Minimum rate on Rena is £14/hr');
                    else if (num > 35)
                      setRateError('Rates above £35/hr require admin review before publishing');
                    else setRateError('');
                  }
                }}
                min="14"
                max="35"
                className="w-32 pl-7 pr-4 py-2.5 font-jost font-light text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 bg-cream"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
            </div>
            <span className="font-jost text-sm font-light text-ink-2">per hour</span>
          </div>
          {rateError && <p className="font-jost text-sm text-red-600 mt-2">{rateError}</p>}
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
            Suggested range: £15–£22/hr
          </p>

          {/* Earnings preview */}
          {(() => {
            const rate = parseFloat(hourlyRate);
            if (isNaN(rate) || rate < 14 || rate > 35) return null;
            const fee = 0.1;
            return (
              <div
                className="mt-4 rounded-lg bg-cream-2 p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
              >
                <p className="font-jost text-sm font-medium text-ink mb-1">Your rate: £{rate}/hr</p>
                <p className="font-jost text-xs text-ink-3 mb-3">
                  Rena platform fee: 10% (deducted from your payout)
                </p>
                <div className="space-y-1">
                  {[2, 3, 4].map((h) => {
                    const gross = rate * h;
                    const feeAmt = Math.round(gross * fee * 100) / 100;
                    const net = Math.round(gross * (1 - fee) * 100) / 100;
                    return (
                      <p key={h} className="font-jost text-sm text-ink-2">
                        {h}hr visit: you earn{' '}
                        <span className="font-medium text-ink">£{net.toFixed(2)}</span>
                        <span className="text-ink-3 ml-1">
                          (gross £{gross.toFixed(2)}, minus £{feeAmt.toFixed(2)} fee)
                        </span>
                      </p>
                    );
                  })}
                </div>
                <p className="font-jost text-xs text-ink-3 mt-3">
                  The customer pays a separate 6% service fee — your advertised rate is what you
                  charge.
                </p>
              </div>
            );
          })()}
        </div>

        {/* Specialties */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Specialties</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            Select the cleaning services you offer
          </p>
          <div className="flex flex-wrap gap-2">
            {specialtyOptions.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-2 font-jost text-sm font-light transition-colors ${
                  selectedSpecialties.includes(s)
                    ? 'bg-ink text-cream'
                    : 'bg-cream text-ink-2 hover:bg-cream-2'
                }`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                {selectedSpecialties.includes(s) && (
                  <svg
                    className="w-4 h-4 inline mr-1 -mt-0.5"
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
                )}
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* EOT & Airbnb Pricing */}
        {(selectedSpecialties.includes('End of Tenancy') ||
          selectedSpecialties.includes('AirBnB / Short-Let')) && (
          <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-cormorant text-lg font-light text-ink mb-2">Service Pricing</h2>
            <p className="font-jost text-sm font-light text-ink-2 mb-5">
              Set your prices for each property size. You are free to set any price you choose. The
              guide below shows typical rates on Rena to help you stay competitive.
            </p>

            {selectedSpecialties.includes('End of Tenancy') && (
              <div className="mb-6">
                <h3 className="font-jost text-sm font-medium text-ink mb-3">End of Tenancy</h3>
                <div
                  className="overflow-hidden"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-cream-2">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Property
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Your price
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Rena guide
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Studio', guide: '£150 – £200' },
                        { label: '1 bed', guide: '£190 – £240' },
                        { label: '2 bed', guide: '£250 – £300' },
                        { label: '3 bed', guide: '£320 – £380' },
                        { label: '4 bed', guide: '£390 – £450' },
                        { label: '5 bed+', guide: '£480 – £580' },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                        >
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                            {row.label}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                £
                              </span>
                              <input
                                type="number"
                                placeholder="—"
                                className="w-24 pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-cream focus:outline-none focus:ring-1 focus:ring-gold/30"
                                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                                onChange={() => setSaved(false)}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                            {row.guide}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedSpecialties.includes('AirBnB / Short-Let') && (
              <div className="mb-6">
                <h3 className="font-jost text-sm font-medium text-ink mb-3">Airbnb / Short-Let</h3>
                <div
                  className="overflow-hidden"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-cream-2">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Property
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Your price
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Rena guide
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Studio', guide: '£45 – £65' },
                        { label: '1 bed', guide: '£55 – £85' },
                        { label: '2 bed', guide: '£75 – £110' },
                        { label: '3 bed', guide: '£95 – £140' },
                        { label: '4 bed+', guide: '£130 – £165' },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                        >
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                            {row.label}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                £
                              </span>
                              <input
                                type="number"
                                placeholder="—"
                                className="w-24 pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-cream focus:outline-none focus:ring-1 focus:ring-gold/30"
                                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                                onChange={() => setSaved(false)}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                            {row.guide}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fee info box */}
            <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}>
              <p className="font-jost text-sm font-medium text-ink mb-2">How fees work</p>
              <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
                For End of Tenancy and Airbnb bookings, Rena charges a 15% platform fee on your
                listed price. This is deducted from your payout after the job is completed. The
                customer also pays a separate 6% service fee on top of your listed price &mdash;
                this does not affect your earnings.
              </p>
              <div
                className="mt-4 bg-cream p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <p className="font-jost text-xs font-medium text-ink mb-1">
                  Example: you charge &pound;270 for a 2-bed EOT
                </p>
                <p className="font-jost text-xs font-light text-ink-2">
                  Customer pays: &pound;270 + &pound;16.20 (6%) = &pound;286.20
                </p>
                <p className="font-jost text-xs font-light text-ink-2">
                  You receive: &pound;270 &minus; &pound;40.50 (15%) = &pound;229.50
                </p>
              </div>
              <p className="font-jost text-xs font-light text-ink-3 mt-3">
                For all other services (regular, one-off, same-day, deep clean), the standard 10%
                platform fee applies and the customer pays a separate 6% service fee.
              </p>
            </div>
          </div>
        )}

        {/* Travel radius */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Travel Radius</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            How many miles from your home location are you willing to travel for a job?
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={travelRadius}
              onChange={(e) => {
                setTravelRadius(e.target.value);
                setSaved(false);
              }}
              min="1"
              max="50"
              placeholder="e.g. 10"
              className="w-32 px-4 py-2.5 font-jost font-light text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 bg-cream"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            />
            <span className="font-jost text-sm font-light text-ink-2">miles</span>
          </div>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
            Customers within this radius of your home will be able to find you
          </p>
        </div>

        {/* Languages */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Languages Spoken</h2>
          <div className="flex flex-wrap gap-2">
            {[...languageOptions, ...customLanguages].map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`px-3 py-2 font-jost text-sm font-light transition-colors ${
                  selectedLanguages.includes(l)
                    ? 'bg-ink text-cream'
                    : 'bg-cream text-ink-2 hover:bg-cream-2'
                }`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <p className="font-jost text-sm font-light text-ink-2 mb-2">
              Don&apos;t see your language?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                placeholder="e.g. Swahili"
                className="w-48 px-4 py-2.5 font-jost font-light text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 bg-cream"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
              <button
                type="button"
                onClick={() => {
                  const lang = customLanguage.trim();
                  if (
                    lang &&
                    !selectedLanguages.includes(lang) &&
                    !languageOptions.includes(lang)
                  ) {
                    setCustomLanguages((prev) => [...prev, lang]);
                    setSelectedLanguages((prev) => [...prev, lang]);
                    setCustomLanguage('');
                    setSaved(false);
                  }
                }}
                disabled={!customLanguage.trim()}
                className="px-4 py-2.5 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="font-jost text-sm font-light text-gold flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Profile saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 bg-ink text-cream font-jost font-light hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
