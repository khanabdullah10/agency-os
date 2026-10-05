'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, FileText, Plus, Check, Send, Pencil, Film, FolderOpen, MessageSquare, ExternalLink, Copy, Link2, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, useResource, useMutation, api } from '@/lib/api';
import { code, dateLabel, timeLabel, label, inputDate } from '@/lib/utils';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge, Avatar, ClientMark, Empty, Loading, ErrorState, Field, FormFooter, Modal, Panel, External } from './shared';
import { ContentForm } from './forms';
const actionNames:Record<string,string>={START_SCRIPT:'Start script',SUBMIT_SCRIPT:'Submit script for review',APPROVE:'Approve',REQUEST_CHANGES:'Request changes',START_PRODUCTION:'Start production',SCHEDULE_SHOOT:'Confirm shoot schedule',COMPLETE_SHOOT:'Complete shoot',START_EDITING:'Start editing',SUBMIT_EDIT:'Submit edit for review',READY_TO_PUBLISH:'Mark ready to publish',SCHEDULE_PUBLISH:'Schedule publishing',PUBLISH:'Mark published',ANALYTICS:'Move to analytics',REPORTING:'Move to reporting'};
function actionsFor(c:any,actor:any,can:(p:string)=>boolean){
 const all:Record<string,string[]>={IDEA:c.requiresShoot?['START_SCRIPT']:['START_PRODUCTION'],PLANNING:c.requiresShoot?['START_SCRIPT']:['START_PRODUCTION'],SCRIPT_WRITING:['SUBMIT_SCRIPT'],INTERNAL_SCRIPT_REVIEW:['APPROVE','REQUEST_CHANGES'],CLIENT_SCRIPT_REVIEW:['APPROVE','REQUEST_CHANGES'],SCRIPT_APPROVED:['START_PRODUCTION'],READY_FOR_SHOOT:['SCHEDULE_SHOOT'],SHOOT_SCHEDULED:['COMPLETE_SHOOT'],RAW_FOOTAGE_READY:['START_EDITING'],EDITING:['SUBMIT_EDIT'],INTERNAL_EDIT_REVIEW:['APPROVE','REQUEST_CHANGES'],INTERNAL_APPROVED:['APPROVE','REQUEST_CHANGES'],INTERNAL_CHANGES:['SUBMIT_EDIT'],CLIENT_REVIEW:['APPROVE','REQUEST_CHANGES'],CLIENT_CHANGES:['SUBMIT_EDIT'],FINAL_CLIENT_APPROVED:['READY_TO_PUBLISH'],READY_TO_PUBLISH:['SCHEDULE_PUBLISH','PUBLISH'],SCHEDULED:['PUBLISH'],PUBLISHED:['ANALYTICS'],ANALYTICS:['REPORTING']};
 const team=c.assignees||{};
 return (all[c.status]||[]).filter(action=>{
  if(['APPROVE','REQUEST_CHANGES'].includes(action)){
   if(c.status.startsWith('CLIENT'))return actor.isClient&&can('content.approve_client');
   if(actor.isClient)return false;
   if(c.reviewStage==='SUPER_ADMIN')return actor.isSuperAdmin;
   if(c.reviewStage==='ADMIN')return can('approval.admin');
   return can('content.approve')&&(actor.isSuperAdmin||team.smm===actor.id);
  }
  if(actor.isClient)return false;
  const rule:Record<string,[string,string|undefined]>={START_SCRIPT:['content.edit',team.smm],SUBMIT_SCRIPT:['script.write',team.writer],START_PRODUCTION:['content.edit',team.smm],SCHEDULE_SHOOT:['shoot.manage',team.videographer],COMPLETE_SHOOT:['shoot.manage',team.videographer],START_EDITING:['edit.submit',team.editor||team.designer],SUBMIT_EDIT:['edit.submit',team.editor||team.designer],READY_TO_PUBLISH:['publish.manage',team.smm],SCHEDULE_PUBLISH:['publish.manage',team.smm],PUBLISH:['publish.manage',team.smm],ANALYTICS:['report.manage',team.smm],REPORTING:['report.manage',team.smm]};
  return can(rule[action][0])&&(can('content.edit_all')||rule[action][1]===actor.id||action==='SCHEDULE_SHOOT'&&team.smm===actor.id);
 });
}
export function ContentDetail({id}:{id:number}){
 const {actor,can,openForm}=useApp(),{data:c,loading,error}=useResource('/content/'+id);
 const [tab,setTab]=useState('Overview'),[action,setAction]=useState(''),[edit,setEdit]=useState(false),[version,setVersion]=useState(false);
 const {mutate,pending}=useMutation();
 if(loading)return <Loading/>;if(error)return <ErrorState message={error}/>;if(!c)return null;
 const options=actionsFor(c,actor,can),tabs=actor.isClient?['Overview',...(c.requiresShoot?['Script']:[]),'Versions','Approvals','Revisions','Drive links','Comments','Publishing']:['Overview','Brief & Notes',...(c.requiresShoot?['Script']:[]),'Tasks',...(c.requiresShoot?['Shoot']:[]),'Drive links','Versions','Approvals','Revisions','Comments','Chat','Publishing','Activity'];
 const editable=can('content.edit')&&!actor.isClient&&(can('content.edit_all')||c.assignees?.smm===actor.id);
 return <><Link className="back-link" href="/content"><ArrowLeft size={14}/> Back to content</Link><div className="content-detail-header"><div className="content-detail-eyebrow"><span>{c.code}</span><i/> <ClientMark name={c.client.name} color={c.client.color} size="tiny"/>{c.client.name}<Badge status={c.status}/></div><div className="page-heading"><h1>{c.title}</h1><div className="heading-actions">{editable&&<Button variant="outline" onClick={()=>setEdit(true)}><Pencil size={14}/> Edit plan</Button>}{options.map(a=><Button key={a} variant={a==='REQUEST_CHANGES'?'outline':'default'} onClick={()=>setAction(a)}>{a==='APPROVE'?<Check size={15}/>:<ArrowUpRight size={15}/>} {actionNames[a]}</Button>)}</div></div><div className="content-detail-meta"><span><CalendarDays size={14}/>{dateLabel(c.publishAt,{day:'numeric',month:'long',year:'numeric'})}</span><span><Clock3 size={14}/>{timeLabel(c.publishAt)}</span><span>{c.platform}</span><span>{c.type}</span>{c.reviewStage&&!actor.isClient&&<span><ShieldCheck size={14}/>{label(c.reviewStage)} review</span>}</div></div>
 <Tabs value={tabs.includes(tab)?tab:'Overview'} onValueChange={setTab}><TabsList className="content-tabs">{tabs.map(t=><TabsTrigger value={t} key={t}>{t}{c[t.toLowerCase()]?.length>0&&<small>{c[t.toLowerCase()].length}</small>}</TabsTrigger>)}</TabsList>
 <TabsContent value="Overview"><div className="detail-columns"><div><Panel title="The story at a glance" subtitle={c.pillar||'The creative brief'} action={editable&&<Button variant="outline" size="sm" onClick={()=>setEdit(true)}><Pencil size={13}/> Edit plan</Button>}><div className="prose"><p>{actor.isClient?(c.script?.hook||c.sharedCaption||'Your team is bringing this content to life. Approved versions will appear here.'):(c.notes||'Add a brief to give your team a clear direction.')}</p></div><dl className="detail-grid"><div><dt>Platform</dt><dd>{c.platform}</dd></div><div><dt>Format</dt><dd>{c.type}</dd></div><div><dt>Content pillar</dt><dd>{c.pillar||'Not set'}</dd></div><div><dt>Publish time</dt><dd>{dateLabel(c.publishAt)} · {timeLabel(c.publishAt)}</dd></div>{!actor.isClient&&<><div><dt>Production</dt><dd>{c.requiresShoot?'Shoot required':'Design / edit'}</dd></div><div><dt>Revision rounds</dt><dd>{c.revisions?.length||0}</dd></div></>}</dl></Panel>{!actor.isClient&&<Panel title="Internal brief & notes" subtitle="Direction and creative guidance for the team" action={editable&&<Button variant="outline" size="sm" onClick={()=>setEdit(true)}><Pencil size={13}/> Edit brief</Button>}>{c.notes?<div style={{background:'var(--background)',border:'1px solid var(--border-color)',borderRadius:'10px',padding:'14px 16px',fontSize:'13px',lineHeight:'1.6',whiteSpace:'pre-wrap',color:'var(--foreground)'}}>{c.notes}</div>:<Empty title="No internal brief added yet" body="Add a brief so everyone working on this content understands the goals and vision." action={editable&&<Button size="sm" variant="outline" onClick={()=>setEdit(true)}><Plus size={13}/> Add brief</Button>}/>}</Panel>}<Panel title={c.versions?.length?'The latest version':'The next step'}>{c.versions?.length?<div className="version-feature"><span className="version-feature-icon"><Film size={34}/></span><div><span className="eyebrow">VERSION {c.versions[0].number}</span><h3>{c.title}</h3><p>{c.versions[0].notes||'Your latest content, ready for a closer look.'}</p><External href={c.versions[0].driveUrl}>Open in Google Drive</External></div></div>:<div className="next-step"><FileText size={30}/><div><h3>{c.requiresShoot ? (c.status.includes('SCRIPT')?'Every good story starts with a script.':'Good work is on its way.') : (['IDEA','PLANNING'].includes(c.status)?'Creative design is in planning.':'Digital design is in production.')}</h3><p>{c.requiresShoot ? (c.status.includes('SCRIPT')?'Open the Script tab to write, review, or share feedback.':'Your team’s files and progress will appear as the work moves forward.') : 'Assets and design versions will appear here once submitted by the team.'}</p>{c.requiresShoot ? <Button variant="outline" size="sm" onClick={()=>setTab('Script')}>Open script <ArrowUpRight size={13}/></Button> : <Button variant="outline" size="sm" onClick={()=>setTab('Drive links')}>Open drive links <ArrowUpRight size={13}/></Button>}</div></div>}</Panel></div><div>{!actor.isClient&&<><TeamPanel c={c}/><Panel title="The path to publish"><div className="deadline-list">{Object.entries(c.deadlines||{}).filter(([key])=>key!=='clientScript').map(([key,value])=><div key={key}><span>{label(key.replace(/([A-Z])/g,' $1'))}</span><strong>{dateLabel(value as string)}</strong></div>)}</div></Panel><Panel title="Recent activity"><Timeline items={(c.activities||[]).slice(0,5)}/></Panel></>}</div></div></TabsContent>{!actor.isClient&&<TabsContent value="Brief & Notes"><BriefAndNotesTab c={c} editable={editable} onEdit={()=>setEdit(true)}/></TabsContent>}
 {c.requiresShoot && <TabsContent value="Script"><ScriptTab c={c}/></TabsContent>}
 {!actor.isClient&&<><TabsContent value="Tasks"><Panel title="The work behind this content" action={can('task.create')&&<Button size="sm" variant="outline" onClick={()=>openForm('task',{clientId:c.clientId,contentId:c.id})}><Plus size={14}/> Add task</Button>}>{c.tasks?.length?<div className="table-scroll"><table><thead><tr><th>Task</th><th>Assigned to</th><th>Deadline</th><th>Status</th></tr></thead><tbody>{c.tasks.map((t:any)=><tr key={t.id}><td><Link className="text-link" href={'/tasks?task='+t.id}>{t.title}<ArrowUpRight size={14}/></Link></td><td>{t.assignee.name}</td><td>{dateLabel(t.dueAt)}</td><td><Badge status={t.status}/></td></tr>)}</tbody></table></div>:<Empty title="No tasks yet"/>}</Panel></TabsContent>{c.requiresShoot && <TabsContent value="Shoot"><ShootTab c={c}/></TabsContent>}</>}
 <TabsContent value="Drive links"><Panel title="Everything has a home" subtitle="Files live in Google Drive. Their context lives here." action={can('drive.manage')&&<Button size="sm" variant="outline" onClick={()=>openForm('drive',{clientId:c.clientId,contentId:c.id})}><Plus size={14}/> Add link</Button>}>{c.driveLinks?.length?<div className="link-list">{c.driveLinks.map((l:any)=><div key={l.id}><FolderOpen size={20}/><div><strong>{l.title}</strong><small>{l.category}{!actor.isClient&&(l.clientVisible?' · Client visible':' · Internal only')}</small></div><External href={l.url}>Open in Drive</External></div>)}</div>:<Empty title="Links, neatly connected" body="Brand assets, references, and final files will appear here."/>}</Panel></TabsContent>
 <TabsContent value="Versions"><Panel title="Every version, preserved" subtitle="A record of how the work came together." action={can('edit.submit')&&['EDITING','INTERNAL_CHANGES','CLIENT_CHANGES'].includes(c.status)&&<Button size="sm" onClick={()=>setVersion(true)}><Plus size={14}/> Add version</Button>}>{c.versions?.length?<div className="versions-list">{c.versions.map((v:any)=><div key={v.id}><span className="version-number">V{v.number}</span><div style={{flex:1,minWidth:0}}><strong>{v.number===c.versions[0].number?'Latest version':'Previous version'}</strong><p>{v.notes||'No additional notes.'}</p><small>{v.addedBy?.name&&v.addedBy.name+' · '}{dateLabel(v.createdAt)} · {timeLabel(v.createdAt)}</small></div><div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>{!actor.isClient&&<Badge status={v.clientVisible?'APPROVED':'INTERNAL_EDIT_REVIEW'}>{v.clientVisible?'Shared with client':'Internal'}</Badge>}<External href={v.driveUrl}>Open version</External></div></div>)}</div>:<Empty title="Your first cut starts here" body="Add a Google Drive link when the first version is ready."/>}</Panel></TabsContent>
 <TabsContent value="Approvals"><Panel title="A clear record of every decision">{c.approvals?.length?<div className="approval-history">{c.approvals.map((a:any)=><div key={a.id}><span className={'decision-icon '+(a.decision==='APPROVED'?'green':'amber')}><ShieldCheck size={18}/></span><div><strong>{label(a.stage)} <span>· {a.reviewer?.name}</span></strong><p>{a.comment||label(a.decision)}</p><small>{dateLabel(a.createdAt)} · {timeLabel(a.createdAt)}</small></div><Badge status={a.decision}/></div>)}</div>:<Empty title="The review journey starts here" body="Every approval and change request will be recorded as the content progresses."/>}</Panel></TabsContent>
 <TabsContent value="Revisions"><Panel title="Feedback that moves the work forward">{c.revisions?.length?<div className="revision-list">{c.revisions.map((r:any)=><div className="revision-card" key={r.id}><div><strong>Revision {r.number}</strong><Badge status={r.status==='OPEN'?'CHANGES_REQUIRED':'COMPLETED'}/></div><p>{r.comments}</p>{r.timestampComments?.map((t:any,i:number)=><p className="timestamp-note" key={i}><code>{t.timestamp}</code>{t.comment}</p>)}{r.referenceUrls?.map((u:string,i:number)=><External key={u} href={u}>Reference {i+1}</External>)}{r.resolution&&<p className="resolution-note">{r.resolution}</p>}<small>{r.requestedBy?.name&&r.requestedBy.name+' · '}{dateLabel(r.createdAt)}{r.assignee&&' · Assigned to '+r.assignee.name}</small></div>)}</div>:<Empty title="Looking good so far" body="Revision requests and feedback with timestamps will appear here."/>}</Panel></TabsContent>
 <TabsContent value="Comments"><Comments c={c}/></TabsContent>{!actor.isClient&&<TabsContent value="Chat"><ContentChat c={c}/></TabsContent>}
 <TabsContent value="Publishing"><PublishingTab c={c}/></TabsContent>{!actor.isClient&&<TabsContent value="Activity"><Panel title="The full story" subtitle="Every important change, in order."><Timeline items={c.activities||[]}/>{c.history?.length>0&&<div className="status-history">{c.history.map((h:any)=><div key={h.id}><Badge status={h.previous}/><ChevronRight size={13}/><Badge status={h.next}/><time>{dateLabel(h.createdAt)} · {timeLabel(h.createdAt)}</time></div>)}</div>}</Panel></TabsContent>}</Tabs>
 <Modal open={edit} onOpenChange={setEdit} title="Update the content plan" wide>{edit&&<ContentForm initial={c} onDone={()=>setEdit(false)}/>}</Modal>
 <Modal open={!!action} onOpenChange={v=>!v&&setAction('')} title={actionNames[action]||'Update workflow'} description={action==='REQUEST_CHANGES'?'Make your feedback specific so the team knows what to improve.':'The linked tasks, calendar status, and notifications will update together.'}><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload:any={action,revision:c.revision};for(const key of ['comment','rawUrl','publishedUrl','externalPostId'])if(f.get(key))payload[key]=f.get(key);if(f.get('scheduledAt'))payload.scheduledAt=new Date(f.get('scheduledAt') as string).toISOString();if(f.get('timestamps'))payload.timestampComments=String(f.get('timestamps')).split('\n').filter(Boolean).map(line=>{const [timestamp,...rest]=line.trim().split(' ');return {timestamp,comment:rest.join(' ')};});if(f.get('references'))payload.referenceUrls=String(f.get('references')).split('\n').map(s=>s.trim()).filter(Boolean);try{await mutate('/content/'+id+'/actions',payload,'POST','Workflow updated');setAction('');}catch{}}}>
 {action==='COMPLETE_SHOOT'&&<Field label="Raw footage Drive URL"><input type="url" name="rawUrl" required placeholder="https://drive.google.com/…"/></Field>}{action==='PUBLISH'&&<><Field label="Published post URL"><input name="publishedUrl" type="url" required placeholder="https://www.instagram.com/p/…"/></Field><Field label="External post ID (optional)"><input name="externalPostId"/></Field></>}{action==='SCHEDULE_PUBLISH'&&<><Field label="Publish date & time"><input name="scheduledAt" type="datetime-local" required defaultValue={inputDate(c.publishAt)}/></Field><p className="info-note">This schedules your team’s publishing workflow. Your SMM publishes the post on the platform and records its URL here.</p></>}
 <Field label={action==='REQUEST_CHANGES'?'What needs to change?':'Comment (optional)'}><textarea name="comment" rows={3} required={action==='REQUEST_CHANGES'} placeholder={action==='APPROVE'?'Looking good. Let’s move this forward.':'Add helpful context…'}/></Field>{action==='REQUEST_CHANGES'&&<><Field label="Timestamp feedback" hint="One per line, for example: 00:14 Replace this clip."><textarea rows={3} name="timestamps" placeholder={'00:14 Replace this clip.\n00:31 Make the logo smaller.'}/></Field><Field label="Reference URLs" hint="One URL per line."><textarea rows={2} name="references" placeholder="https://…"/></Field></>}<FormFooter pending={pending} onCancel={()=>setAction('')} submit={actionNames[action]}/></form></Modal>
 <Modal open={version} onOpenChange={setVersion} title="Add the next version" description="Previous versions stay preserved. This version will go through internal review."><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await mutate('/content/'+id+'/versions',{url:f.get('url'),notes:f.get('notes'),revision:c.revision},'POST','New version added');setVersion(false);}catch{}}}><Field label={c.requiresShoot ? "Video / cut URL" : "Design asset / cut URL"}><input name="url" type="url" required placeholder="https://…"/></Field><Field label="What changed?"><textarea name="notes" rows={3}/></Field><FormFooter pending={pending} onCancel={()=>setVersion(false)} submit="Add version"/></form></Modal>
 </>;
}
function TeamPanel({c}:{c:any}){const {data:users}=useResource<any[]>('/users');return <Panel title="The people behind it"><div className="content-team">{Object.entries(c.assignees||{}).map(([role,id])=>{const user=users?.find(u=>u.id===id);return <div key={role}><Avatar name={user?.name||'?'} color={user?.avatarColor} src={user?.avatarUrl} size="small"/><span><strong>{user?.name||'Team member'}</strong><small>{role==='smm'?'Social media manager':label(role)}</small></span></div>;})}</div></Panel>;}
function AiScriptModal({
 open,
 onOpenChange,
 c,
 currentValues,
 onApply
}:{
 open:boolean;
 onOpenChange:(open:boolean)=>void;
 c:any;
 currentValues:{hook:string;body:string;cta:string;caption:string;hashtags:string};
 onApply:(data:Partial<{hook:string;body:string;cta:string;caption:string;hashtags:string}>)=>void;
}){
 const [mode,setMode]=useState<'hooks'|'full_script'|'improve'|'caption'>('hooks');
 const [instruction,setInstruction]=useState('');
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<any>(null);

 const brand=c?.client?.brand||{};

 const handleGenerate=async(targetMode=mode)=>{
  setLoading(true);
  setData(null);
  try{
   const res=await api('/content/'+c.id+'/script/ai-assist',{
    method:'POST',
    body:JSON.stringify({
     mode:targetMode,
     currentHook:currentValues.hook,
     currentBody:currentValues.body,
     currentCta:currentValues.cta,
     currentCaption:currentValues.caption,
     customInstruction:instruction.trim()||undefined
    })
   });
   setData(res);
  }catch(err:any){
   toast.error(err.message||'Failed to generate AI suggestions.');
  }finally{
   setLoading(false);
  }
 };

 return (
  <Modal
   open={open}
   onOpenChange={onOpenChange}
   title="✨ AI Script Co-Pilot"
   description={`Powered by AI (Gemini / GPT) · Tailored for ${c?.client?.name||'Brand'} (${c?.platform||'Social'} · ${c?.type||'Post'})`}
   wide
  >
   <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
    <div style={{padding:'9px 12px',borderRadius:'8px',background:'var(--accent-soft, rgba(2, 132, 199, 0.08))',border:'1px solid var(--border-color)',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'8px',fontSize:'12px'}}>
     <div>
      <span style={{fontWeight:600,color:'var(--ink)'}}>{c?.client?.name}: </span>
      <span style={{color:'var(--muted)'}}>Tone: {brand.tone||'Brand tone'} · Audience: {brand.audience||'Target audience'}</span>
     </div>
     <span style={{fontSize:'11px',color:'var(--accent)',fontWeight:600}}>{c?.type} · {c?.pillar||'Topic'}</span>
    </div>

    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
     {[
      {id:'hooks',label:'💡 Hook Ideas'},
      {id:'full_script',label:'📝 Full Script Draft'},
      {id:'improve',label:'🪄 Polish Draft & Tone'},
      {id:'caption',label:'🏷️ Captions & Hashtags'}
     ].map(tab=>{
      const isSelected=mode===tab.id;
      return (
       <button
        key={tab.id}
        type="button"
        onClick={()=>{setMode(tab.id as any);setData(null);}}
        style={{
         padding:'7px 12px',
         borderRadius:'7px',
         border:isSelected?'1px solid var(--accent, #0284c7)':'1px solid var(--border-color)',
         background:isSelected?'var(--accent-soft, rgba(2, 132, 199, 0.12))':'transparent',
         color:isSelected?'var(--accent, #0284c7)':'var(--muted)',
         cursor:'pointer',
         fontWeight:isSelected?600:400,
         fontSize:'12px',
         transition:'all 0.15s ease'
        }}
       >
        {tab.label}
       </button>
      );
     })}
    </div>

    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
     <input
      style={{flex:1,padding:'8px 12px',borderRadius:'8px',border:'1px solid var(--border-color)',background:'var(--surface)',color:'var(--ink)',fontSize:'12.5px'}}
      placeholder={
       mode==='hooks'?'Optional direction (e.g. "make it witty", "focus on morning routine")...'
       :mode==='improve'?'Optional feedback (e.g. "make the CTA stronger", "shorten dialogue")...'
       :'Optional instruction or special angle...'
      }
      value={instruction}
      onChange={e=>setInstruction(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleGenerate();}}}
     />
     <Button
      type="button"
      disabled={loading}
      onClick={()=>handleGenerate()}
      style={{display:'inline-flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap'}}
     >
      <Sparkles size={14} />
      <span>{loading?'Generating…':'Generate with AI'}</span>
     </Button>
    </div>

    {loading && (
     <div style={{padding:'32px',textAlign:'center',color:'var(--muted)'}}>
      <Sparkles size={24} style={{margin:'0 auto 8px auto',display:'block',color:'var(--accent)'}} />
      <span>Generating on-brand suggestions with AI…</span>
     </div>
    )}

    {!loading && !data && (
     <div style={{padding:'24px',textAlign:'center',border:'1px dashed var(--border-color)',borderRadius:'8px',color:'var(--muted)',fontSize:'12px'}}>
      Click <strong>Generate with AI</strong> to generate tailored options based on your brief and {c?.client?.name} brand guidelines.
     </div>
    )}

    {!loading && data && mode==='hooks' && data.hooks && (
     <div style={{display:'flex',flexDirection:'column',gap:'10px',maxHeight:'380px',overflowY:'auto'}}>
      {data.hooks.map((h:any,i:number)=>(
       <div key={i} style={{padding:'12px',borderRadius:'8px',border:'1px solid var(--border-color)',background:'var(--surface)',display:'flex',flexDirection:'column',gap:'6px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
         <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',background:'var(--accent-soft)',color:'var(--accent)'}}>{h.label}</span>
         <Button type="button" size="sm" variant="outline" onClick={()=>{onApply({hook:h.text});onOpenChange(false);}} style={{fontSize:'11px',height:'24px'}}>Apply Hook</Button>
        </div>
        <div style={{fontSize:'13px',fontWeight:500,color:'var(--ink)'}}>"{h.text}"</div>
        {h.reason && <div style={{fontSize:'11px',color:'var(--muted)'}}>💡 {h.reason}</div>}
       </div>
      ))}
     </div>
    )}

    {!loading && data && mode==='full_script' && (
     <div style={{display:'flex',flexDirection:'column',gap:'10px',maxHeight:'400px',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
       <span style={{fontSize:'12px',color:'var(--muted)'}}>{data.creativeAngle && `Angle: ${data.creativeAngle}`}</span>
       <Button type="button" size="sm" onClick={()=>{onApply({hook:data.hook,body:data.body,cta:data.cta,caption:data.caption,hashtags:data.hashtags});onOpenChange(false);}} style={{display:'inline-flex',alignItems:'center',gap:'5px'}}>
        <Check size={13} /><span>Apply Entire Script</span>
       </Button>
      </div>

      <div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
       <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)'}}>THE HOOK</span>
        <button type="button" onClick={()=>onApply({hook:data.hook})} style={{fontSize:'11px',color:'var(--accent)',background:'none',border:'none',cursor:'pointer'}}>Use hook only</button>
       </div>
       <p style={{margin:0,fontSize:'12.5px',fontWeight:500}}>"{data.hook}"</p>
      </div>

      <div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
       <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)'}}>SCRIPT BODY (SCENES & BEATS)</span>
        <button type="button" onClick={()=>onApply({body:data.body})} style={{fontSize:'11px',color:'var(--accent)',background:'none',border:'none',cursor:'pointer'}}>Use body only</button>
       </div>
       <pre style={{margin:0,fontSize:'12px',whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{data.body}</pre>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
       <div style={{padding:'10px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'3px'}}>CALL TO ACTION</span>
        <p style={{margin:0,fontSize:'12px'}}>{data.cta}</p>
       </div>
       <div style={{padding:'10px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'3px'}}>HASHTAGS</span>
        <p style={{margin:0,fontSize:'12px',color:'var(--accent)'}}>{data.hashtags}</p>
       </div>
      </div>

      {data.caption && (
       <div style={{padding:'10px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'3px'}}>CAPTION</span>
        <p style={{margin:0,fontSize:'12px'}}>{data.caption}</p>
       </div>
      )}
     </div>
    )}

    {!loading && data && mode==='improve' && (
     <div style={{display:'flex',flexDirection:'column',gap:'10px',maxHeight:'400px',overflowY:'auto'}}>
      {data.critique && (
       <div style={{padding:'10px 12px',borderRadius:'8px',background:'rgba(234, 107, 54, 0.08)',border:'1px solid rgba(234, 107, 54, 0.25)',fontSize:'12px',color:'var(--ink)'}}>
        <strong style={{display:'block',marginBottom:'2px'}}>AI Editorial Review:</strong>
        {data.critique}
       </div>
      )}

      <div style={{display:'flex',justifyContent:'flex-end'}}>
       <Button type="button" size="sm" onClick={()=>{onApply({hook:data.hook,body:data.body,cta:data.cta,caption:data.caption,hashtags:data.hashtags});onOpenChange(false);}} style={{display:'inline-flex',alignItems:'center',gap:'5px'}}>
        <Check size={13} /><span>Apply Polished Script</span>
       </Button>
      </div>

      <div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
       <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'4px'}}>IMPROVED HOOK</span>
       <p style={{margin:0,fontSize:'12.5px',fontWeight:500}}>"{data.hook}"</p>
      </div>

      <div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
       <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'4px'}}>IMPROVED BODY</span>
       <pre style={{margin:0,fontSize:'12px',whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{data.body}</pre>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
       <div style={{padding:'10px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'3px'}}>IMPROVED CTA</span>
        <p style={{margin:0,fontSize:'12px'}}>{data.cta}</p>
       </div>
       <div style={{padding:'10px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border-color)'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'3px'}}>CAPTION & HASHTAGS</span>
        <p style={{margin:0,fontSize:'12px'}}>{data.caption} <span style={{color:'var(--accent)'}}>{data.hashtags}</span></p>
       </div>
      </div>
     </div>
    )}

    {!loading && data && mode==='caption' && data.captions && (
     <div style={{display:'flex',flexDirection:'column',gap:'10px',maxHeight:'380px',overflowY:'auto'}}>
      {data.captions.map((item:any,i:number)=>(
       <div key={i} style={{padding:'12px',borderRadius:'8px',border:'1px solid var(--border-color)',background:'var(--surface)',display:'flex',flexDirection:'column',gap:'6px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
         <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',background:'var(--accent-soft)',color:'var(--accent)'}}>{item.style}</span>
         <Button type="button" size="sm" variant="outline" onClick={()=>{onApply({caption:item.caption,hashtags:item.hashtags});onOpenChange(false);}} style={{fontSize:'11px',height:'24px'}}>Apply Caption</Button>
        </div>
        <div style={{fontSize:'12.5px',color:'var(--ink)'}}>{item.caption}</div>
        {item.hashtags && <div style={{fontSize:'11.5px',color:'var(--accent)'}}>{item.hashtags}</div>}
       </div>
      ))}
     </div>
    )}
   </div>
  </Modal>
 );
}

function ScriptTab({c}:{c:any}){
 const {actor,can}=useApp(),{mutate,pending}=useMutation();
 const editable=!actor.isClient&&can('script.write')&&(can('content.edit_all')||c.assignees?.writer===actor.id)&&['PLANNING','SCRIPT_WRITING'].includes(c.status);
 const s=c.script||{};

 const [hook,setHook]=useState(s.hook||'');
 const [body,setBody]=useState(s.body||'');
 const [cta,setCta]=useState(s.cta||'');
 const [caption,setCaption]=useState(s.caption||'');
 const [hashtags,setHashtags]=useState(s.hashtags||'');
 const [references,setReferences]=useState(s.references?.join('\n')||'');
 const [notes,setNotes]=useState(s.notes||'');
 const [aiOpen,setAiOpen]=useState(false);

 useEffect(()=>{
  if(c.script){
   setHook(c.script.hook||'');
   setBody(c.script.body||'');
   setCta(c.script.cta||'');
   setCaption(c.script.caption||'');
   setHashtags(c.script.hashtags||'');
   setReferences(c.script.references?.join('\n')||'');
   setNotes(c.script.notes||'');
  }
 },[c.script]);

 const handleApply=(data:Partial<{hook:string;body:string;cta:string;caption:string;hashtags:string}>)=>{
  if(data.hook!==undefined)setHook(data.hook);
  if(data.body!==undefined)setBody(data.body);
  if(data.cta!==undefined)setCta(data.cta);
  if(data.caption!==undefined)setCaption(data.caption);
  if(data.hashtags!==undefined)setHashtags(data.hashtags);
  toast.success('Applied to script draft!');
 };

 return (
  <>
   <Panel
    title={editable?'Shape the story':'The script'}
    subtitle={editable?'Save your draft, then submit it for review when you’re ready.':actor.isClient?'The latest script shared by your agency.':'A single brief for everyone creating this content.'}
    action={editable&&(
     <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={()=>setAiOpen(true)}
      style={{display:'inline-flex',alignItems:'center',gap:'6px',borderColor:'var(--accent, #ea6b36)',color:'var(--accent, #ea6b36)',fontWeight:600}}
     >
      <Sparkles size={14} />
      <span>AI Script Co-Pilot</span>
     </Button>
    )}
   >
    {!c.script&&!editable?<Empty title="The story is taking shape" body="Your script will appear here when it’s ready to share."/>:
     <form className="script-form" key={s.updatedAt||'script'} onSubmit={async e=>{
      e.preventDefault();
      try{
       await mutate('/content/'+c.id+'/script',{
        hook,
        body,
        cta,
        caption,
        hashtags,
        references:references.split('\n').map((str: string)=>str.trim()).filter(Boolean),
        notes:notes||'',
        revision:c.revision
       },'POST','Draft saved');
      }catch{}
     }}>
      <Field label="The hook" hint={editable?"One line to make them stop scrolling.":undefined}>
       <textarea name="hook" rows={3} value={hook} onChange={e=>setHook(e.target.value)} readOnly={!editable} className={!editable?'read-only':''}/>
      </Field>
      <Field label="Main script" hint={editable?"The story, beat by beat.":undefined}>
       <textarea name="body" rows={10} value={body} onChange={e=>setBody(e.target.value)} readOnly={!editable} className={!editable?'read-only':''}/>
      </Field>
      <Field label="Call to action" hint={editable?"What should they do next?":undefined}>
       <textarea name="cta" rows={2} value={cta} onChange={e=>setCta(e.target.value)} readOnly={!editable} className={!editable?'read-only':''}/>
      </Field>
      <Field label="Caption" hint={editable?"The words that go with the content.":undefined}>
       <textarea name="caption" rows={4} value={caption} onChange={e=>setCaption(e.target.value)} readOnly={!editable} className={!editable?'read-only':''}/>
      </Field>
      <Field label="Hashtags">
       <textarea name="hashtags" rows={2} value={hashtags} onChange={e=>setHashtags(e.target.value)} readOnly={!editable} className={!editable?'read-only':''}/>
      </Field>
      {editable?<><Field label="Reference URLs" hint="One URL per line."><textarea name="references" rows={2} value={references} onChange={e=>setReferences(e.target.value)} placeholder="https://…"/></Field><Field label="Internal notes"><textarea name="notes" rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></Field><FormFooter pending={pending} submit="Save draft"/></>:<div className="reference-links">{s.references?.map((r:string,i:number)=><External href={r} key={r}>Reference {i+1}</External>)}</div>}
     </form>
    }
   </Panel>
   <AiScriptModal
    open={aiOpen}
    onOpenChange={setAiOpen}
    c={c}
    currentValues={{hook,body,cta,caption,hashtags}}
    onApply={handleApply}
   />
  </>
 );
}
function ShootTab({c}:{c:any}){
 const {actor,can}=useApp(),{mutate,pending}=useMutation(),s=c.shoot||{};
 const edit=can('shoot.manage')&&(can('content.edit_all')||[c.assignees?.smm,c.assignees?.videographer].includes(actor.id))&&['READY_FOR_SHOOT','SHOOT_SCHEDULED'].includes(c.status);
 if(!c.requiresShoot)return <Panel title="Production route"><Empty title="No shoot needed" body="This content goes from script approval directly to design or editing."/></Panel>;
 return <Panel title="Shoot plan" subtitle="Everything the videographer needs for a good day on set."><form className="padded-form" key={s.updatedAt} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const d:any={scheduledAt:new Date(f.get('scheduledAt') as string).toISOString(),location:f.get('location'),shotList:f.get('shotList'),props:f.get('props'),people:f.get('people'),orientation:f.get('orientation'),durationMinutes:Number(f.get('durationMinutes')),notes:f.get('notes')};if(f.get('referenceUrl'))d.referenceUrl=f.get('referenceUrl');try{await mutate('/content/'+c.id+'/shoot',d,'POST','Shoot plan saved');}catch{}}}><div className="form-grid"><Field label="Date & time"><input type="datetime-local" name="scheduledAt" required defaultValue={inputDate(s.scheduledAt||c.deadlines?.shoot||new Date())} readOnly={!edit}/></Field><Field label="Location"><input name="location" defaultValue={s.location||''} required readOnly={!edit}/></Field><Field label="Orientation"><select name="orientation" defaultValue={s.orientation||'Portrait'} disabled={!edit}>{['Portrait','Landscape','Square'].map(o=><option key={o}>{o}</option>)}</select></Field><Field label="Estimated duration (minutes)"><input type="number" min={1} max={1440} name="durationMinutes" defaultValue={s.durationMinutes||60} readOnly={!edit}/></Field></div>{[['shotList','Shot list'],['props','Props'],['people','People required'],['referenceUrl','Reference URL'],['notes','Internal notes']].map(([key,title])=><Field key={key} label={title}><textarea rows={key==='shotList'?4:2} name={key} defaultValue={s[key]||''} readOnly={!edit} required={key==='shotList'}/></Field>)}{edit&&<FormFooter pending={pending} submit="Save shoot plan"/>}</form></Panel>;
}
function Comments({c}:{c:any}){
  const {actor}=useApp(),{mutate,pending}=useMutation();
  return <Panel title="Keep the conversation in context">
    <div className="comment-list">
      {c.comments?.map((m:any)=><div key={m.id}><Avatar name={m.author.name} color={m.author.avatarColor} src={m.author.avatarUrl} size="small"/><div style={{flex:1,minWidth:0}}><strong>{m.author.name}</strong><small>{dateLabel(m.createdAt)} {!actor.isClient&&(m.clientVisible?'· Client visible':'· Internal')}</small><p>{m.body}</p>{m.timestamp&&<code>{m.timestamp}</code>}{m.referenceUrl&&<External href={m.referenceUrl}>Reference</External>}</div></div>)}
      {!c.comments?.length&&<Empty title="Start a conversation" body="Keep the context close to the work."/>}
    </div>
    <form className="comment-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);const d:any={body:f.get('body'),clientVisible:actor.isClient||f.get('clientVisible')==='on'};if(f.get('timestamp'))d.timestamp=f.get('timestamp');if(f.get('referenceUrl'))d.referenceUrl=f.get('referenceUrl');try{await mutate('/content/'+c.id+'/comments',d,'POST','Comment added');form.reset();}catch{}}}>
      <Field label="Your comment"><textarea name="body" required rows={3} placeholder="Add a thought, a question, or a little context…"/></Field>
      <div className="form-grid">
        <Field label="Timestamp (optional)"><input name="timestamp" placeholder="00:14"/></Field>
        <Field label="Reference URL (optional)"><input name="referenceUrl" type="url" placeholder="https://…"/></Field>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:!actor.isClient?'space-between':'flex-end',flexWrap:'wrap',gap:'12px',marginTop:'14px'}}>
        {!actor.isClient ? (
          <label className="checkbox-label" style={{margin:0,display:'inline-flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
            <input type="checkbox" name="clientVisible"/> Share this comment with the client
          </label>
        ) : <div/>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add comment'}
          <ChevronRight size={15}/>
        </Button>
      </div>
    </form>
  </Panel>;
}
function ContentChat({c}:{c:any}){const {data}=useResource<any[]>('/chat');const thread=data?.find(t=>t.clientId===c.clientId&&t.kind==='CLIENT_INTERNAL')||data?.find(t=>t.clientId===c.clientId)||data?.find(t=>t.contentId===c.id);return <Panel title="Client conversation" subtitle="Team conversations for this client are kept unified in the client thread."><div className="next-step"><MessageSquare size={32}/><div><h3>{thread?.title||c.client?.name+' · internal'}</h3><p>{thread?'All discussion and updates for this content flow directly into the client conversation thread.':'Open the conversation to keep the team aligned.'}</p><Link href={thread?'/chat?thread='+thread.id:'/chat'}><Button>Open conversation <ArrowUpRight size={15}/></Button></Link></div></div></Panel>;}
function PublishingTab({ c }: { c: any }) {
  const { can, refresh, openForm } = useApp();
  const [publishingDirect, setPublishingDirect] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { data: accounts } = useResource<any[]>(`/social-publishing/accounts/${c.clientId}`);

  const targetPlatform = (c.platform || 'INSTAGRAM').toUpperCase().trim();
  const connectedAccount = accounts?.find((a: any) => {
    const plat = (a.platform || '').toUpperCase();
    return (
      plat === targetPlatform ||
      (targetPlatform.includes('INSTAGRAM') && plat === 'INSTAGRAM') ||
      (targetPlatform.includes('FACEBOOK') && plat === 'FACEBOOK') ||
      (targetPlatform.includes('LINKEDIN') && plat === 'LINKEDIN')
    );
  });

  const carouselSlides = (c.driveLinks || []).filter(
    (l: any) =>
      l.category === 'Carousel Slide' ||
      /slide/i.test(l.title) ||
      (c.type.toUpperCase().includes('CAROUSEL') && l.category === 'Graphic')
  );
  const isCarousel = c.type.toUpperCase().includes('CAROUSEL') || carouselSlides.length >= 2;

  const handleDirectPublish = async () => {
    try {
      setPublishingDirect(true);
      toast.info(`Publishing directly to ${c.platform}...`, { duration: 6000 });
      const res: any = await api(`/social-publishing/publish/${c.id}`, { method: 'POST' });
      toast.success(`Published to ${c.platform}!`, {
        description: res.liveUrl ? `Live at ${res.liveUrl}` : 'Post created successfully.',
        duration: 8000,
      });
      setConfirmModalOpen(false);
      refresh();
    } catch (err: any) {
      toast.error('Publishing failed', {
        description: err.message || 'Could not post to social media API.',
        duration: 8000,
      });
    } finally {
      setPublishingDirect(false);
    }
  };

  const isPublished = c.publishing?.status === 'PUBLISHED';

  return (
    <>
      <Panel
        title="Ready for the world"
        subtitle="Publish directly on the client's platform in one click, or record the live URL."
      >
        {c.publishing ? (
          <div className="padded-form space-y-4">
            {/* Status & Platform Banner */}
            <dl className="detail-grid">
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge status={c.publishing.status} />
                </dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd className="font-semibold">{c.platform}</dd>
              </div>
              <div>
                <dt>Scheduled for</dt>
                <dd>
                  {dateLabel(c.publishing.scheduledAt || c.publishAt)} ·{' '}
                  {timeLabel(c.publishing.scheduledAt || c.publishAt)}
                </dd>
              </div>
              <div>
                <dt>Final file</dt>
                <dd>
                  {c.publishing.finalDriveUrl ? (
                    <External href={c.publishing.finalDriveUrl}>Open asset link</External>
                  ) : (
                    <span className="text-stone-400">Attached to story</span>
                  )}
                </dd>
              </div>
            </dl>

            {/* CAROUSEL SLIDES OVERVIEW CARD */}
            {isCarousel && (
              <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <FolderOpen size={13} /> Carousel Slide Deck ({carouselSlides.length} slides)
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-zinc-100 mt-0.5">
                      Instagram Carousel Slide Sequence
                    </h4>
                  </div>
                  {can('drive.manage') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openForm('drive', { clientId: c.clientId, contentId: c.id, category: 'Carousel Slide', title: `Slide ${carouselSlides.length + 1}` })}
                      className="text-xs"
                    >
                      <Plus size={13} /> Add Slide Link
                    </Button>
                  )}
                </div>

                {carouselSlides.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {carouselSlides.map((slide: any, idx: number) => (
                      <div
                        key={slide.id || idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-stone-800 dark:text-zinc-200">
                            #{idx + 1} · {slide.title}
                          </strong>
                          <span className="text-[11px] text-stone-500 dark:text-zinc-400 block truncate">
                            {slide.url}
                          </span>
                        </div>
                        <External href={slide.url} className="text-sky-600 text-xs font-semibold shrink-0">
                          View
                        </External>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-amber-300 dark:border-amber-700/50 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <p className="font-semibold">⚠️ No individual slide links attached yet.</p>
                    <p className="text-stone-600 dark:text-zinc-400">
                      To publish a carousel directly to Instagram, attach at least 2 slide Google Drive links using <strong>"Add Slide Link"</strong> above.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* LIVE POST SUCCESS BANNER */}
            {isPublished && (
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                      Live on {c.platform}
                    </h4>
                    {c.publishing.publishedAt && (
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                        Published {dateLabel(c.publishing.publishedAt)} at{' '}
                        {timeLabel(c.publishing.publishedAt)}
                      </p>
                    )}
                  </div>
                </div>
                {c.publishing.publishedUrl && (
                  <External
                    href={c.publishing.publishedUrl}
                    className="btn-emerald inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs shrink-0"
                  >
                    <span>View Live Post</span>
                    <ExternalLink size={13} />
                  </External>
                )}
              </div>
            )}

            {/* ONE-CLICK DIRECT PUBLISH CARD (If not yet published) */}
            {!isPublished && can('publish.manage') && (
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-pink-500/30 bg-pink-500/5 dark:bg-pink-950/20 space-y-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                      <Sparkles size={13} /> Direct Platform Publishing
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-zinc-100 mt-0.5">
                      Publish to {c.platform} in One Click
                    </h4>
                  </div>

                  {connectedAccount?.isConnected ? (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Connected: @{connectedAccount.handle}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                      Account not connected
                    </span>
                  )}
                </div>

                {connectedAccount?.isConnected ? (
                  <Button
                    type="button"
                    className="btn-gradient w-full py-3.5 rounded-xl font-extrabold text-sm text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
                    disabled={publishingDirect || (isCarousel && carouselSlides.length < 2 && !c.publishing?.finalDriveUrl?.includes('\n'))}
                    onClick={() => setConfirmModalOpen(true)}
                  >
                    <Send size={16} />
                    <span>
                      ⚡ {isCarousel && carouselSlides.length >= 2 ? `Publish Carousel (${carouselSlides.length} Slides) to ${c.platform} Now` : `Publish Directly to ${c.platform} Now`}
                    </span>
                  </Button>
                ) : (
                  <div className="text-xs text-stone-600 dark:text-zinc-400 bg-white dark:bg-zinc-800/80 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-1.5">
                    <p>
                      Client <strong>{c.client?.name}</strong> has not linked active credentials for{' '}
                      <strong>{c.platform}</strong>.
                    </p>
                    <Link
                      href={`/clients/${c.clientId}`}
                      className="text-pink-600 dark:text-pink-400 font-bold inline-flex items-center gap-1 hover:underline"
                    >
                      Connect {c.platform} in Client Settings →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Caption & Hashtags Content */}
            <Field label="Approved Caption">
              <textarea rows={4} readOnly value={c.publishing.caption} className="text-xs leading-relaxed" />
            </Field>

            <Field label="Approved Hashtags">
              <textarea rows={2} readOnly value={c.publishing.hashtags} className="text-xs leading-relaxed" />
            </Field>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(c.publishing.caption + '\n\n' + c.publishing.hashtags)
                    .then(() => toast.success('Caption & hashtags copied to clipboard'))
                    .catch(() => toast.error('Select the caption and copy it manually.'))
                }
              >
                <Copy size={13} />
                <span>Copy caption & hashtags</span>
              </Button>
            </div>
          </div>
        ) : (
          <Empty
            title="A few steps before the spotlight"
            body="Publishing details become available after client approvals are complete."
          />
        )}
      </Panel>

      {/* CONFIRMATION MODAL FOR 1-CLICK PUBLISH */}
      <Modal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title={`Publish to ${c.platform}?`}
        description={`This will immediately dispatch this post to ${c.client?.name}'s live ${c.platform} account (@${connectedAccount?.handle || 'connected'}).`}
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 text-xs space-y-2">
            <div>
              <span className="font-semibold text-stone-500">Target Channel:</span>{' '}
              <strong className="text-stone-800 dark:text-zinc-200">
                {c.platform} (@{connectedAccount?.handle})
              </strong>
            </div>
            {isCarousel && (
              <div>
                <span className="font-semibold text-stone-500">Post Type:</span>{' '}
                <strong className="text-pink-600 dark:text-pink-400">
                  Multi-Slide Carousel ({carouselSlides.length || 'Multi'} slides in deck)
                </strong>
              </div>
            )}
            <div>
              <span className="font-semibold text-stone-500">Caption Preview:</span>
              <p className="mt-1 text-stone-700 dark:text-zinc-300 line-clamp-3 italic">
                "{c.publishing?.caption}"
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={publishingDirect}
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="btn-gradient font-bold text-white shadow-md flex items-center gap-1.5"
              disabled={publishingDirect}
              onClick={handleDirectPublish}
            >
              {publishingDirect ? (
                <>
                  <span className="animate-spin text-white">◌</span>
                  <span>Posting to {c.platform}...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Confirm & Publish Now</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {can('report.manage') && <MetricsForm c={c} />}
    </>
  );
}
export function MetricsForm({c}:{c:any}){const {mutate,pending}=useMutation();return <Panel title="How did it do?" subtitle="Record cumulative metrics for this post. Reports use its latest snapshot."><form className="padded-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),d:any={};for(const [k,v]of f)d[k]=k==='date'?new Date(String(v)).toISOString():Number(v);try{await mutate('/content/'+c.id+'/metrics',d,'POST','Metrics saved');}catch{}}}><Field label="Snapshot date"><input type="date" name="date" defaultValue={new Date().toISOString().slice(0,10)} required/></Field><div className="form-grid three">{['reach','impressions','views','likes','comments','shares','saves','followerGrowth'].map(k=><Field key={k} label={label(k.replace(/([A-Z])/g,' $1'))}><input type="number" name={k} min={k==='followerGrowth'?undefined:0} defaultValue={c.metrics?.[0]?.[k]||0} required/></Field>)}</div><FormFooter pending={pending} submit="Save metrics"/></form></Panel>;}
export function Timeline({items}:{items:any[]}){if(!items.length)return <Empty title="A clean page" body="Important updates will be recorded here."/>;return <div className="timeline">{items.map((a:any)=><div key={a.id}><span className="timeline-point"/><div><strong>{label(a.action.replaceAll('.',' '))}</strong><p>{a.actor?.name||'Agency OS'}{a.client?.name&&' · '+a.client.name}</p><time>{dateLabel(a.createdAt)} · {timeLabel(a.createdAt)}</time></div></div>)}</div>;}



function BriefAndNotesTab({c,editable,onEdit}:{c:any;editable:boolean;onEdit:()=>void}){
  return (
    <div className="detail-columns">
      <div>
        <Panel title="Internal Creative Brief" subtitle="Core vision, angles, and directives for production" action={editable&&<Button size="sm" variant="outline" onClick={onEdit}><Pencil size={13}/> Edit brief</Button>}>
          {c.notes ? (
            <div style={{background:'var(--background)',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'18px 20px',fontSize:'13.5px',lineHeight:'1.7',whiteSpace:'pre-wrap',color:'var(--foreground)'}}>
              {c.notes}
            </div>
          ) : (
            <Empty title="No internal brief yet" body="Add a brief so writers, editors, and videographers know exactly what to produce." action={editable&&<Button size="sm" onClick={onEdit}><Plus size={14}/> Add creative brief</Button>}/>
          )}
        </Panel>

        {!c.requiresShoot && (c.sharedCaption || editable) && (
          <Panel title="Post Caption & Copy" subtitle="Platform copy and hashtags for this creative piece" action={editable&&<Button size="sm" variant="outline" onClick={onEdit}><Pencil size={13}/> Edit caption</Button>}>
            {c.sharedCaption ? (
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <div style={{background:'var(--background)',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'14px 16px',fontSize:'13px',lineHeight:'1.6',whiteSpace:'pre-wrap',color:'var(--foreground)'}}>
                  {c.sharedCaption}
                </div>
                {c.sharedHashtags && (
                  <div style={{fontSize:'12px',color:'var(--accent)',fontWeight:500}}>
                    {c.sharedHashtags}
                  </div>
                )}
              </div>
            ) : (
              <Empty title="No caption added yet" body="Add caption copy and hashtags for this creative piece." action={editable&&<Button size="sm" onClick={onEdit}><Plus size={13}/> Add caption</Button>}/>
            )}
          </Panel>
        )}

        {c.client?.brand && (
          <Panel title="Brand Guidelines & Guardrails" subtitle="Keep the content on-brand">
            <dl className="detail-grid">
              {c.client.brand.tone && <div><dt>Tone of Voice</dt><dd>{c.client.brand.tone}</dd></div>}
              {c.client.brand.audience && <div><dt>Target Audience</dt><dd>{c.client.brand.audience}</dd></div>}
              {c.client.brand.pillars && <div><dt>Content Pillars</dt><dd>{c.client.brand.pillars}</dd></div>}
              {c.client.brand.dos && <div><dt>Do’s</dt><dd>{c.client.brand.dos}</dd></div>}
              {c.client.brand.donts && <div><dt>Don’ts</dt><dd>{c.client.brand.donts}</dd></div>}
            </dl>
          </Panel>
        )}
      </div>

      <div>
        <Panel title="Story Specifications">
          <dl className="detail-grid">
            <div><dt>Content Code</dt><dd><code>{c.code}</code></dd></div>
            <div><dt>Format</dt><dd>{c.type}</dd></div>
            <div><dt>Platform</dt><dd>{c.platform}</dd></div>
            <div><dt>Content Pillar</dt><dd>{c.pillar||'General'}</dd></div>
            <div><dt>Target Publish</dt><dd>{dateLabel(c.publishAt)} · {timeLabel(c.publishAt)}</dd></div>
            <div><dt>Production Route</dt><dd>{c.requiresShoot ? 'Requires on-location shoot' : 'Digital design / direct editing'}</dd></div>
          </dl>
        </Panel>

        <TeamPanel c={c} />
      </div>
    </div>
  );
}
