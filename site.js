const WA='5511921913395',MAIL='vorticesolucoesglobais@gmail.com';
/* Preencha para ativar. LEAD_API: endereço que recebe os contatos (ex.: '/api/lead' no Azure Static Web Apps). */
const CFG={GA4:'',CLARITY:'',PIXEL:'',LEAD_API:'/api/lead'};
document.querySelectorAll('[data-wa]').forEach(a=>{
  const s=a.dataset.wa;
  a.href='https://wa.me/'+WA+'?text='+encodeURIComponent(s?`Olá, Vórtice! Vim pelo site e gostaria de uma proposta de ${s}.`:'Olá, Vórtice! Vim pelo site e gostaria de uma proposta.');
});
function track(n){if(window.gtag)gtag('event',n);if(window.fbq)fbq('trackCustom',n)}
document.querySelectorAll('[data-wa]').forEach(a=>a.addEventListener('click',()=>track('clique_whatsapp')));
document.getElementById('yr').textContent=new Date().getFullYear();
function loadTrackers(){
  if(CFG.GA4){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+CFG.GA4;document.head.append(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',CFG.GA4)}
  if(CFG.CLARITY){(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script',CFG.CLARITY)}
  if(CFG.PIXEL){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',CFG.PIXEL);fbq('track','PageView')}
}
let ck=null;try{ck=localStorage.getItem('ck')}catch(e){}
const banner=document.getElementById('ck');
if(ck==='1')loadTrackers();else if(!ck&&(CFG.GA4||CFG.CLARITY||CFG.PIXEL))banner.hidden=false;
function setCk(v){try{localStorage.setItem('ck',v)}catch(e){}banner.hidden=true;if(v==='1')loadTrackers()}
document.getElementById('ckY').onclick=()=>setCk('1');
document.getElementById('ckN').onclick=()=>setCk('0');
function openPriv(){if(location.hash==='#privacidade')(document.getElementById('privacidade')||{}).open=true}
addEventListener('hashchange',openPriv);openPriv();
