'use client';

import React, { useState, useEffect } from 'react';
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
  Gift,
  CreditCard,
  Package,
} from 'lucide-react';
import MadOMediaLogo from './MadOMediaLogo';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';

export const COMMERCIAL_RANGES = [
  '₹0 - ₹5K',
  '₹5K - ₹10K',
  '₹10K - ₹15K',
  '₹15K - ₹20K',
  '₹20K - ₹25K',
  '₹25K - ₹30K',
  '₹30K - ₹35K',
  '₹35K - ₹40K',
  '₹40K - ₹45K',
  '₹45K - ₹50K',
  '₹50K+',
];

export const GENRES = [
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

export function formatInstagramUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('instagram.com/') || trimmed.startsWith('www.instagram.com/')) {
    return `https://${trimmed}`;
  }
  const clean = trimmed.replace(/^@/, '').replace(/\/$/, '');
  return `https://www.instagram.com/${clean}`;
}

interface InfluencerPublicIntakeFormProps {
  initialMode?: 'commercial' | 'barter';
}

export function InfluencerPublicIntakeForm({ initialMode }: InfluencerPublicIntakeFormProps) {
  const { isDark } = useTheme();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [collabType, setCollabType] = useState<'commercial' | 'barter'>('commercial');

  useEffect(() => {
    if (initialMode) {
      setCollabType(initialMode);
      return;
    }
    if (typeof window !== 'undefined') {
      const search = window.location.search.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (
        search.includes('barter') ||
        path.includes('barter') ||
        path === '/influencer-barter' ||
        path === '/barter-intake'
      ) {
        setCollabType('barter');
      } else {
        setCollabType('commercial');
      }
    }
  }, [initialMode]);

  const [form, setForm] = useState({
    name: '',
    instaUrl: '',
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
    if (!form.name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!form.instaUrl.trim()) {
      toast.error('Please enter your Instagram Profile URL');
      return;
    }

    if (collabType === 'barter' && !form.address.trim()) {
      toast.error('Please enter your Courier / PR Shipping Address for sample deliveries');
      return;
    }

    setSubmitting(true);
    try {
      const formattedUrl = formatInstagramUrl(form.instaUrl);
      const isBarter = collabType === 'barter';

      const payload = {
        name: form.name.trim(),
        instaId: formattedUrl,
        instaUrl: formattedUrl,
        phone: form.phone.trim(),
        email: form.email.trim(),
        genre: form.genre,
        age: form.age.trim(),
        gender: form.gender,
        city: form.city.trim(),
        address: form.address.trim(),
        followers: form.followers.trim(),
        brand: form.brand.trim() || 'General',
        reel: isBarter ? 'Barter' : form.reel.trim(),
        story: isBarter ? 'Barter' : form.story.trim(),
        collaborationType: isBarter ? 'Barter' : 'Commercial',
        isBarter,
        status: isBarter ? 'Barter Collab' : 'New Intake',
      };

      const res = await fetch('/api/influencers/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to submit profile');
      }

      setSubmitted(true);
      toast.success(
        isBarter
          ? 'Your Barter Collaboration profile was submitted successfully!'
          : 'Your Creator Profile & Commercials were submitted successfully!'
      );
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const isBarter = collabType === 'barter';
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#090a0f] text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl border text-center shadow-2xl relative overflow-hidden ${isDark ? 'bg-[#12151d] border-zinc-800' : 'bg-white border-stone-200'}`}>
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className={`h-16 w-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isBarter ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
            {isBarter ? <Gift size={36} /> : <CheckCircle2 size={36} />}
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">
            {isBarter ? 'Barter Collaboration Submitted!' : 'Profile & Rates Submitted!'}
          </h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Thank you, <strong className="text-foreground">{form.name}</strong>! Your creator profile{' '}
            {isBarter ? 'and PR shipping address have' : ', commercial rates, and shipping details have'} been sent directly to the Mad O Media talent roster.
          </p>

          <div className={`p-4 rounded-xl border mb-6 text-left text-xs space-y-2 ${isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-stone-50 border-stone-200'}`}>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Instagram:</span>
              <a
                href={formatInstagramUrl(form.instaUrl)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-sky-400 hover:underline max-w-[220px] truncate"
              >
                {formatInstagramUrl(form.instaUrl)}
              </a>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Type:</span>
              <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${isBarter ? 'bg-amber-500/15 text-amber-400' : 'bg-pink-500/15 text-pink-400'}`}>
                {isBarter ? '100% Barter / Gifting' : 'Paid Commercial Campaign'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Brand / Campaign:</span>
              <span className="font-semibold text-pink-500">{form.brand || 'General'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Followers:</span>
              <span className="font-semibold">{form.followers || 'N/A'}</span>
            </div>
            {!isBarter && (
              <div className="flex justify-between items-center border-t pt-1.5 border-zinc-800/50">
                <span className="text-zinc-500">Commercials:</span>
                <span className="font-semibold text-emerald-400">
                  Reel: {form.reel || 'N/A'} • Story: {form.story || 'N/A'}
                </span>
              </div>
            )}
            {isBarter && form.address && (
              <div className="border-t pt-1.5 border-zinc-800/50 text-[11px] text-zinc-400 flex items-center gap-1">
                <Package size={12} className="text-amber-500 shrink-0" />
                <span>PR samples will be shipped to your registered address.</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setSubmitted(false);
              setForm({
                name: '',
                instaUrl: '',
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

  const isBarter = collabType === 'barter';

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 flex flex-col items-center justify-center ${isDark ? 'bg-[#090a0f] text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
      {/* Background ambient glow */}
      <div
        className={`fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b ${
          isBarter ? 'from-amber-500/10 via-orange-500/5' : 'from-pink-500/10 via-purple-500/5'
        } to-transparent blur-3xl pointer-events-none -z-10 transition-colors duration-500`}
      />

      {/* Header with Agency branding */}
      <div className="max-w-xl w-full text-center mb-6">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border mb-3 transition-colors ${
            isBarter
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
          }`}
        >
          {isBarter ? <Gift size={13} /> : <Sparkles size={13} />}
          <span>{isBarter ? 'Creator Barter & PR Gifting Collaboration' : 'Creator Network & Talent Onboarding'}</span>
        </div>
        <div className="flex justify-center mb-2">
          <MadOMediaLogo size="md" theme={isDark ? 'dark' : 'light'} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
          {isBarter ? 'Barter Collaboration Onboarding' : 'Influencer & Creator Onboarding'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md mx-auto">
          {isBarter
            ? 'Join our creator gifting roster. Receive complimentary brand products & PR packages in exchange for organic social content. (No commercial rates required)'
            : 'Share your profile, audience reach, and commercial rate ranges to collaborate on upcoming agency brand campaigns.'}
        </p>
      </div>

      {/* The Intake Form Card */}
      <div className={`max-w-xl w-full rounded-2xl border p-5 sm:p-7 shadow-xl backdrop-blur-xs relative ${isDark ? 'bg-[#12151d]/90 border-zinc-800/90' : 'bg-white border-stone-200'}`}>
        {/* Form Mode Switcher (Commercial vs Barter) */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => setCollabType('commercial')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              collabType === 'commercial'
                ? isDark
                  ? 'bg-zinc-800 text-pink-400 shadow-xs border border-pink-500/30'
                  : 'bg-white text-pink-700 shadow-xs border border-pink-200'
                : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
            }`}
          >
            <CreditCard size={14} />
            <span>Paid Campaign (Commercials)</span>
          </button>

          <button
            type="button"
            onClick={() => setCollabType('barter')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              collabType === 'barter'
                ? isDark
                  ? 'bg-zinc-800 text-amber-400 shadow-xs border border-amber-500/30'
                  : 'bg-white text-amber-700 shadow-xs border border-amber-200'
                : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
            }`}
          >
            <Gift size={14} />
            <span>Barter Collaboration</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section: Basic Details */}
          <div className={`border-b pb-3 mb-2 ${isDark ? 'border-zinc-800/60' : 'border-stone-200'}`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isBarter ? 'text-amber-500' : 'text-pink-500'}`}>
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
                  isDark
                    ? `bg-zinc-900/80 border-zinc-800 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                    : `bg-stone-50 border-stone-200 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Instagram Profile URL <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-zinc-400">
                  <Instagram size={14} className={isBarter ? 'text-amber-500' : 'text-pink-500'} />
                </span>
                <input
                  type="url"
                  name="instaUrl"
                  required
                  placeholder="https://www.instagram.com/yourhandle"
                  value={form.instaUrl}
                  onChange={handleChange}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                    isDark
                      ? `bg-zinc-900/80 border-zinc-800 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'} text-sky-400 font-medium placeholder:text-zinc-500`
                      : `bg-stone-50 border-stone-200 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'} text-sky-600 font-medium placeholder:text-stone-400`
                  }`}
                />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Enter your complete profile link (e.g. https://www.instagram.com/username)
              </span>
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
                  isDark
                    ? `bg-zinc-900/80 border-zinc-800 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                    : `bg-stone-50 border-stone-200 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
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
                  isDark
                    ? `bg-zinc-900/80 border-zinc-800 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                    : `bg-stone-50 border-stone-200 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
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
            <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isBarter ? 'text-amber-500' : 'text-pink-500'}`}>
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
                  isDark
                    ? isBarter
                      ? 'bg-zinc-900/80 border-zinc-800 text-amber-400'
                      : 'bg-zinc-900/80 border-zinc-800 text-pink-400'
                    : isBarter
                    ? 'bg-stone-50 border-stone-200 text-amber-600'
                    : 'bg-stone-50 border-stone-200 text-pink-600'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 flex items-center justify-between">
              <span>
                Courier / PR Shipping Address {isBarter && <span className="text-red-500">*</span>}
              </span>
              <span className={`text-[10px] font-normal ${isBarter ? 'text-amber-500 font-semibold' : 'text-zinc-500'}`}>
                {isBarter ? 'Required for shipping brand samples & gifting products' : '(for brand samples & gifting)'}
              </span>
            </label>
            <textarea
              name="address"
              required={isBarter}
              rows={2}
              placeholder="Full mailing address with pincode / postal code"
              value={form.address}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden resize-none ${
                isDark
                  ? `bg-zinc-900/80 border-zinc-800 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                  : `bg-stone-50 border-stone-200 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Targeted Brand / Campaign</label>
            <input
              type="text"
              name="brand"
              placeholder="e.g. Zara, Nike, Willow & Root (or leave blank for General)"
              value={form.brand}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden transition-all ${
                isDark
                  ? `bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
                  : `bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 ${isBarter ? 'focus:border-amber-500' : 'focus:border-pink-500'}`
              }`}
            />
          </div>

          {/* Conditional Section: Commercial Rates (Only for Paid Campaigns) vs Barter Agreement */}
          {!isBarter ? (
            <>
              <div className={`border-b pb-3 mb-2 pt-2 ${isDark ? 'border-zinc-800/60' : 'border-stone-200'}`}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
                  <Building2 size={14} /> Brand & Commercial Rates
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Commercials: Reel Rate <span className="text-pink-500 font-normal">(Range)</span>
                  </label>
                  <select
                    name="reel"
                    value={form.reel}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden font-medium transition-all ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 text-emerald-400 focus:border-pink-500'
                        : 'bg-stone-50 border-stone-200 text-emerald-700 focus:border-pink-500'
                    }`}
                  >
                    <option value="">Select Reel Commercial Range</option>
                    {COMMERCIAL_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Commercials: Story Rate <span className="text-pink-500 font-normal">(Range)</span>
                  </label>
                  <select
                    name="story"
                    value={form.story}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-hidden font-medium transition-all ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 text-emerald-400 focus:border-pink-500'
                        : 'bg-stone-50 border-stone-200 text-emerald-700 focus:border-pink-500'
                    }`}
                  >
                    <option value="">Select Story Commercial Range</option>
                    {COMMERCIAL_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 my-2 ${
                isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <Gift size={20} className="shrink-0 text-amber-500 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="font-bold block">100% Barter Collaboration (No Commercials Required)</strong>
                <p className="leading-relaxed opacity-90">
                  This collaboration is product-based. The brand sends complimentary full-size products / PR samples to your shipping address in exchange for authentic reels, stories, or posts. No commercial fees apply.
                </p>
              </div>
            </div>
          )}

          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                isBarter
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25'
                  : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-pink-600/25'
              }`}
            >
              {submitting ? (
                <span>Submitting to Agency OS...</span>
              ) : isBarter ? (
                <>
                  <Gift size={15} />
                  <span>Submit Barter Collaboration Profile</span>
                </>
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

export function InfluencerBarterIntakeForm() {
  return <InfluencerPublicIntakeForm initialMode="barter" />;
}
