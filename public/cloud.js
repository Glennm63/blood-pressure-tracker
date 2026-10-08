'use strict';
let loginEmail='',loadId=0,legacy=[];
function controls(){
 for(const selector of ['#add','#delete','#csv','#backup','#restore','#migrate'])$(selector).disabled=!ready||busy;
 for(const button of form.querySelectorAll('button,input,textarea'))button.disabled=busy;
 $('#signOut').disabled=busy;$('#refresh').disabled=busy||!user;$('#toolsOpen').disabled=!user;
}
function checkAccount(owner,generation){if(!user||user.id!==owner||epoch!==generation)throw Error('Your account changed. Sign in again to view the saved result.');}
function localReadings(){
 try{const raw=localStorage.getItem(KEY);if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list)||!list.every(valid)||new Set(list.map(r=>r.id)).size!==list.length)throw Error();return list;}
 catch{$('#cloudStatus').textContent='Old device readings could not be read. The existing data has been left untouched. You can import a JSON backup from Options.';return [];}
}
function showMigration(){
 legacy=localReadings();let migrated=false;
 try{migrated=localStorage.getItem('pressure-migrated-'+user.id)==='true';}catch{}
 $('#migration').classList.toggle('hidden',!legacy.length||migrated);
 $('#migrationInfo').textContent=`This browser contains ${legacy.length} old readings. Upload them to ${user.email} only if they belong to you. The old copy will be kept.`;
}
async function loadReadings(){
 if(!user)return;
 const owner=user.id,generation=epoch,request=++loadId;ready=false;controls();$('#cloudStatus').textContent='Loading cloud readings…';
 try{
  const all=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await client.from('pressure_readings').select('user_id,id,sys,dia,pulse,time,note').eq('user_id',owner).order('time',{ascending:false}).order('id').range(offset,offset+999);
   if(error)throw error;checkAccount(owner,generation);if(request!==loadId)return;
   if(!Array.isArray(data)||data.some(r=>r.user_id!==owner||!valid(r)))throw Error('Cloud readings could not be verified.');
   all.push(...data.map(({user_id,...r})=>r));if(data.length<1000)break;
  }
  readings=all;ready=true;render();$('#cloudStatus').textContent='Cloud readings loaded. Changes save directly to your account.';showMigration();
 }catch(e){if(user?.id===owner&&epoch===generation&&request===loadId){readings=[];render();$('#cloudStatus').textContent='Could not load cloud readings. Check your connection, then choose Options → Refresh cloud readings. '+(e.message||'');}}
 finally{if(request===loadId)controls();}
}
async function useSession(session){
 const next=session?.user||null;if(next?.id===user?.id&&ready)return;
 epoch++;loadId++;user=next;ready=false;readings=[];editing=null;limit=10;entry.close();$('#options').close();render();
 $('#authBox').classList.toggle('hidden',!!user);$('#workspace').classList.toggle('hidden',!user);$('#accountEmail').textContent=user?.email||'';controls();
 if(user){$('#codeForm').reset();await loadReadings();}
}
async function writeToCloud(action){
 if(!ready||!user)throw Error('Sign in and load your cloud readings first.');if(busy)throw Error('A save is already in progress.');
 const owner=user.id,generation=epoch;busy=true;controls();$('#cloudStatus').textContent='Saving to your account…';
 try{const result=await action(owner);checkAccount(owner,generation);if(result.error)throw result.error;return result.data;}
 catch(e){if(user?.id===owner&&epoch===generation)$('#cloudStatus').textContent='Save was not confirmed. Keep the entry open and retry when online. '+(e.message||'');throw e;}
 finally{busy=false;controls();}
}
async function saveReading(r){
 const data=await writeToCloud(owner=>client.from('pressure_readings').upsert({...r,user_id:owner},{onConflict:'user_id,id'}).select('id,sys,dia,pulse,time,note').single());
 if(!data||!valid(data))throw Error('Save could not be verified. Refresh your cloud readings.');
 readings=[...readings.filter(old=>old.id!==r.id),data];render();$('#cloudStatus').textContent='Saved to your account.';
}
async function deleteReading(id){
 const data=await writeToCloud(owner=>client.from('pressure_readings').delete().eq('user_id',owner).eq('id',id).select('id'));
 if(!Array.isArray(data))throw Error('Deletion could not be verified.');readings=readings.filter(r=>r.id!==id);render();$('#cloudStatus').textContent='Reading deleted from your account.';
}
async function importReadings(list){
 if(!Array.isArray(list)||list.length>20000||!list.every(valid))throw Error('Invalid readings.');
 if(!list.length)return;
 await writeToCloud(owner=>client.from('pressure_readings').upsert(list.map(r=>({id:r.id,sys:r.sys,dia:r.dia,pulse:r.pulse,time:r.time,note:r.note,user_id:owner})),{onConflict:'user_id,id',ignoreDuplicates:true}));
 await loadReadings();if(!ready)throw Error('Upload was acknowledged, but reloading failed. Refresh cloud readings before retrying.');
}
$('#migrate').onclick=async()=>{
 if(!ready||busy)return;const owner=user.id;
 if(!confirm(`Upload ${legacy.length} existing readings to ${user.email}? Continue only if these readings belong to you.`))return;
 try{await importReadings(legacy);if(user?.id!==owner)return;try{localStorage.setItem('pressure-migrated-'+owner,'true');}catch{}$('#migration').classList.add('hidden');toast('Existing readings uploaded. Old device copy kept.');}
 catch(e){$('#cloudStatus').textContent=e.message;}
};
$('#refresh').onclick=()=>loadReadings();
$('#signOut').onclick=async()=>{
 if(busy)return;
 const {error}=await client.auth.signOut({scope:'local'});
 if(error){$('#cloudStatus').textContent='Could not sign out. '+error.message;return;}
 await useSession(null);$('#emailForm').reset();$('#codeForm').classList.add('hidden');$('#emailForm').classList.remove('hidden');$('#authError').textContent='';
};
$('#emailForm').onsubmit=async e=>{
 e.preventDefault();$('#authError').textContent='';$('#sendCode').disabled=true;
 try{if(!client)throw Error('Cloud storage is not configured.');loginEmail=$('#email').value.trim();const {error}=await client.auth.signInWithOtp({email:loginEmail,options:{shouldCreateUser:true}});if(error)throw error;$('#emailForm').classList.add('hidden');$('#codeForm').classList.remove('hidden');$('#codeHint').textContent=`Enter the sign-in code sent to ${loginEmail}.`;$('#code').focus();}
 catch(e){$('#authError').textContent=e.message;}
 finally{$('#sendCode').disabled=!client;}
};
$('#changeEmail').onclick=()=>{$('#codeForm').classList.add('hidden');$('#emailForm').classList.remove('hidden');$('#code').value='';$('#authError').textContent='';};
$('#codeForm').onsubmit=async e=>{
 e.preventDefault();$('#authError').textContent='';$('#verifyCode').disabled=true;
 try{const {data,error}=await client.auth.verifyOtp({email:loginEmail,token:$('#code').value.trim(),type:'email'});if(error)throw error;if(!data.session)throw Error('Sign-in was not completed.');await useSession(data.session);}
 catch(e){$('#authError').textContent=e.message;}
 finally{$('#verifyCode').disabled=false;}
};
async function startCloud(){
 controls();
 try{
  const config=window.PRESSURE_CONFIG;if(!config?.url||!config?.key)throw Error('Cloud storage has not been configured yet.');
  if(!window.supabase?.createClient)throw Error('The sign-in service could not load. Reopen the app online.');
  client=window.supabase.createClient(config.url,config.key,{auth:{detectSessionInUrl:false}});
  client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>useSession(session),0);});
  const {data,error}=await client.auth.getSession();if(error)throw error;await useSession(data.session);$('#sendCode').disabled=false;
 }catch(e){$('#authError').textContent=e.message;}
}
startCloud();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
