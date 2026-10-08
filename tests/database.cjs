const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
 await db.exec(fs.readFileSync('database/schema.sql','utf8'));
 const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
 async function actor(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
 async function rejected(q,args=[]){await assert.rejects(()=>db.query(q,args));}
 await actor(a);await db.query("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'one',120,80,now())",[a]);
 await rejected("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'foreign',120,80,now())",[b]);
 await rejected('update pressure_readings set user_id=$1 where id=\'one\'',[b]);
 await rejected("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'bad',70,80,now())",[a]);
 await rejected("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'future',120,80,now()+interval '1 day')",[a]);
 await actor(b);assert.equal((await db.query('select * from pressure_readings')).rows.length,0);
 assert.equal((await db.query("update pressure_readings set sys=130 where id='one' returning id")).rows.length,0);
 assert.equal((await db.query("delete from pressure_readings where id='one' returning id")).rows.length,0);
 await db.query("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'one',130,85,now())",[b]);
 await actor(a);assert.equal((await db.query('select sys from pressure_readings')).rows[0].sys,120);
 await db.query("update pressure_readings set sys=125 where id='one'");assert.equal((await db.query('select sys from pressure_readings')).rows[0].sys,125);
 await db.exec('reset role;set role anon');await rejected('select * from pressure_readings');await rejected("insert into pressure_readings(user_id,id,sys,dia,time) values ($1,'anon',120,80,now())",[a]);
 await actor('');assert.equal((await db.query('select * from pressure_readings')).rows.length,0);
 await actor(a);await db.query("delete from pressure_readings where id='one'");assert.equal((await db.query('select * from pressure_readings')).rows.length,0);
 await actor(b);assert.equal((await db.query('select sys from pressure_readings')).rows[0].sys,130);
 await db.close();console.log('PASS: PostgreSQL row security denies cross-user read/write/delete/reassignment and unauthenticated access; validates values and permits owner CRUD.');
})().catch(e=>{console.error(e);process.exitCode=1;});
