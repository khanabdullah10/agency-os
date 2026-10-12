'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Instagram,
  Phone,
  Mail,
  MapPin,
  Users,
  Video,
  DollarSign,
  Heart,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import MadOMediaLogo from './MadOMediaLogo';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';

const GENRES = [
  'Fashion & Style',
  'Beauty & Skincare',
  'Fitness & Wellness',
  'Food & Beverage',
  'Travel & Hospitality',
  'Tech & Gadgets',
  'Lifestyle & Vlogging',
  'Comedy & Entertainment',
  'Business & Finance',
  'Art & Design',
  'Parenting & Family',
  'Other',
];

export function InfluencerPublicIntakeForm() {
  const { isDark } = useTheme();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    instaId: '',
    phone: '',
    email: '',
    genre: 'Fashion & Style',
    age: '',
    gender: 'Female',
    city: '',
    address: '',
    followers: '',
    brand: '',
    reel: '',
    story: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.instaId) {
      toast.error('Please enter your Name and Instagram Handle');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        instaId: form.instaId.trim().startsWith('@') ? form.instaId.trim() : `@${form.instaId.trim()}`,
        phone: form.phone.trim(),
        email: form.email.trim(),
        genre: form.genre,
        age: form.age.trim(),
        gender: form.gender,
        city: form.city.trim(),
        address: form.address.trim(),
        followers: form.followers.trim(),
        brand: form.brand.trim() || 'General',
        reel: form.reel.trim(),
        story: form.story.trim(),
      };

      const res = await fetch('/api/influencers/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to submit form');
      }

      setSubmitted(true);
      toast.success('Your creator profile was submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#090a0f] text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl border text-center shadow-2xl relative overflow-hidden ${isDark ? 'bg-[#12151d] border-zinc-800' : 'bg-white border-stone-200'}`}>
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">Profile Submitted!</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Thank you, <strong className="text-foreground">{form.name}</strong>! Your creator profile, commercial rates, and shipping details have been sent directly to the Mad O Media talent team.
          </p>

          <div className={`p-4 rounded-xl border mb-6 text-left text-xs space-y-1.5 ${isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-stone-50 border-stone-200'}`}>
            <div className="flex justify-between">
              <span className="text-zinc-500">Instagram:</span>
              <span className="font-semibold text-sky-400">{form.instaId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Brand / Campaign:</span>
              <span className="font-semibold text-pink-500">{form.brand || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Followers:</span>
              <span className="font-semibold">{form.followers || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Commercials:</span>
              <span className="font-semibold">Reel: {form.reel || 'N/A'} • Story: {form.story || 'N/A'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setSubmitted(false);
              setForm({
                name: '',
                instaId: '',
                phone: '',
                email: '',
                genre: 'Fashion & Style',
                age: '',
                gender: 'Female',
                city: '',
                address: '',
                followers: '',
                brand: '',
                reel: '',
                story: '',
              });
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Submit Another Creator Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 flex flex-col items-center justify-center ${isDark ? 'bg-[#090a0f] text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
      {/* Background ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-pink-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header with Agency branding */}
      <div className="max-w-xl w-full text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border mb-3 bg-pink-500/10 text-pink-400 border-pink-500/20">
          <Sparkles size={13} />
          <span>Creator Network & Talent Onboarding</span>
        </div>
        <div className="flex justify-center mb-2">
          <MadOMediaLogo size="md" theme={isDark ? 'dark' : 'light'} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
          Influencer & Creator Onboarding
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md mx-auto">
          Share your profile, audience reach, and commercial rates to collaborate on upcoming agency brand campaigns.
        </p>
      </div>

      {/* The Intake Form Card */}
      <div className={`max-w-xl w-full rounded-2xl border p-5 sm:p-7 shadow-xl backdrop-blur-xs relative ${isDark ? 'bg-[#12151d]/90 border-zinc-800/90' : 'bg-white border-stone-200'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section: Basic Details */}
          <div className={`border-b pb-3 mb-2 ${isDark ? 'border-zinc-800/60' : 'border-stone-200'}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
              <Users size={14} /> Creator Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Full name"
                value={form.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 focus:border-pink-500' : 'bg-stone-50 border-stone-200 focus:border-pink-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Instagram Handle <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-zinc-400 text-xs">@</span>
                <input
                  type="text"
                  name="instaId"
                  required
                  placeholder="username"
                  value={form.instaId.replace(/^@/, '')}
                  onChange={(e) => setForm((p) => ({ ...p, instaId: `@${e.target.value}` }))}
                  className={`w-full pl-6 pr-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                    isDark ? 'bg-zinc-900/80 border-zinc-800 focus:border-pink-500 text-sky-400 font-medium' : 'bg-stone-50 border-stone-200 focus:border-pink-500 text-sky-600 font-medium'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">
                Phone Number / WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="+91 98201 12345"
                value={form.phone}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 focus:border-pink-500' : 'bg-stone-50 border-stone-200 focus:border-pink-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="sarah@creators.co"
                value={form.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 focus:border-pink-500' : 'bg-stone-50 border-stone-200 focus:border-pink-500'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">Content Genre</label>
              <select
                name="genre"
                value={form.genre}
                onChange={handleChange}
                className={`w-full px-2.5 py-2 rounded-lg text-xs border outline-hidden ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-stone-50 border-stone-200'
                }`}
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Age</label>
              <input
                type="number"
                name="age"
                placeholder="24"
                value={form.age}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-stone-50 border-stone-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={`w-full px-2.5 py-2 rounded-lg text-xs border outline-hidden ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-stone-50 border-stone-200'
                }`}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Section: Location & Reach */}
          <div className={`border-b pb-3 mb-2 pt-2 ${isDark ? 'border-zinc-800/60' : 'border-stone-200'}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
              <MapPin size={14} /> Location & Follower Reach
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">City</label>
              <input
                type="text"
                name="city"
                placeholder="e.g. Mumbai, Delhi, Bengaluru"
                value={form.city}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-stone-50 border-stone-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Followers Count</label>
              <input
                type="text"
                name="followers"
                placeholder="e.g. 150K or 1.2M"
                value={form.followers}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden font-semibold ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 text-pink-400' : 'bg-stone-50 border-stone-200 text-pink-600'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Courier / PR Shipping Address <span className="text-zinc-500 font-normal">(for brand samples & gifting)</span>
            </label>
            <textarea
              name="address"
              rows={2}
              placeholder="Full mailing address with pincode / postal code"
              value={form.address}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden resize-none ${
                isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-stone-50 border-stone-200'
              }`}
            />
          </div>

          {/* Section: Campaign & Commercials */}
          <div className={`border-b pb-3 mb-2 pt-2 ${isDark ? 'border-zinc-800/60' : 'border-stone-200'}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
              <Building2 size={14} /> Brand & Commercial Rates
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Targeted Brand / Campaign</label>
            <input
              type="text"
              name="brand"
              placeholder="e.g. Zara, Nike, Willow & Root"
              value={form.brand}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                isDark
                  ? 'bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-pink-500'
                  : 'bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-pink-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">
                Commercials: Reel Rate
              </label>
              <input
                type="text"
                name="reel"
                placeholder="e.g. ₹35,000 or $500"
                value={form.reel}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden font-medium ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 text-emerald-400' : 'bg-stone-50 border-stone-200 text-emerald-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Commercials: Story Rate
              </label>
              <input
                type="text"
                name="story"
                placeholder="e.g. ₹12,000 or $150"
                value={form.story}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden font-medium ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800 text-emerald-400' : 'bg-stone-50 border-stone-200 text-emerald-600'
                }`}
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-[0.99] transition-all shadow-lg shadow-pink-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Submitting to Agency OS...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Creator Profile & Commercials</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 pt-1">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Directly ingested into Mad O Media • Agency OS Talent Database</span>
          </div>
        </form>
      </div>
    </div>
  );
}
