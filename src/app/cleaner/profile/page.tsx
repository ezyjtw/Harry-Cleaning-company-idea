"use client";

import { useState } from "react";

const specialtyOptions = [
  "Regular Cleaning",
  "Deep Cleaning",
  "End of Tenancy",
  "AirBnB / Short-Let",
  "Office Cleaning",
  "Move-In / Move-Out",
  "Post-Construction",
  "Carpet Cleaning",
  "Window Cleaning",
  "Oven Cleaning",
];

const languageOptions = [
  "English", "Spanish", "French", "Portuguese", "Polish", "Romanian",
  "Arabic", "Hindi", "Mandarin", "Tagalog", "Italian", "German",
];

export default function CleanerProfilePage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [bio, setBio] = useState(
    "Hi! I'm Sarah, a professional cleaner with over 5 years of experience. I take pride in delivering spotless results and always go the extra mile for my clients."
  );
  const [hourlyRate, setHourlyRate] = useState("25");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([
    "Regular Cleaning", "Deep Cleaning", "End of Tenancy",
  ]);
  const [postcodes, setPostcodes] = useState("SW1, SW3, SW7, W1, W8, W11");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English", "Portuguese"]);
  const [saved, setSaved] = useState(false);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setSaved(false);
  };

  const toggleLanguage = (l: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
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

  const handleSave = () => {
    // TODO: Save profile to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-500 mt-1">Update your public profile information</p>
      </div>

      <div className="space-y-6">
        {/* Photo upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Photo
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-2">JPG, PNG. Max 5MB. A clear headshot works best.</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About You</h2>
          <textarea
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder="Tell customers about yourself, your experience, and what makes you a great cleaner..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={4}
          />
          <p className="text-xs text-gray-400 mt-1">{bio.length}/500 characters</p>
        </div>

        {/* Hourly rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hourly Rate</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">£</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => { setHourlyRate(e.target.value); setSaved(false); }}
                min="10"
                max="100"
                className="w-32 rounded-lg border border-gray-300 pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500">per hour</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Average rate in your area: £22-£28/hr. Same-day bookings automatically apply a 1.5x rate.
          </p>
        </div>

        {/* Specialties */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Specialties</h2>
          <p className="text-sm text-gray-500 mb-3">Select the cleaning services you offer</p>
          <div className="flex flex-wrap gap-2">
            {specialtyOptions.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  selectedSpecialties.includes(s)
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {selectedSpecialties.includes(s) && (
                  <svg className="w-4 h-4 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Service areas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Areas</h2>
          <p className="text-sm text-gray-500 mb-3">Enter the postcodes you cover, separated by commas</p>
          <input
            type="text"
            value={postcodes}
            onChange={(e) => { setPostcodes(e.target.value); setSaved(false); }}
            placeholder="e.g. SW1, SW3, W1, EC1"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-2">Customers in these areas will be able to find you</p>
        </div>

        {/* Languages */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Languages Spoken</h2>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  selectedLanguages.includes(l)
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Profile saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
