/* Áreas do site: Entrar por aba, candidatura, catálogo e Investigador. API: /api/v/... */
const API='/api/v/';
const $=s=>document.querySelector(s);
async function api(p,m='GET',b){try{const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:b?JSON.stringify(b):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,...j}}catch(e){return{s:0,msg:'Sem conexão com o servidor.'}}}
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showMsg(el,t,ok){el.className='msg'+(ok?' ok':'');el.textContent=t;el.hidden=false}
/* Entrar por área: area = portal | cursos | contratacoes */
function setupLogin(area,label,after){
  const d=$('#dlg');$('#btnEntrar').onclick=()=>d.showModal();$('#dlgX').onclick=()=>d.close();
  $('#frmLogin').onsubmit=async e=>{e.preventDefault();const m=$('#loginMsg');m.hidden=true;
    const r=await api('auth/login','POST',{email:$('#lgE').value,password:$('#lgP').value,area});
    if(!r.ok)return showMsg(m,r.msg||'Não foi possível entrar.');
    d.close();after(r)};
  api('auth/me').then(r=>{if(r.ok&&r.s===200)after(r,true)});
}
async function logout(){await api('auth/logout','POST');location.reload()}
/* Candidatura */
function setupApply(){
  const f=$('#frmApply');if(!f)return;
  f.onsubmit=async e=>{e.preventDefault();const m=$('#applyMsg'),fd=Object.fromEntries(new FormData(f)),file=f.cv.files[0];
    if(file){if(file.size>5e6||file.type!=='application/pdf')return showMsg(m,'Envie o currículo em PDF de até 5 MB.');
      fd.cv=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.readAsDataURL(file)})}
    const r=await api('public/apply','POST',fd);
    if(r.s===200){f.reset();showMsg(m,'Recebemos seu currículo! Vamos analisar e te chamar em até 3 dias.',1)}else showMsg(m,r.msg||'Não foi possível enviar. Tente de novo.')};
}
/* Listas públicas editáveis pelo Admin */
async function lista(rota,alvo,vazio,tpl){const r=await fetch(API+rota).then(x=>x.json()).catch(()=>[]);const el=$(alvo);
  el.innerHTML=Array.isArray(r)&&r.length?r.map(tpl).join(''):vazio}
