// Read-only public release verification. No registration, pairing, send, join or funding.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='https://pappy-earnig-hub.duckdns.org',checks=[],errors=[];
async function check(name,fn){await fn();checks.push({name,passed:true});}
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await check('TLS health is v0.6.0',async()=>{const r=await page.request.get(origin+'/api/health');assert.equal(r.status(),200);assert.equal((await r.json()).version,'0.6.0');});
 const status=await (await page.request.get(origin+'/api/status')).json();
 for(const key of ['paidBroadcasts','queueWorkerActive','payments','payouts'])await check(key+' remains OFF',async()=>assert.equal(status[key],false));
 await check('personal pilot configured separately from paid dispatch',async()=>{assert.equal(status.whatsapp,true);assert.equal(status.personalBroadcasts,true);});
 for(const endpoint of ['/whatsapp','/broadcasts','/broadcasts/private','/broadcast-assets/private','/personal-posts/private/events','/earnings','/admin/treasury'])await check(endpoint+' rejects anonymous access',async()=>assert.equal((await page.request.get(origin+'/api'+endpoint)).status(),401));
 await check('anonymous pairing request cannot start a socket',async()=>{const r=await page.request.post(origin+'/api/whatsapp/pair',{headers:{'X-Requested-With':'PappyWeb'},data:{}});assert.equal(r.status(),401);});
 for(const endpoint of ['/personal-posts/prepare','/personal-posts/ignores','/personal-posts'])await check(endpoint+' cannot mutate without authentication',async()=>{const r=await page.request.post(origin+'/api'+endpoint,{headers:{'X-Requested-With':'PappyWeb'},data:{}});assert.equal(r.status(),401);});
 await check('no public fabricated receipt endpoint',async()=>{const r=await page.request.post(origin+'/api/earnings/delivery-confirmed',{headers:{'X-Requested-With':'PappyWeb'},data:{verified:true}});assert.equal(r.status(),404);});
 await check('cross-origin mutation remains blocked',async()=>{const r=await page.request.post(origin+'/api/whatsapp/pair',{headers:{Origin:'https://evil.example','X-Requested-With':'PappyWeb'},data:{}});assert.equal(r.status(),403);});
 await check('desktop landing loads without horizontal overflow',async()=>{await page.goto(origin);await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('landing keeps decoration automatic with no design labels/playback controls',async()=>{assert.equal(await page.getByRole('button',{name:/Pause movement|Play movement/i}).count(),0);assert.equal(await page.getByText(/3D-style illustration/i).count(),0);await page.screenshot({path:'docs/screenshots/international-live-landing-desktop.png',fullPage:true});});
 await check('international landing leads with Coins and a qualified 1,000-Coin example',async()=>{assert.equal(await page.getByRole('heading',{name:/1,000-Coin day/}).count(),1);assert.match(await page.locator('.potential-example').innerText(),/Paid jobs and cashout are not open yet/);assert.doesNotMatch(await page.locator('main').innerText(),/₦|\bNGN\b|naira/i);});
 await check('landing explains that personal posts are free and paid jobs are not open',async()=>{assert.match(await page.locator('.hero-availability').innerText(),/Your own posts are free/);assert.match(await page.locator('.hero-availability').innerText(),/withdrawals are not open/);});
 await check('public licence retains original author and upstream terms',async()=>{await page.goto(origin+'/#/plogme-license');await page.getByRole('heading',{name:'Plogme attribution and licence.'}).waitFor();assert.match(await page.locator('main').innerText(),/Crysnovax/);assert.match(await page.locator('pre').innerText(),/CRYSNOVAX SOURCE LICENSE/);});
 await check('public service status identifies an owner-testing pilot, not verified paid delivery',async()=>{await page.goto(origin+'/#/status');await page.getByText('Owner-testing pilot',{exact:true}).waitFor();});
 await check('390px landing remains inside viewport',async()=>{await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('protected composer directs unauthenticated visitors to login',async()=>{await page.goto(origin+'/#/app/broadcasts');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Queue personal/}).count(),0);});
 await check('no uncaught public browser application error',async()=>assert.deepEqual(errors,[]));
}finally{await fs.writeFile('docs/testing/international-domain-readonly.json',JSON.stringify({origin,at:new Date().toISOString(),checks,notes:'Read-only public verification; no accounts created, no phone entered, no pairing, messages, joining, deposits, earning or payouts.'},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.length,accountsCreated:0,whatsappRequests:0}));
