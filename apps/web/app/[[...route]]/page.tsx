import { Suspense } from 'react';
import { AgencyApp } from '@/components/agency-app';
export default function Page(){return <Suspense fallback={<div style={{padding:48}}>Opening Agency OS…</div>}><AgencyApp/></Suspense>;}

