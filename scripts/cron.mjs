import 'dotenv/config';
if(!process.env.APP_URL||!process.env.CRON_SECRET)throw new Error('APP_URL and CRON_SECRET are required.');
const response=await fetch(process.env.APP_URL+'/api/jobs/run',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(9*60000)});
if(!response.ok)throw new Error('Maintenance endpoint returned HTTP '+response.status);
console.log(await response.json());

