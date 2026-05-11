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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [travelRadius, setTravelRadius] = useState('10');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [customLanguages, setCustomLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setPostcode(data.postcode || '');
        setBio(data.bio || '');
        setYearsExperience(String(data.yearsExperience || ''));
        setSelectedSpecialties(data.specialties || []);
        setTravelRadius(String(data.radius || 10));
        setPhoto(data.image || null);
        if (data.languages && data.languages.length > 0) {
          setSelectedLanguages(data.languages);
          const custom = data.languages.filter((l: string) => !languageOptions.includes(l));
          setCustomLanguages(custom);
        }
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
        specialties: selectedSpecialties,
        languages: selectedLanguages,
        radius: Number(travelRadius),
        postcode,
        image: photo,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }, [bio, selectedSpecialties, selectedLanguages, travelRadius, postcode, photo, yearsExperience]);

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
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-cream text-ink font-jost text-sm font-light cursor-pointer hover:bg-cream-2 transition-colors"
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

        {/* Personal info */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Personal Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Full Name
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{name || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Email
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{email || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Phone
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{phone || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Postcode
              </label>
              <input
                type="text"
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. SW1A 1AA"
                className="mt-1.5 w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>
            {yearsExperience && (
              <div>
                <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                  Years of Experience
                </label>
                <p className="mt-1.5 font-jost text-sm text-ink">{yearsExperience}</p>
              </div>
            )}
          </div>
          <p className="mt-4 font-jost text-[11px] text-ink-3">
            To update your name, email, or phone, please contact support.
          </p>
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
            className="w-full rounded-lg px-4 py-3 font-jost font-light text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none transition"
            style={{ border: '1px solid rgba(14,14,12,0.1)' }}
            rows={4}
          />
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Specialties */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Specialties</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            Select the cleaning specialties you offer
          </p>
          <div className="flex flex-wrap gap-2">
            {specialtyOptions.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  selectedSpecialties.includes(s)
                    ? 'bg-ink text-cream shadow-sm'
                    : 'bg-white text-ink-2 hover:bg-cream-2'
                }`}
                style={
                  selectedSpecialties.includes(s)
                    ? undefined
                    : { border: '1px solid rgba(14,14,12,0.1)' }
                }
              >
                {selectedSpecialties.includes(s) && (
                  <svg
                    className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5"
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

        {/* Languages */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Languages Spoken</h2>
          <div className="flex flex-wrap gap-2">
            {[...languageOptions, ...customLanguages].map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  selectedLanguages.includes(l)
                    ? 'bg-ink text-cream shadow-sm'
                    : 'bg-white text-ink-2 hover:bg-cream-2'
                }`}
                style={
                  selectedLanguages.includes(l)
                    ? undefined
                    : { border: '1px solid rgba(14,14,12,0.1)' }
                }
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
                className="w-48 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
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
                className="rounded-lg px-4 py-2.5 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Travel radius */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Travel Radius</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            How far from your postcode are you willing to travel?
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
              className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
              style={{ border: '1px solid rgba(14,14,12,0.1)' }}
            />
            <span className="font-jost text-sm font-light text-ink-2">miles</span>
          </div>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
            Customers within this radius will be able to find you
          </p>
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
            className="rounded-full px-8 py-2.5 bg-gold text-ink font-jost text-[13px] font-light shadow-sm hover:bg-gold/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
