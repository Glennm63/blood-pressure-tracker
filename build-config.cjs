const fs=require('node:fs');
function config(env){
 const url=new URL(env.SUPABASE_URL||'');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('SUPABASE_URL must be an HTTPS project origin.');
 const key=env.SUPABASE_PUBLISHABLE_KEY||'';
 let valid=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 if(!valid){try{valid=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}}
 if(!valid)throw Error('Use a Supabase publishable key or legacy anon key. Never use a secret or service-role key.');
 return {url:url.origin,key};
}
if(require.main===module){try{const value=config(process.env);fs.writeFileSync(__dirname+'/public/config.js','window.PRESSURE_CONFIG='+JSON.stringify(value)+';\n');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports=config;
