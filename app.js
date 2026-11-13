'use strict';
const API='https://kie.timikid.com/product-studio-api';
const $=id=>document.getElementById(id);
const layouts={center:['Center','Bìa · Sản phẩm chủ lực'],grid:['Grid','Tính năng · Tổng hợp'],split:['Split','Công dụng · Giải thích'],z:['Z layout','Quảng cáo · Thông điệp'],f:['F layout','Hướng dẫn · Trình tự'],thirds:['Rule of Thirds','Lifestyle · Bối cảnh']};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=sessionStorage.getItem('studio-token')||'',current=null,files=[],step=1,pollTimer,editing=false;
const urls=new Map();
const ratioCss=r=>/^\d+:\d+$/.test(r||'')?r.replace(':',' / '):'1 / 1';
const diagram=(l,r='1:1')=>`<div class="diagram ${esc(l)}" style="--output-ratio:${ratioCss(r)}" aria-label="Minh họa bố cục ${esc(layouts[l]?.[0])}"><i></i><i></i><i></i><i></i></div>`;
const ratioDescriptions={'1:1':'Ảnh vuông 1:1 · Phù hợp ảnh bìa sản phẩm','4:5':'Ảnh dọc 4:5 · Phù hợp bài đăng mạng xã hội','3:4':'Ảnh dọc 3:4 · Phù hợp ảnh sản phẩm','9:16':'Ảnh dọc 9:16 · Phù hợp Story và màn hình điện thoại','16:9':'Ảnh ngang 16:9 · Phù hợp banner','4:3':'Ảnh ngang 4:3 · Phù hợp nội dung giới thiệu','3:2':'Ảnh ngang 3:2 · Phù hợp quảng cáo'};
document.querySelectorAll('[name="outputRatio"]').forEach(input=>input.onchange=()=>{$('ratio').value=input.value;$('ratioSummary').textContent=ratioDescriptions[input.value];});
$('planRatio').onchange=()=>{editing=true;document.querySelectorAll('#planCards .diagram').forEach(el=>el.style.setProperty('--output-ratio',ratioCss($('planRatio').value)));};
$('layoutLibrary').innerHTML=Object.entries(layouts).map(([k,v])=>`<div class="layout-tile">${diagram(k)}<strong>${v[0]}</strong><small>${v[1]}</small></div>`).join('');
function notice(msg,error=false){$('notice').hidden=!msg;$('notice').textContent=msg;$('notice').className=error?'error':'';}
async function api(path,body,blob=false){
 const r=await fetch(API+'/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});
 if(r.status===401){sessionStorage.removeItem('studio-token');$('login').showModal();throw Error('Vui lòng đăng nhập.');}
 if(!r.ok){const j=await r.json();throw Error(j.error||'Không thể kết nối máy chủ');}return blob?r.blob():r.json();
}
async function run(fn){try{await fn();}catch(e){notice(e.message,true);}}
function showStep(n){
 if(n>1&&!current){notice('Hãy tải tư liệu và tạo dự án trước.');return;}
 step=n;for(let i=1;i<=3;i++)$('step'+i).hidden=i!==n;$('projects').hidden=true;
 document.querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.step)===n));
 if(n===2)renderPlan();if(n===3)renderResults();
}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>showStep(Number(b.dataset.step)));
$('login').addEventListener('cancel',e=>e.preventDefault());
$('loginForm').onsubmit=async e=>{e.preventDefault();try{const r=await fetch(API+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});const j=await r.json();if(!r.ok)throw Error(j.error);token=j.token;sessionStorage.setItem('studio-token',token);$('password').value='';$('login').close();$('loginError').textContent='';}catch(e){$('loginError').textContent=e.message;}};
if(!token)$('login').showModal();
$('preview').onclick=()=>$('login').close();
$('logout').onclick=()=>{sessionStorage.removeItem('studio-token');location.reload();};
function addFiles(list){for(const f of list){if(files.length>=40){notice('Tối đa 40 ảnh tham khảo.',true);break;}if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>15*1024*1024){notice('Chỉ nhận PNG/JPG/WEBP, tối đa 15 MB mỗi ảnh.',true);continue;}files.push(f);}renderThumbs();}
function renderThumbs(){
 $('thumbs').innerHTML='';files.forEach((f,i)=>{const el=document.createElement('div');el.className='thumb';const img=document.createElement('img');img.src=URL.createObjectURL(f);img.onload=()=>URL.revokeObjectURL(img.src);img.alt=f.name;const label=document.createElement('small');label.textContent=f.name;const b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label','Bỏ '+f.name);b.onclick=()=>{files.splice(i,1);renderThumbs();};el.append(img,label,b);$('thumbs').append(el);});
}
$('references').onchange=e=>{addFiles(e.target.files);e.target.value='';};
for(const ev of ['dragover','dragleave','drop'])$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.toggle('dragging',ev==='dragover');if(ev==='drop')addFiles(e.dataTransfer.files);});
for(const role of ['shop','brand','frame'])$(role).onchange=()=>$(role+'Name').textContent=$(role).files[0]?.name||'Chọn ảnh';
const b64=f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(f);});
function clearImages(){for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();}
async function assetUrl(file){if(urls.has(file))return urls.get(file);const b=await api(`projects/${current.id}/file/${file}`,null,true);const u=URL.createObjectURL(b);urls.set(file,u);return u;}
async function hydrateImages(){const pid=current.id;for(const img of document.querySelectorAll('img[data-file]')){try{const url=await assetUrl(img.dataset.file);if(current?.id===pid&&img.isConnected)img.src=url;}catch{img.alt='Không tải được ảnh';}}}
$('analyze').onclick=()=>run(async()=>{
 if(!files.length||!$('productName').value.trim())throw Error('Thêm ảnh tham khảo và tên sản phẩm.');
 if(!$('analysisConsent').checked)throw Error('Cần đồng ý dùng credit để phân tích.');
 $('analyze').disabled=true;
 try{
  notice(`Đang tải ${files.length} ảnh…`);
  const assets=[];for(const f of files)assets.push({role:'reference',name:f.name,data:await b64(f)});
  for(const role of ['shop','brand','frame']){const f=$(role).files[0];if(f)assets.push({role,name:f.name,data:await b64(f)});}
  clearImages();current=await api('projects',{name:$('productName').value,facts:$('facts').value,style:$('style').value,count:Number($('count').value),ratio:$('ratio').value,assets});
  sessionStorage.setItem('studio-project',current.id);
  current=await api(`projects/${current.id}/analyze`,{consent:true});showStep(2);poll();
 }finally{$('analyze').disabled=false;}
});
function statusMessage(){if(!current)return;const busy=['analyzing','generating'].includes(current.status);notice(current.error||(busy?current.progress||'AI đang xử lý. Bạn có thể để trang này mở…':''),current.status==='error');document.querySelectorAll('#savePlan,#generateAll').forEach(b=>b.disabled=busy);}
function poll(){clearTimeout(pollTimer);statusMessage();if(!current)return;const pid=current.id;pollTimer=setTimeout(()=>run(async()=>{if(current?.id!==pid)return;const old=current.status;current=await api('projects/'+pid);statusMessage();if(current.status!==old){if(current.status==='planned'){showStep(2);}else if(step===3)renderResults();}else if(step===3)renderResults();if(['analyzing','generating'].includes(current.status))poll();}),4000);}
function renderPlan(){
 if(!current)return;editing=false;$('planRatio').value=current.ratio||'1:1';$('planTitle').textContent='Kế hoạch · '+current.name;$('summary').textContent=current.summary||'AI sẽ sắp xếp câu chuyện bộ ảnh tại đây.';
 $('warnings').textContent=Array.isArray(current.warnings)&&current.warnings.length?'Cần kiểm tra: '+current.warnings.join(' · '):'';
 $('planCards').innerHTML=(current.plan||[]).map((c,i)=>`<article class="plan-card" data-index="${i}"><div class="section-heading"><h2>${String(i+1).padStart(2,'0')} · ${esc(c.title)}</h2><span class="badge">${i===0?'Ảnh bìa':'Ảnh chi tiết'}</span></div>${diagram(c.layout,current.ratio)}<div class="field"><label>Vai trò / thông điệp</label><input data-field="purpose" value="${esc(c.purpose)}"></div><div class="field"><label>Bố cục</label><select data-field="layout">${Object.entries(layouts).map(([k,v])=>`<option value="${k}" ${c.layout===k?'selected':''}>${v[0]} · ${v[1]}</option>`).join('')}</select></div><div class="field"><label>Headline</label><input data-field="headline" value="${esc(c.headline)}"></div><div class="field"><label>Chữ trên ảnh</label><textarea data-field="copy" rows="3">${esc(c.copy)}</textarea></div><div class="field"><label>Bối cảnh & chỉ dẫn thiết kế</label><textarea data-field="scene" rows="3">${esc(c.scene)}</textarea></div><div class="field"><label>Ảnh tham khảo cho thiết kế này</label><div class="ref-checks">${current.assets.filter(a=>a.role==='reference').map((a,n)=>`<label title="${esc(a.name)}"><img data-file="${esc(a.file)}" alt="Tham khảo ${n+1}"><input type="checkbox" data-ref="${a.id}" ${c.refs.includes(a.id)?'checked':''}>Ảnh ${n+1}</label>`).join('')}</div></div>${current.assets.some(a=>a.role==='frame')?`<label class="consent"><input type="checkbox" data-field="frame" ${c.frame?'checked':''}>Ghép khung lên ảnh này</label>`:''}</article>`).join('');
 $('planCards').oninput=()=>{editing=true;};hydrateImages();statusMessage();
}
function readPlan(){return Array.from(document.querySelectorAll('.plan-card[data-index]')).map(el=>{const c={...current.plan[Number(el.dataset.index)]};el.querySelectorAll('[data-field]').forEach(f=>c[f.dataset.field]=f.type==='checkbox'?f.checked:f.value);c.refs=Array.from(el.querySelectorAll('[data-ref]:checked')).map(f=>f.dataset.ref);return c;});}
async function savePlan(){if(!current?.plan?.length)throw Error('Chưa có kế hoạch để lưu.');current=await api(`projects/${current.id}/plan`,{plan:readPlan(),ratio:$('planRatio').value});editing=false;notice('Đã lưu kế hoạch · Tỷ lệ '+current.ratio+'. Tỷ lệ mới áp dụng cho lần tạo tiếp theo; ảnh đã tạo giữ nguyên.');}
$('savePlan').onclick=()=>run(savePlan);
async function generate(indices,resume=false){
 if(!$('generationConsent').checked&&!resume)throw Error('Đánh dấu xác nhận nội dung và sử dụng credit ở bước Kế hoạch.');
 if(editing)await savePlan();
 if(!resume&&!confirm(`Tạo ${indices.length} ảnh bằng Kie.ai? Thao tác sử dụng credit theo giá hiện hành của Kie.ai.`))return;
 current=await api(`projects/${current.id}/generate`,{indices,resume,consent:true});showStep(3);poll();
}
$('generateAll').onclick=()=>run(async()=>{await savePlan();await generate(current.plan.map((_,i)=>i));});
function renderResults(){
 if(!current)return;const active=['analyzing','generating'].includes(current.status);
 $('results').innerHTML=(current.plan||[]).map((c,i)=>{const r=current.results?.[i]||{};return `<article class="plan-card"><div class="section-heading"><h2>${i+1}. ${esc(c.title)}</h2><span class="badge">${esc(({done:'Hoàn tất',queued:'Đang chờ',generating:'Đang tạo',submitting:'Đang gửi',failed:'Thất bại',pending:'Đang xử lý',uncertain:'Cần kiểm tra'})[r.state]||'Chưa tạo')}</span></div>${r.file?`<img class="result-image" data-file="${esc(r.file)}" alt="${esc(c.title)}">`:`<div class="result-placeholder" style="--output-ratio:${ratioCss(r.ratio||current.ratio)}">${diagram(c.layout,r.ratio||current.ratio)}</div>`}<span class="ratio-badge">Tỷ lệ ${esc(r.ratio||current.ratio)}</span> <small class="hint">${esc(r.model||'gpt-image-2-image-to-image')}${r.credits!=null?' · '+esc(r.credits)+' credit':''}${r.task?' · Task '+esc(r.task):''}</small><div class="result-actions">${r.file?`<button class="secondary" data-download="${i}">↓ Tải PNG</button>`:''}<button class="secondary" data-generate="${i}" ${active?'disabled':''}>${r.file?'Tạo lại (dùng credit)':'Tạo ảnh này'}</button>${r.task&&r.state!=='done'&&r.state!=='failed'?`<button class="secondary" data-resume="${i}" ${active?'disabled':''}>Tiếp tục tác vụ</button>`:''}</div></article>`;}).join('');
 $('results').querySelectorAll('[data-generate]').forEach(b=>b.onclick=()=>run(()=>generate([Number(b.dataset.generate)])));
 $('results').querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>run(()=>generate([Number(b.dataset.resume)],true)));
 $('results').querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>run(async()=>download(await api(`projects/${current.id}/file/${current.results[b.dataset.download].file}`,null,true),`product-${Number(b.dataset.download)+1}.png`)));
 hydrateImages();statusMessage();
}
function download(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('downloadZip').onclick=()=>run(async()=>download(await api(`projects/${current.id}/zip`,null,true),'product-images.zip'));
$('showProjects').onclick=()=>run(async()=>{const list=await api('projects');for(let i=1;i<=3;i++)$('step'+i).hidden=true;$('projects').hidden=false;$('projectList').innerHTML=list.length?list.map(p=>`<button class="project-row full" data-id="${p.id}"><strong>${esc(p.name)}</strong><span>${esc(p.status)} ↗</span></button>`).join(''):'Chưa có dự án.';$('projectList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>run(async()=>{clearImages();current=await api('projects/'+b.dataset.id);sessionStorage.setItem('studio-project',current.id);showStep(current.plan.length?2:1);poll();}));});
$('newProject').onclick=()=>{clearTimeout(pollTimer);current=null;clearImages();notice('');showStep(1);};
if(token&&sessionStorage.getItem('studio-project'))run(async()=>{current=await api('projects/'+sessionStorage.getItem('studio-project'));if(current.plan.length)showStep(2);poll();});
