'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
export type Actor={id:string;name:string;email:string;roleName:string;roleId:string;agencyId:string;isSuperAdmin:boolean;isClient:boolean;permissions:string[];clientIds:string[];mustChangePassword:boolean;avatarUrl?:string|null;avatarColor?:string};
export const csrf=()=>typeof document==='undefined'?'':decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('agency_csrf='))?.split('=')[1]||'');
export async function api<T=any>(url:string,options:RequestInit={}) : Promise<T> {
 const res=await fetch('/api'+url,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Agency-Request':'1','X-CSRF-Token':csrf(),...options.headers}});
 const data=await res.json().catch(()=>({message:'The server could not be reached.'}));
 if(!res.ok){if(res.status===401&&url!=='/auth/login')window.dispatchEvent(new Event('agency-session-expired'));throw new Error(data.message||'The request failed.');}
 return data;
}
type Context={actor:Actor;refresh:()=>void;epoch:number;can:(p:string)=>boolean;logout:()=>void;openForm:(kind:string,initial?:any)=>void};
export const AppContext=createContext<Context>(null!);
export const useApp=()=>useContext(AppContext);
export function useResource<T=any>(url:string|null) {
 const {epoch}=useApp();const [data,setData]=useState<T>();const [error,setError]=useState('');const [loading,setLoading]=useState(true);const last=useRef<string|null>(null);
 useEffect(()=>{let active=true;if(!url){setLoading(false);setData(undefined);return;}if(last.current!==url){setData(undefined);setLoading(true);last.current=url;}setError('');
 api<T>(url).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[url,epoch]);
 return {data,error,loading};
}
export function useMutation(){
 const {refresh}=useApp();const [pending,setPending]=useState(false);
 const mutate=useCallback(async(url:string,data?:unknown,method='POST',message='Saved')=>{
  setPending(true);try{const result=await api(url,{method,body:data===undefined?undefined:JSON.stringify(data)});refresh();if(message)toast.success(message);return result;}catch(e:any){const msg=e?.message||'The request could not be completed.';toast.error(msg);throw new Error(msg);}finally{setPending(false);}
 },[refresh]);
 return {mutate,pending};
}
