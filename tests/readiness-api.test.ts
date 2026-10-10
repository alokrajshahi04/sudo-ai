import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
test('Readiness acknowledgement belongs to the session and web launch gates are enforced before model execution', async()=>{
 const port=3307,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','tests/fixtures/api-runner.ts'],{env:{...process.env,PORT:String(port),GOOGLE_API_KEY:'fixture-google-key',NEBIUS_API_KEY:'',CUSTOM_MODEL_API_KEY:'',ELEVENLABS_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup timed out')),15000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('Sudo Launch local API')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture exited'));});});
  const setup=await fetch(base+'/api/capabilities');const cookie=setup.headers.get('set-cookie')!.split(';')[0];
  const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json'};
  const post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
  let job=await(await post('/api/jobs',{repository:'https://github.com/fixture/app',launchBrief:{audience:'Students',goal:'Find testers',context:''}})).json();
  const root=`/api/jobs/${job.id}`;
  async function poll(){for(let i=0;i<100;i++){job=await(await fetch(base+root,{headers:{Cookie:cookie}})).json();if(!Object.values(job.phases).some((p:any)=>p.state==='running'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Job timed out');}
  await poll();
  let response=await post(root+'/position',{provider:'google'});assert.equal(response.status,409);assert.match((await response.json()).error,/acknowledge/);
  response=await fetch(base+root+'/readiness-review',{method:'POST',headers:{...headers,Cookie:''},body:JSON.stringify({acknowledged:true})});assert.equal(response.status,404);
  response=await post(root+'/readiness-review',{acknowledged:true});assert.equal(response.status,200);
  response=await post(root+'/position',{provider:'google'});assert.equal(response.status,409);assert.match((await response.json()).error,/Deploy/);
  response=await post(root+'/capture',{url:'https://example.com',approved:false,steps:[]});assert.equal(response.status,400);
  response=await post(root+'/launch-mode',{mode:'source'});assert.equal(response.status,200);
  response=await post(root+'/position',{provider:'google'});assert.equal(response.status,409);
  response=await post(root+'/launch-mode',{mode:'prototype'});assert.equal(response.status,200);
  response=await post(root+'/position',{provider:'google'});assert.equal(response.status,202);await poll();assert.equal(job.phases.position.state,'completed');assert.equal(job.positioning.angles.length,2);
  response=await fetch(base+root+'/calendar?start='+encodeURIComponent(new Date(Date.now()+86400000).toISOString()),{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.match(await response.text(),/BEGIN:VCALENDAR/);
  response=await fetch(base+root+'/calendar?start='+encodeURIComponent(new Date(Date.now()+86400000).toISOString()));assert.equal(response.status,404);
  if(spawnSync('ffmpeg',['-version']).status===0){
   const image=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=160x120','-frames:v','1','-threads','1','-f','image2pipe','-vcodec','png','pipe:1']).stdout;
   response=await fetch(base+root+'/screenshot',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png'},body:image});assert.equal(response.status,202);await poll();assert.equal(job.phases.recording.state,'completed');assert.ok(job.artifacts.some((a:any)=>a.type==='screenshot'));
   response=await fetch(base+root+'/assets/screenshot',{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).subarray(1,4).toString(),'PNG');
   response=await fetch(base+root+'/assets/screenshot');assert.equal(response.status,404);
   response=await fetch(base+root+'/assets/screenshot',{headers:{Cookie:cookie,Range:'bytes=0-7'}});assert.equal(response.status,206);assert.match(response.headers.get('content-range')!,/^bytes 0-7\//);assert.equal((await response.arrayBuffer()).byteLength,8);
   response=await fetch(base+root+'/assets/screenshot',{headers:{Cookie:cookie,Range:'bytes=999999999-'}});assert.equal(response.status,416);
   response=await fetch(base+root+'/assets/screenshot',{headers:{Cookie:cookie,Range:'bytes=0-3,10-15'}});assert.equal(response.status,416);

   response=await fetch(base+root+'/screenshot',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png'},body:Buffer.from('not-an-image')});assert.equal(response.status,202);await poll();assert.equal(job.phases.recording.state,'failed');assert.equal(job.phases.position.state,'completed');assert.ok(job.artifacts.some((a:any)=>a.type==='screenshot'));
   const receipt=await(await fetch(base+root+'/receipt',{headers:{Cookie:cookie}})).json();assert.equal(receipt.actualExecution.automaticCapture,false);
  }
  await post(root+'/inspect',{});await poll();assert.equal(job.readinessReviewedAt,undefined);
 } finally {child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
});
