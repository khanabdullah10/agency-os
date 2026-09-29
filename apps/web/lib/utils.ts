import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs:ClassValue[]) { return twMerge(clsx(inputs)); }
export const label=(s:string='')=>s.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const initials=(s:string='')=>s.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
export const dateLabel=(d:string|Date,options?:Intl.DateTimeFormatOptions)=>new Date(d).toLocaleDateString('en-IN',options||{day:'numeric',month:'short'});
export const timeLabel=(d:string|Date)=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
export const code=(id:number)=>'CNT-'+String(id).padStart(4,'0');
export const inputDate=(d:Date|string)=>{const v=new Date(d);return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export const number=(n:number)=>Intl.NumberFormat('en-IN',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n||0);
export const statusTone=(s:string='')=>s.includes('CHANGES')||s==='OVERDUE'?'red':s.includes('REVIEW')?'amber':['READY_TO_PUBLISH','FINAL_CLIENT_APPROVED','PUBLISHED','COMPLETED','APPROVED'].includes(s)?'green':s.includes('SCRIPT')?'purple':['EDITING','IN_PROGRESS','SCHEDULED'].includes(s)?'blue':'neutral';
let audioContext: AudioContext | null = null;
export const playNotificationTone = () => {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/mado-notification.mp3?v=2');
    audio.volume = 0.9;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback: Web Audio API synthesized pleasant double-tone chime
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          if (!audioContext || audioContext.state === 'closed') {
            audioContext = new AudioCtx();
          }
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
          const now = audioContext.currentTime;
          const osc1 = audioContext.createOscillator();
          const gain1 = audioContext.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now); // D5
          osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
          gain1.gain.setValueAtTime(0.2, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(audioContext.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);
        } catch {}
      });
    }
  } catch {}
};
