'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const SPECIALTY_OPTIONS = [
  'Standard Cleaning',
  'Deep Cleaning',
  'Eco-Friendly',
  'Pet-Friendly',
  'Kitchen Specialist',
  'Bathroom Specialist',
];

const LANGUAGE_OPTIONS = [
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

const UK_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|GIR\s?0AA)$/i;

interface ProfileData {
  name: string;
  email: string;
  bio: string;
  postcode: string | null;
  specialties: string[];
  languages: string[];
  hourlyRateRegular: number | null;
  onboardingComplete: boolean;
}

interface MissingFields {
  bio: boolean;
  postcode: boolean;
  specialties: boolean;
  languages: boolean;
  password: boolean;
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [missing, setMissing] = useState<MissingFields>({
    bio: false,
    postcode: false,
    specialties: false,
    languages: false,
    password: false,
  });

  const [bio, setBio] = useState('');
  const [postcode, setPostcode] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      .then((data: ProfileData | null) => {
        if (!data) return;
        if (data.onboardingComplete) {
          router.push('/cleaner');
          return;
        }
        setProfile(data);
        setBio(data.bio || '');
        setPostcode(data.postcode || '');
        setSpecialties(data.specialties || []);
        setLanguages(data.languages || []);
        setHourlyRate(String(data.hourlyRateRegular || 14));

        setMissing({
          bio: !data.bio,
          postcode: !data.postcode,
          specialties: data.specialties.length === 0,
          languages: !data.languages || data.languages.length === 0,
          password: true,
        });
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleSpecialty = useCallback((s: string) => {
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const toggleLanguage = useCallback((l: string) => {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!bio.trim()) e.bio = 'Please write a short bio';
    if (!postcode.trim()) e.postcode = 'Postcode is required';
    else if (!UK_POSTCODE_RE.test(postcode.trim())) e.postcode = 'Enter a valid UK postcode';
    if (specialties.length === 0) e.specialties = 'Select at least one specialty';
    if (languages.length === 0) e.languages = 'Select at least one language';

    const rate = Number(hourlyRate);
    if (!hourlyRate || rate < 14 || rate > 35) e.hourlyRate = 'Rate must be between £14 and £35';

    if (missing.password) {
      if (!password || password.length < 8) e.password = 'Password must be at least 8 characters';
      else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        bio: bio.trim(),
        postcode: postcode.trim(),
        specialties,
        languages,
        hourlyRateRegular: Number(hourlyRate),
      };
      if (missing.password && password) {
        body.password = password;
      }

      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrors({ form: data?.error || 'Something went wrong. Please try again.' });
        return;
      }

      router.push('/cleaner');
    } catch {
      setErrors({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-jost text-sm font-light text-ink-3">Loading...</p>
      </div>
    );
  }

  if (!profile) return null;

  const missingCount = Object.values(missing).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-lg px-5 py-12 md:py-20">
      <div className="text-center">
        <h1 className="font-cormorant text-3xl font-light text-ink">Complete Your Profile</h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2">
          Welcome back, {profile.name}. We need a few more details before you can access your
          dashboard.
        </p>
        <p className="mt-1 font-jost text-xs font-light text-ink-3">
          {missingCount} {missingCount === 1 ? 'section' : 'sections'} to complete
        </p>
      </div>

      {errors.form && (
        <div
          className="mt-6 bg-red-50 px-4 py-3 font-jost text-sm font-light text-red-700"
          style={{ border: '0.5px solid rgba(239,68,68,0.2)' }}
          role="alert"
        >
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-10 space-y-8">
        {/* Bio */}
        <div>
          <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            About You
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell clients about your experience and what makes you great..."
            className="mt-1 w-full resize-none px-3 py-2 font-jost text-sm font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          />
          <div className="mt-1 flex justify-between">
            <span>{errors.bio && <span className="text-xs text-red-600">{errors.bio}</span>}</span>
            <span className="text-xs text-ink-3">{bio.length}/500</span>
          </div>
        </div>

        {/* Postcode */}
        <div>
          <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Your Postcode
          </label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. SW1A 1AA"
            className="mt-1 w-full px-3 py-2 font-jost text-sm font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          />
          {errors.postcode && <p className="mt-1 text-xs text-red-600">{errors.postcode}</p>}
        </div>

        {/* Specialties */}
        <div>
          <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Specialties
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                className={`px-4 py-1.5 font-jost text-sm font-light transition ${
                  specialties.includes(s)
                    ? 'bg-ink text-cream'
                    : 'bg-cream-2 text-ink-2 hover:bg-cream-2/80'
                }`}
                style={
                  specialties.includes(s) ? undefined : { border: '0.5px solid rgba(14,14,12,0.1)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
          {errors.specialties && <p className="mt-1 text-xs text-red-600">{errors.specialties}</p>}
        </div>

        {/* Languages */}
        <div>
          <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Languages Spoken
          </label>
          <p className="mt-1 font-jost text-xs font-light text-ink-3">
            Select at least one language you speak
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLanguage(l)}
                className={`px-4 py-1.5 font-jost text-sm font-light transition ${
                  languages.includes(l)
                    ? 'bg-ink text-cream'
                    : 'bg-cream-2 text-ink-2 hover:bg-cream-2/80'
                }`}
                style={
                  languages.includes(l) ? undefined : { border: '0.5px solid rgba(14,14,12,0.1)' }
                }
              >
                {l}
              </button>
            ))}
          </div>
          {errors.languages && <p className="mt-1 text-xs text-red-600">{errors.languages}</p>}
        </div>

        {/* Hourly rate */}
        <div>
          <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Hourly Rate
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
              £
            </span>
            <input
              type="number"
              min={14}
              max={35}
              step={0.5}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full pl-7 pr-3 py-2 font-jost text-sm font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            />
          </div>
          <p className="mt-1 font-jost text-xs font-light text-ink-3">
            Between £14 and £35 per hour
          </p>
          {errors.hourlyRate && <p className="mt-1 text-xs text-red-600">{errors.hourlyRate}</p>}
        </div>

        {/* Password — only shown if user has no password */}
        {missing.password && (
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Set Your Password
            </label>
            <p className="mt-1 font-jost text-xs font-light text-ink-3">
              Create a password so you can log in to your account.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 font-jost text-sm font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>
              <div>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 font-jost text-sm font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink py-3.5 font-jost text-[11px] uppercase tracking-[0.15em] text-cream transition hover:bg-ink/90 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Complete Profile'}
        </button>
      </form>
    </div>
  );
}
