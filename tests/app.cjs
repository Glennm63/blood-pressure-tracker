const {JSDOM}=require('jsdom'),vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8'),cloud=fs.readFileSync('public/cloud.js','utf8');
const dom=new JSDOM(html,{url:'https://pressure.test/',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
let account=null,fail=false,hold=null;const records=new Map();
function table(){let mode='read',payload,filters={},ignore=false,single=false,start=0,end=999,columns='*';const q={
 select(c){columns=c;return this},eq(k,v){filters[k]=v;return this},order(){return this},range(a,b){start=a;end=b;return this},single(){single=true;return this},
 upsert(p,opts){mode='write';payload=Array.isArray(p)?p:[p];ignore=!!opts.ignoreDuplicates;return this},delete(){mode='delete';return this},
 then(resolve,reject){const execute=async()=>{if(hold){const wait=hold;hold=null;await wait;}if(fail)return {error:{message:'Network unavailable'},data:null};if(!account)return {error:{message:'Unauthenticated'}};
 let rows=[...records.values()].filter(r=>r.user_id===account.id&&Object.entries(filters).every(([k,v])=>r[k]===v));
 if(mode==='write'){for(const r of payload){if(r.user_id!==account.id)return {error:{message:'RLS denied'}};const key=r.user_id+':'+r.id;if(!ignore||!records.has(key))records.set(key,{...r});}rows=payload.map(r=>records.get(r.user_id+':'+r.id));}
 if(mode==='delete'){for(const r of rows)records.delete(r.user_id+':'+r.id);}
 rows=rows.slice(start,end+1).map(r=>columns==='*'?{...r}:Object.fromEntries(columns.split(',').map(k=>[k,r[k]])));
 return {data:single?rows[0]:rows,error:null};};return execute().then(resolve,reject)}
 };return q;}
const client={from:table,auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null},error:null}),signInWithOtp:async()=>({error:null}),verifyOtp:async()=>({data:{session:{user:account}},error:null}),signOut:async()=>({error:null})}};
w.PRESSURE_CONFIG={url:'https://test.supabase.co',key:'sb_publishable_test'};w.supabase={createClient:()=>client};w.confirm=()=>true;
for(const node of w.document.querySelectorAll('script'))if(!node.src)new vm.Script(node.textContent).runInContext(ctx);
new vm.Script(cloud).runInContext(ctx);
const run=s=>vm.runInContext(s,ctx),$=s=>w.document.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,10));
const a={id:'user-a',email:'a@example.test'},b={id:'user-b',email:'b@example.test'};
(async()=>{
 await tick();assert($('#workspace').classList.contains('hidden'));
 account=a;await run('useSession({user:'+JSON.stringify(a)+'})');assert.equal($('#count').textContent,'0 readings');
 const f=$('#entryForm').elements;run('openEntry()');f.sys.value='120';f.dia.value='80';f.pulse.value='68';f.time.value=run('localTime()');f.note.value='<img src=x onerror=alert(1)>';
 await $('#entryForm').onsubmit({preventDefault(){}});assert.equal(records.size,1);assert.equal($('#average7').textContent,'120 / 80');assert($('#history').textContent.includes('<img'));assert.equal($('#history').querySelector('img'),null);
 const saved=[...records.values()][0];assert.equal(saved.user_id,a.id);assert.equal(w.localStorage.getItem('pressure-readings-v1'),null);
 fail=true;run('openEntry()');f.sys.value='130';f.dia.value='85';f.time.value=run('localTime()');await $('#entryForm').onsubmit({preventDefault(){}});assert.equal(records.size,1);assert.equal($('#entryError').textContent,'Network unavailable');assert($('#entry').open);fail=false;
 await $('#signOut').onclick();assert($('#workspace').classList.contains('hidden'));assert.equal(run('readings.length'),0);
 account=b;await run('useSession({user:'+JSON.stringify(b)+'})');assert.equal($('#count').textContent,'0 readings');assert(!$('#history').textContent.includes('<img'));
 account=a;await run('useSession({user:'+JSON.stringify(a)+'})');assert.equal($('#count').textContent,'1 reading');
 w.localStorage.clear();await run('useSession(null)');await run('useSession({user:'+JSON.stringify(a)+'})');assert.equal($('#average365').textContent,'120 / 80');
 const old={id:'legacy',sys:140,dia:90,pulse:null,time:new Date().toISOString(),note:'old device'};w.localStorage.setItem('pressure-readings-v1',JSON.stringify([old]));run('showMigration()');assert(!$('#migration').classList.contains('hidden'));await $('#migrate').onclick();assert.equal(records.size,2);assert.notEqual(w.localStorage.getItem('pressure-readings-v1'),null);
 await run('importReadings('+JSON.stringify([{...old,sys:160}])+')');assert.equal(records.get(a.id+':legacy').sys,140);assert.equal(records.size,2);
 account=b;await run('useSession({user:'+JSON.stringify(b)+'})');assert.equal($('#count').textContent,'0 readings');assert(!$('#migration').classList.contains('hidden'));account=a;await run('useSession({user:'+JSON.stringify(a)+'})');
 let release;hold=new Promise(r=>{release=r});const loading=run('loadReadings()');await run('useSession(null)');release();await loading;assert.equal(run('readings.length'),0);assert($('#workspace').classList.contains('hidden'));
 account=a;await run('useSession({user:'+JSON.stringify(a)+'})');await run('deleteReading("legacy")');assert.equal(records.size,1);assert.equal($('#average7').textContent,'120 / 80');
 const offsets=[0,6,7,29,30,364,365];run('readings='+JSON.stringify(offsets.map((offset,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-offset);return {id:String(i),sys:100+i*20,dia:60,pulse:null,time:d.toISOString(),note:''}}))+';render()');assert.equal($('#average7').textContent,'110 / 60');assert.equal($('#average30').textContent,'130 / 60');assert.equal($('#average365').textContent,'150 / 60');
 const configure=require('../build-config.cjs');assert.equal(configure({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}).url,'https://test.supabase.co');assert.throws(()=>configure({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}));assert.throws(()=>configure({SUPABASE_URL:'http://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}));assert.throws(()=>configure({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x'}));
 dom.window.close();console.log('PASS: cloud save acknowledgement, failure preserves entry, clear-browser recovery, account switch and stale-response isolation, migration confirmation/idempotence, backups, safe notes, deletion, averaging and configuration guards.');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
