'use client';
import { useState, useMemo, useCallback } from 'react';
import {
  CalendarCheck,
  MapPin,
  Clock,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  UserCheck,
  FileSpreadsheet,
  Calendar,
  Filter,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Laptop,
  Check,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { api, useApp, useResource } from '@/lib/api';
import { Avatar, Loading, Empty, Modal } from './shared';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  agencyId: string;
  userId: string;
  date: string;
  checkInAt: string;
  checkOutAt?: string | null;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY';
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  notes?: string | null;
  outLatitude?: number | null;
  outLongitude?: number | null;
  outAddress?: string | null;
  workingHours: string;
  formattedCheckIn: string;
  formattedCheckOut: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    role: { id: string; name: string; systemKey?: string };
  };
}

export function AttendanceView() {
  const { actor, refresh } = useApp();
  const isAdminOrSuperAdmin = actor.isSuperAdmin || actor.roleName === 'Super Admin' || actor.roleName === 'Admin';

  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showOlderOnly, setShowOlderOnly] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [showFlushModal, setShowFlushModal] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // Queries
  const { data: todayData, loading: loadingToday } = useResource('/attendance/today');
  const { data: archiveStatus } = useResource(isAdminOrSuperAdmin ? '/attendance/archive-status' : null);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilter) params.set('from', dateFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (showOlderOnly) params.set('olderThan90Days', 'true');
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [dateFilter, statusFilter, showOlderOnly]);

  const { data: records, loading: loadingList } = useResource<AttendanceRecord[]>(`/attendance/list${listQuery}`);

  // Browser Geolocation Helper
  const getLiveLocation = (): Promise<{ lat: number; lng: number; acc: number; address: string }> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
            if (res.ok) {
              const data = await res.json();
              const parts = [
                data.address?.suburb || data.address?.neighbourhood || data.address?.road,
                data.address?.city || data.address?.town || data.address?.district,
                data.address?.state
              ].filter(Boolean);
              if (parts.length > 0) address = parts.join(', ');
              else if (data.display_name) address = data.display_name.split(',').slice(0, 3).join(', ');
            }
          } catch {}
          resolve({ lat, lng, acc, address });
        },
        (err) => {
          let msg = 'Unable to retrieve location.';
          if (err.code === 1) msg = 'Location access was denied. Please allow location permissions in your browser to geotag attendance.';
          else if (err.code === 2) msg = 'Location position unavailable. Please ensure GPS/WiFi is enabled.';
          else if (err.code === 3) msg = 'Location request timed out. Please try again.';
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      toast.info('Detecting live geotagged location...', { duration: 3000 });
      const loc = await getLiveLocation();
      await api('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          latitude: loc.lat,
          longitude: loc.lng,
          accuracy: loc.acc,
          address: loc.address,
          deviceInfo: `${navigator.platform || 'Desktop'} · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`
        })
      });
      toast.success('Attendance marked successfully!', {
        description: `Checked in at ${loc.address}`
      });
      refresh();
    } catch (err: any) {
      toast.error('Check-in failed', { description: err.message || 'Could not record attendance.' });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      let loc: any = null;
      try {
        loc = await getLiveLocation();
      } catch {}
      await api('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          latitude: loc?.lat,
          longitude: loc?.lng,
          address: loc?.address
        })
      });
      toast.success('Checked out successfully!', {
        description: 'Working hours calculated and shift saved.'
      });
      refresh();
    } catch (err: any) {
      toast.error('Check-out failed', { description: err.message || 'Could not record checkout.' });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleExportExcel = (range = 'all') => {
    const url = `/api/attendance/export?range=${range}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', range === 'olderThan90Days' ? 'Attendance_Archive_90Days.xlsx' : 'Attendance_Report.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (range === 'olderThan90Days') {
      setHasDownloaded(true);
    }
    toast.success('Generating Excel sheet...', {
      description: 'Your verified attendance spreadsheet is downloading.'
    });
  };

  const handleFlushArchive = async () => {
    try {
      setFlushing(true);
      const res: any = await api('/attendance/flush-archive', { method: 'POST' });
      toast.success('Archive Flushed Successfully', { description: res.message });
      setShowFlushModal(false);
      setShowOlderOnly(false);
      refresh();
    } catch (err: any) {
      toast.error('Flush failed', { description: err.message || 'Could not flush archive.' });
    } finally {
      setFlushing(false);
    }
  };

  // Stats calculation
  const totalRecords = records?.length || 0;
  const presentCount = records?.filter((r) => r.status === 'PRESENT').length || 0;
  const lateCount = records?.filter((r) => r.status === 'LATE').length || 0;
  const halfDayCount = records?.filter((r) => r.status === 'HALF_DAY').length || 0;

  return (
    <div className="attendance-view space-y-6 animate-fade-in max-w-7xl mx-auto px-1 sm:px-2">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs tracking-wider uppercase">
            <ShieldCheck size={14} />
            Workforce Attendance & Geotagging
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-100 mt-1">
            Attendance Log
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-0.5">
            {isAdminOrSuperAdmin
              ? 'Real-time employee attendance tracking with verified live GPS geotagging & Excel exports.'
              : 'Mark your daily attendance with live geotagging and view your work history.'}
          </p>
        </div>

        {/* Excel Export Quick Trigger */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => handleExportExcel('all')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <FileSpreadsheet size={15} />
            <span>Download Excel Sheet</span>
          </button>
        </div>
      </div>

      {/* SUPER ADMIN 3-MONTH ARCHIVE ALERT BANNER */}
      {isAdminOrSuperAdmin && archiveStatus?.hasArchive && (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-500/10 p-4 sm:p-5 shadow-xs dark:border-amber-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-200">
                  3 Months of Employee Attendance Data is Stored
                </h3>
                <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/80 mt-1">
                  There are <strong>{archiveStatus.olderThan90DaysCount} records</strong> older than 90 days (prior to {archiveStatus.cutoffDate}).
                  Please download the complete Excel backup before flushing the data to keep database performance optimal.
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExportExcel('olderThan90Days')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-zinc-900 text-stone-800 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                <Download size={14} className="text-amber-500" />
                <span>1. Download 3-Month Archive (.xlsx)</span>
              </button>

              {actor.isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowFlushModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs"
                >
                  <Trash2 size={14} />
                  <span>2. Flush 3-Month Data</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S LIVE ATTENDANCE CARD (For employees) */}
      {!todayData?.isExempt && (
        <div
          className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 transition-all ${
            !todayData?.checkedIn
              ? 'border-2 border-emerald-500/60 dark:border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.04] to-teal-500/10 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/40 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/10'
              : !todayData?.checkedOut
              ? 'border-2 border-amber-500/50 dark:border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/[0.03] to-orange-500/10 dark:from-amber-950/40 dark:via-zinc-900 dark:to-orange-950/40 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/10'
              : 'border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  todayData?.checkedIn
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                }`}
              >
                {todayData?.checkedIn ? <CheckCircle2 size={26} /> : <MapPin size={26} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                    Today: {todayData?.today}
                  </span>
                  {!todayData?.checkedIn ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Action Required
                    </span>
                  ) : todayData?.attendance?.status ? (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        todayData.attendance.status === 'PRESENT'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                          : todayData.attendance.status === 'LATE'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                          : 'bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500/30'
                      }`}
                    >
                      {todayData.attendance.status === 'HALF_DAY' ? 'HALF DAY' : todayData.attendance.status}
                    </span>
                  ) : null}
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-zinc-100 mt-1">
                  {!todayData?.checkedIn
                    ? 'You have not marked attendance yet today'
                    : !todayData?.checkedOut
                    ? 'Attendance Marked · Shift In Progress'
                    : 'Shift Completed · Checked Out for the Day'}
                </h2>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1.5">
                  {todayData?.attendance?.checkInAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-stone-400 shrink-0" />
                      In: <strong>{new Date(todayData.attendance.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  )}
                  {todayData?.attendance?.checkOutAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-stone-400 shrink-0" />
                      Out: <strong>{new Date(todayData.attendance.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  )}
                  {todayData?.attendance?.address && (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium truncate max-w-sm sm:max-w-md">
                      <MapPin size={13} className="shrink-0" />
                      <span className="truncate">{todayData.attendance.address}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Action Buttons (Prominently Highlighted) */}
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              {!todayData?.checkedIn ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="btn-emerald relative overflow-hidden flex items-center justify-center gap-2.5 w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-lg shadow-emerald-600/35 hover:shadow-xl hover:shadow-emerald-500/50 ring-2 ring-emerald-400/80 hover:ring-white transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                  }}
                >
                  {checkingIn ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white shrink-0" />
                      <span className="tracking-wide">Geotagging & Checking In...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                      </span>
                      <Navigation size={18} className="text-white transform group-hover:rotate-45 transition-transform shrink-0" />
                      <span className="tracking-wide font-extrabold drop-shadow-sm whitespace-nowrap text-white">
                        Mark Today's Attendance (Check In)
                      </span>
                    </>
                  )}
                </button>
              ) : !todayData?.checkedOut ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  className="btn-amber relative overflow-hidden flex items-center justify-center gap-2.5 w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] shadow-lg shadow-orange-500/35 hover:shadow-xl hover:shadow-orange-500/50 ring-2 ring-amber-400/80 hover:ring-white transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #f97316 50%, #ea580c 100%)',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                  }}
                >
                  {checkingOut ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white shrink-0" />
                      <span className="tracking-wide">Checking Out...</span>
                    </>
                  ) : (
                    <>
                      <Clock size={18} className="text-white transform group-hover:scale-110 transition-transform shrink-0" />
                      <span className="tracking-wide font-extrabold drop-shadow-sm whitespace-nowrap text-white">
                        Check Out for Today
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold text-sm sm:text-base shadow-xs">
                  <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">Shift Completed · Attendance Recorded</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN EXEMPTION NOTICE (When viewed by Admin / Super Admin) */}
      {isAdminOrSuperAdmin && (
        <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs sm:text-sm text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck size={18} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="leading-relaxed">
              <strong>Admin Exemption Policy:</strong> Admins and Super Admins are exempt from daily attendance check-ins. You have complete oversight of all employee geotagged check-ins and archive flushing below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleExportExcel('all')}
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 hover:text-indigo-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Download size={14} className="shrink-0" />
            <span className="whitespace-nowrap">Export All</span>
          </button>
        </div>
      )}

      {/* FILTER & STATS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-2xs">
        {/* Quick summary badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-medium">
            Total Logs: <strong>{totalRecords}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
            Present: <strong>{presentCount}</strong>
          </span>
          {lateCount > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
              Late Check-ins: <strong>{lateCount}</strong>
            </span>
          )}
          {halfDayCount > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 font-medium">
              Half Day: <strong>{halfDayCount}</strong>
            </span>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-stone-800 dark:text-zinc-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
          </select>

          {/* Date Picker */}
          <div className="flex items-center gap-1 text-xs bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-stone-800 dark:text-zinc-200">
            <Calendar size={13} className="text-stone-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent border-0 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-stone-400 hover:text-stone-600 text-[10px] ml-1 font-bold"
                title="Clear date"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle Older than 90 days */}
          {isAdminOrSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowOlderOnly(!showOlderOnly)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                showOlderOnly
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40'
                  : 'bg-stone-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 border border-stone-200 dark:border-zinc-700'
              }`}
            >
              Older than 90 Days ({archiveStatus?.olderThan90DaysCount || 0})
            </button>
          )}

          <button
            onClick={() => refresh()}
            title="Refresh logs"
            className="p-1.5 rounded-lg bg-stone-50 dark:bg-zinc-800 text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ATTENDANCE RECORDS TABLE */}
      <div className="rounded-2xl border border-stone-200/80 bg-white dark:bg-zinc-900/80 shadow-xs overflow-hidden dark:border-zinc-800">
        {loadingList ? (
          <div className="p-12 text-center">
            <Loading />
          </div>
        ) : !records || records.length === 0 ? (
          <div className="p-12 text-center">
            <Empty
              title="No attendance records found"
              body={
                showOlderOnly
                  ? 'No records older than 90 days. Your archive is clean.'
                  : 'No attendance marked for the selected filter.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-800 text-stone-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Check-In</th>
                  <th className="py-3.5 px-4">Check-Out</th>
                  <th className="py-3.5 px-4">Hours</th>
                  <th className="py-3.5 px-4">Geotag Location</th>
                  <th className="py-3.5 px-4">IP / Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/80 text-stone-800 dark:text-zinc-200">
                {records.map((r) => {
                  const mapUrl = r.latitude && r.longitude
                    ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}`
                    : null;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Employee Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={r.user.name}
                            color={r.user.avatarColor || '#0284c7'}
                            size="small"
                            src={r.user.avatarUrl}
                          />
                          <div>
                            <div className="font-semibold text-stone-900 dark:text-zinc-100">
                              {r.user.name}
                            </div>
                            <div className="text-[11px] text-stone-400 dark:text-zinc-500">
                              {r.user.role?.name || 'Employee'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                        {r.date}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase ${
                            r.status === 'PRESENT'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : r.status === 'LATE'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {r.status === 'HALF_DAY' ? 'HALF DAY' : r.status}
                        </span>
                      </td>

                      {/* Check-In Time */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-stone-700 dark:text-zinc-300">
                        {r.formattedCheckIn}
                      </td>

                      {/* Check-Out Time */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-stone-700 dark:text-zinc-300">
                        {r.formattedCheckOut}
                      </td>

                      {/* Working Hours */}
                      <td className="py-3 px-4 font-medium whitespace-nowrap text-stone-600 dark:text-zinc-300">
                        {r.workingHours}
                      </td>

                      {/* Geotag Location */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <span className="font-medium text-stone-800 dark:text-zinc-200">
                              {r.address || 'Location recorded'}
                            </span>
                            {mapUrl && (
                              <a
                                href={mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-mono"
                              >
                                {r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)} ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* IP & Device */}
                      <td className="py-3 px-4 max-w-[180px] text-stone-500 dark:text-zinc-400 text-[11px]">
                        <div className="truncate font-mono">{r.ipAddress || '-'}</div>
                        <div className="truncate text-[10px] text-stone-400">
                          {r.deviceInfo?.split(') ')[0]?.replace('Mozilla/5.0 (', '') || r.deviceInfo || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUPER ADMIN CONFIRMATION FLUSH MODAL */}
      <Modal
        open={showFlushModal}
        onOpenChange={(v) => !v && setShowFlushModal(false)}
        title="Flush 3-Month Attendance Archive"
        description="Permanently delete historical records older than 90 days from the database."
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle size={16} /> Important Notice
            </p>
            <p>
              This will permanently delete <strong>{archiveStatus?.olderThan90DaysCount || 0} records</strong> dated prior to {archiveStatus?.cutoffDate}.
              This action cannot be undone.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700 text-xs">
            <div className="font-medium text-stone-700 dark:text-zinc-300 mb-2">Step 1: Save Backup</div>
            <button
              type="button"
              onClick={() => handleExportExcel('olderThan90Days')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors"
            >
              <FileSpreadsheet size={14} />
              <span>Download 3-Month Backup (.xlsx)</span>
            </button>
            {hasDownloaded && (
              <p className="text-emerald-600 dark:text-emerald-400 text-[11px] mt-1.5 flex items-center gap-1 font-semibold">
                <Check size={12} /> Excel backup downloaded
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFlushModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={flushing}
              onClick={handleFlushArchive}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white transition-colors"
            >
              {flushing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Flushing Records...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>Confirm & Flush Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
