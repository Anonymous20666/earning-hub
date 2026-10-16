import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGrowthUrlPost} from '../shared/growthPost';
import {validateGrowthInput,type GrowthProduct} from '../shared/growthRules';
import {validateDraft} from '../shared/rules';
import {fixture,input,draft,accepted} from './growth-fixtures';
import {growthDetail} from '../backend/growth';

test('all four growth products post only the destination URL, never legacy captions, messages or the private campaign label',()=>{
 for(const [product,destination] of [['WA_GROUP','https://chat.whatsapp.com/SyntheticInvite123'],['WA_CHANNEL','https://whatsapp.com/channel/SyntheticChannel123'],['TG_GROUP','https://t.me/SyntheticGroup'],['TG_CHANNEL','https://t.me/SyntheticChannel']] as [GrowthProduct,string][]){
  const untrusted={product,destination,message:'DO NOT SEND',caption:'DO NOT SEND',title:'PRIVATE CAMPAIGN LABEL'};
  const post=buildGrowthUrlPost(untrusted);
  assert.deepEqual(post,{kind:'DESTINATION_URL',product,text:destination,previewUrl:destination});
  assert.equal('caption' in post,false);assert.equal('message' in post,false);
 }
});
test('new growth drafts need no caption and strip obsolete advertiser-written content',()=>{
 const validated=validateGrowthInput({...input(),message:'Obsolete input',caption:'Obsolete caption'});assert.equal('message' in validated,false);assert.equal('caption' in validated,false);
 const db=fixture();try{const o=draft(db);assert.equal(o.post.text,o.input.destination);assert.equal('message' in o.input,false);}finally{db.close()}
});
test('historic local drafts cannot reintroduce an old message into returned instructions or planned post text',()=>{const db=fixture();try{const o=draft(db);db.prepare('UPDATE growth_orders SET input_json=? WHERE id=?').run(JSON.stringify({...o.input,message:'LEGACY PRIVATE TEXT',caption:'LEGACY PRIVATE TEXT'}),o.id);const current=growthDetail(db,o.id,'buyer');assert.equal('message' in current.input,false);assert.equal('caption' in current.input,false);assert.equal(current.post.text,o.input.destination);}finally{db.close()}});
test('fixed growth quote freezes a URL-only post instruction and does not generate imaginary artwork',()=>{const db=fixture();try{const o=accepted(db);assert.equal(o.quote!.plan.post.text,o.input.destination);assert.equal(o.quote!.plan.post.kind,'DESTINATION_URL');assert.equal('caption' in o.quote!.plan.post,false);assert.equal('image' in o.quote!.plan.post,false);}finally{db.close()}});
test('legacy smart planner ignores its former caption while direct-session messaging remains unchanged',()=>{const base={title:'Synthetic private label',targetUrl:'https://chat.whatsapp.com/SyntheticInvite123',platform:'WA_GROUP',mode:'ALLSTATUS_1X',tier:'BRONZE',sessionCount:1,volume:200,countryFilter:'RANDOM',countries:[]};assert.equal(validateDraft({...base,pathway:'SMART_VERIFIED',caption:'This must not be posted'}).caption,'');assert.equal(validateDraft({...base,pathway:'SMART_VERIFIED'}).caption,'');assert.equal(validateDraft({...base,pathway:'DIRECT_SESSION',caption:'A direct-session advertisement'}).caption,'A direct-session advertisement');assert.throws(()=>validateDraft({...base,pathway:'DIRECT_SESSION'}),/caption/);});
