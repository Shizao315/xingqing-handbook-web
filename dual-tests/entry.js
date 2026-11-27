'use strict';
const by=id=>document.getElementById(id), utf=new TextEncoder(),decode64=s=>Uint8Array.from(atob(s),v=>v.charCodeAt(0));
const storeKey='xingqing.dualtests.v1';
let grants={},settings,openSeq=0;
const preferred=new URLSearchParams(location.search).get('test');
function remember(){try{localStorage.setItem(storeKey,JSON.stringify(grants))}catch{by('status').textContent='当前浏览器无法记住权限，请保持页面打开。'}}
async function hash(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',utf.encode(text)))}
async function unseal(key,data){
 const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['decrypt']);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},aes,data.slice(12)));
}
function allKeys(){return Object.assign({},...Object.values(grants).map(g=>g.keys))}
function library(){
 const list=by('list');list.replaceChildren();
 for(const k of Object.keys(allKeys())){
  if(!Object.hasOwn(settings.titles,k))continue;
  const b=document.createElement('button');b.className='entry';b.textContent=settings.titles[k]+'  →';b.onclick=()=>openTest(k);list.append(b);
 }
 by('library').hidden=!list.children.length;
}
async function openTest(k){
 const seq=++openSeq;
 try{
  const response=await fetch('content/'+encodeURIComponent(k)+'.dat');
  if(!response.ok)throw Error();
  const html=await unseal(decode64(allKeys()[k]),new Uint8Array(await response.arrayBuffer()));
  if(seq!==openSeq)return;
  by('frame').srcdoc=html;by('reader').hidden=false;by('back').focus();
 }catch{if(seq===openSeq)by('status').textContent='测试读取失败，请重新打开入口再试。'}
}
function closeReader(){openSeq++;by('reader').hidden=true;by('frame').removeAttribute('srcdoc');by('library').scrollIntoView()}
window.addEventListener('popstate',()=>{if(!by('reader').hidden)closeReader()});
by('back').onclick=closeReader;
async function start(){
 const r=await fetch('settings.json',{cache:'no-store'});if(!r.ok)throw Error();
 settings=await r.json();
 try{grants=JSON.parse(localStorage.getItem(storeKey))||{}}catch{}
 library();
 if(preferred&&allKeys()[preferred])await openTest(preferred);
}
const ready=start().catch(()=>{by('status').textContent='入口加载失败，请刷新页面。'});
by('form').onsubmit=async e=>{
 e.preventDefault();await ready;if(!settings)return;
 const code=by('code').value.replace(/[\s-]/g,'').toUpperCase();by('status').textContent='';
 if(!/^[A-F0-9]{32}$/.test(code)){by('status').textContent='请粘贴完整的 32 位兑换码。';return}
 by('submit').disabled=true;
 try{
  const id=Array.from(await hash('lookup:'+code),n=>n.toString(16).padStart(2,'0')).join('');
  let bytes;
  if(settings.mode==='shared'){
   const r=await fetch('vouchers/'+id+'.dat');if(r.status===404)throw Error('兑换码无效，请核对订单。');if(!r.ok)throw Error();bytes=new Uint8Array(await r.arrayBuffer());
  }else{
   let device=localStorage.getItem('xingqing.device');
   if(!device){device=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem('xingqing.device',device)}
   const r=await fetch(settings.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,device})});
   if(r.status===409||r.status===404)throw Error('兑换码无效或已在其他浏览器领取。');if(!r.ok)throw Error();bytes=decode64((await r.json()).packet);
  }
  const grant=JSON.parse(await unseal(await hash('open:'+code),bytes));
  grants[grant.sku]=grant;by('code').value='';by('status').textContent='已解锁「'+grant.title+'」。';remember();library();
  const ids=Object.keys(grant.keys);
  if(preferred&&grant.keys[preferred])await openTest(preferred);else if(ids.length===1)await openTest(ids[0]);else by('library').scrollIntoView({behavior:'smooth'});
 }catch(err){by('status').textContent=err.message?.startsWith('兑换码')?err.message:'兑换未完成，请检查网络并重试。'}
 finally{by('submit').disabled=false}
};
