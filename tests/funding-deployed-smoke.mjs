// Authorised temporary browser verification. No production administrator or funding is created.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
const origin='https://pappy-earnig-hub.duckdns.org';
const browser=await chromium.launch({headless:true});const accounts=[],checks=[],errors=[];
const password=randomBytes(24).toString('base64url')+'!';
async function checked(name,fn){await fn();checks.push({name,passed:true});}
async function signup(page,role='worker',link){
 const email=`qa-funding-${randomBytes(9).toString('hex')}@example.test`;
 await page.goto(link||origin+'/#/join/'+role);await page.getByLabel('Full name',{exact:true}).fill('Deployment verification');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('heading',{level:1,name:'A little progress, every day.'}).waitFor();
 const response=await page.request.get(origin+'/api/auth/session');assert.equal(response.status(),200);const session=await response.json();accounts.push({id:session.user.id,email});await fs.writeFile('/home/user/funding-production-test-accounts.json',JSON.stringify(accounts));return {email,session};
}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await checked('TLS health is v0.2.0 pre-launch',async()=>{const r=await page.request.get(origin+'/api/health');assert.equal(r.status(),200);assert.equal((await r.json()).version,'0.2.0');});
 await checked('worker registration and protected session',async()=>{await signup(page);});
 await checked('secure HttpOnly same-site session cookie',async()=>{const c=(await ctx.cookies()).find(c=>c.name==='pappy_session');assert.ok(c?.httpOnly&&c.secure&&c.sameSite==='Lax');});
 await page.goto(origin+'/#/app/calculator');await page.getByRole('button',{name:'Try a four-group example'}).waitFor();
 await checked('calculator starts empty without artificial earnings',async()=>assert.equal(await page.locator('.earning-result-amount strong').textContent(),'0.000'));
 await checked('four agreed groups total exactly 1.290 Coins',async()=>{await page.getByRole('button',{name:'Try a four-group example'}).click();await page.waitForFunction(()=>document.querySelector('.earning-result-amount strong')?.textContent==='1.290');});
 await checked('ten hypothetical broadcasts total 12.900 Coins',async()=>{await page.getByLabel('Hypothetical broadcasts in one day').selectOption('10');assert.match(await page.locator('.earning-result-rows').textContent(),/12.900 Coins/);});
 await page.screenshot({path:'docs/screenshots/funding-domain-1440-calculator.png',fullPage:true});
 await checked('calculator does not credit wallet',async()=>{const r=await page.request.get(origin+'/api/workspace');assert.equal((await r.json()).wallet.earned_milli,0);});
 await page.goto(origin+'/#/app/connections');await page.getByRole('heading',{name:'No groups scanned yet.'}).waitFor();
 await checked('two real empty number slots and no invented group inventory',async()=>{assert.equal(await page.locator('.number-slot').count(),2);const r=await page.request.get(origin+'/api/earnings');const e=await r.json();assert.equal(e.accounts.length,0);assert.equal(e.groups.length,0);assert.equal(e.summary.uniqueQualified,0);assert.equal(e.providerConfigured,false);assert.equal(e.dispatchEnabled,false);});
 await checked('desktop has no horizontal document overflow',async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true));
 await page.goto(origin+'/#/app/referrals');await page.getByLabel('Your referral link').waitFor();await page.waitForFunction(()=>document.querySelector('#referral-link')?.value.includes('ref='));const link=await page.getByLabel('Your referral link').inputValue();
 await checked('real invite URL has a unique worker code',async()=>assert.match(link,/^https:\/\/pappy-earnig-hub.duckdns.org\/#\/join\/worker\?ref=[a-f0-9]{20}$/));
 const friendCtx=await browser.newContext({viewport:{width:390,height:844}}),friend=await friendCtx.newPage();
 await checked('share link registration succeeds as worker with referral attributed',async()=>{await signup(friend,'worker',link);});
 await checked('header refresh loads exactly 5.000 pending and zero earned referral Coins',async()=>{await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.earning-stat strong')[1]?.textContent==='5.000');const response=await page.request.get(origin+'/api/earnings');const e=await response.json();assert.equal(e.referrals.total,1);assert.equal(e.referrals.pending_milli,5000);assert.equal(e.referrals.earned_milli,0);});
 await checked('worker cannot access treasury',async()=>assert.equal((await page.request.get(origin+'/api/admin/treasury')).status(),403));
 await checked('pairing and withdrawals remain blocked without debiting',async()=>{const s=await (await page.request.get(origin+'/api/auth/session')).json();for(const endpoint of ['pairing','withdrawals']){const r=await page.request.post(origin+'/api/'+endpoint,{headers:{'X-Requested-With':'PappyWeb','X-CSRF-Token':s.csrf},data:{amount:500}});assert.equal(r.status(),503);}const w=await (await page.request.get(origin+'/api/workspace')).json();assert.equal(w.wallet.earned_milli,0);assert.equal(w.wallet.locked_milli,200000);});
 await checked('browser cannot forge delivery confirmation',async()=>{const s=await (await page.request.get(origin+'/api/auth/session')).json();const r=await page.request.post(origin+'/api/earnings/delivery-confirmed',{headers:{'X-Requested-With':'PappyWeb','X-CSRF-Token':s.csrf},data:{verified:true,rewardMilli:500000}});assert.equal(r.status(),404);});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/#/app/connections');await page.getByRole('heading',{name:'No groups scanned yet.'}).waitFor();
 await checked('390px mobile connection page has no horizontal overflow',async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true));await page.screenshot({path:'docs/screenshots/funding-domain-390-connections.png',fullPage:true});
 await page.goto(origin+'/#/app/referrals');await page.getByLabel('Your referral link').waitFor();
 await checked('390px referral link stays inside viewport',async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true));
 const adCtx=await browser.newContext({viewport:{width:1440,height:1000}}),ad=await adCtx.newPage();
 await checked('advertiser registration and previous workspace remain usable',async()=>{const {session}=await signup(ad,'advertiser');assert.equal(session.user.role,'ADVERTISER');await ad.goto(origin+'/#/app/campaigns');await ad.getByRole('heading',{level:1,name:'Good growth starts with a plan.'}).waitFor();});
 await checked('public provider status truthfully remains disabled',async()=>{const s=await (await page.request.get(origin+'/api/status')).json();for(const key of ['paidBroadcasts','queueWorkerActive','whatsapp','payments','payouts'])assert.equal(s[key],false);});
 await checked('no uncaught browser application errors',async()=>assert.deepEqual(errors,[]));
}finally{
 await fs.writeFile('docs/testing/funding-stage-domain-browser.json',JSON.stringify({origin,at:new Date().toISOString(),checks,temporaryTestAccounts:accounts.length,notes:'Temporary deployment-verification accounts only. No live admin, paired account, funding or paid earning created. Cleanup is recorded separately.'},null,2));
 await browser.close();
}
console.log(JSON.stringify({passed:checks.length,temporaryAccounts:accounts.length}));
