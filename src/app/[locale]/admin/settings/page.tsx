'use client';

import { useState } from 'react';

interface ServiceType {
  id: string;
  name: string;
  basePrice: number;
  active: boolean;
}

interface PricingRule {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
}

interface ServiceArea {
  id: string;
  name: string;
  postcodes: string;
  active: boolean;
}

export default function AdminSettingsPage() {
  const [commissionRate, setCommissionRate] = useState('10');
  const [_sameDayMultiplier, _setSameDayMultiplier] = useState('1.3');
  const [saved, setSaved] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([
    { id: '1', name: 'Regular Clean', basePrice: 25, active: true },
    { id: '2', name: 'Deep Clean', basePrice: 35, active: true },
    { id: '3', name: 'End of Tenancy', basePrice: 40, active: true },
    { id: '4', name: 'AirBnB / Short-Let', basePrice: 30, active: true },
    { id: '5', name: 'Office Clean', basePrice: 30, active: true },
    { id: '6', name: 'Post-Construction', basePrice: 45, active: false },
  ]);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([
    { id: '1', name: 'Same-Day Booking', multiplier: 1.3, active: true },
    { id: '2', name: 'Weekend Premium', multiplier: 1.15, active: true },
    { id: '3', name: 'Bank Holiday Premium', multiplier: 1.3, active: true },
    { id: '4', name: 'Peak Hours (6-8 PM)', multiplier: 1.1, active: false },
  ]);

  const [areas, setAreas] = useState<ServiceArea[]>([
    {
      id: '1',
      name: 'Central London',
      postcodes: 'W1, WC1, WC2, EC1, EC2, EC3, EC4, SW1',
      active: true,
    },
    { id: '2', name: 'West London', postcodes: 'W2-W14, SW3, SW5, SW6, SW7, SW10', active: true },
    {
      id: '3',
      name: 'South London',
      postcodes: 'SE1-SE28, SW2, SW4, SW8, SW9, SW11-SW20',
      active: true,
    },
    { id: '4', name: 'North London', postcodes: 'N1-N22, NW1-NW11', active: true },
    { id: '5', name: 'East London', postcodes: 'E1-E20', active: true },
  ]);

  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  const toggleServiceType = (id: string) => {
    setServiceTypes((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    setSaved(false);
  };

  const togglePricingRule = (id: string) => {
    setPricingRules((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
    setSaved(false);
  };

  const toggleArea = (id: string) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
    setSaved(false);
  };

  const addServiceType = () => {
    if (!newServiceName.trim() || !newServicePrice) return;
    const newService: ServiceType = {
      id: Date.now().toString(),
      name: newServiceName,
      basePrice: Number(newServicePrice),
      active: true,
    };
    setServiceTypes((prev) => [...prev, newService]);
    setNewServiceName('');
    setNewServicePrice('');
    setSaved(false);
  };

  const removeServiceType = (id: string) => {
    setServiceTypes((prev) => prev.filter((s) => s.id !== id));
    setSaved(false);
  };

  const handleSave = () => {
    // TODO: Save to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 mt-1">Configure platform-wide settings and pricing</p>
      </div>

      <div className="space-y-6">
        {/* Commission rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Rate</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => {
                setCommissionRate(e.target.value);
                setSaved(false);
              }}
              min="0"
              max="50"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">% platform commission on each booking</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Current tiers: Standard (15%), Premium (10%), Elite (8%). This sets the default rate.
          </p>
        </div>

        {/* Service types */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Types</h2>
          <div className="space-y-3 mb-4">
            {serviceTypes.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleServiceType(service.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      service.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        service.active ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium ${service.active ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {service.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">£{service.basePrice}/hr base</span>
                  <button
                    onClick={() => removeServiceType(service.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Service name"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="£/hr"
              value={newServicePrice}
              onChange={(e) => setNewServicePrice(e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={addServiceType}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Pricing rules */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Rules</h2>
          <div className="space-y-3">
            {pricingRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePricingRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        rule.active ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium ${rule.active ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {rule.name}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{rule.multiplier}x multiplier</span>
              </div>
            ))}
          </div>
        </div>

        {/* Location / area management */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Areas</h2>
          <div className="space-y-3">
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleArea(area.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors mt-0.5 flex-shrink-0 ${
                      area.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        area.active ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <div>
                    <span
                      className={`text-sm font-medium ${area.active ? 'text-gray-900' : 'text-gray-400'}`}
                    >
                      {area.name}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{area.postcodes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Settings saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
