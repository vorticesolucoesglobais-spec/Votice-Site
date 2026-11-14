/* Idioma automático: escolha salva > idioma do dispositivo > fuso horário > português.
   Não usa GPS nem IP: o fuso horário é lido localmente no navegador. */
(function(){
const L={pt:'Português',en:'English',es:'Español',fr:'Français',it:'Italiano',zh:'中文',ja:'日本語',de:'Deutsch',ru:'Русский',ar:'العربية'};
const G={zh:'zh-CN'};
const TZ={'Asia/Shanghai':'zh','Asia/Chongqing':'zh','Asia/Harbin':'zh','Asia/Urumqi':'zh','Asia/Hong_Kong':'zh','Asia/Macau':'zh','Asia/Taipei':'zh','Asia/Tokyo':'ja','Europe/Berlin':'de','Europe/Vienna':'de','Europe/Zurich':'de','Europe/Paris':'fr','Europe/Brussels':'fr','Europe/Rome':'it','Europe/Madrid':'es','Europe/Moscow':'ru','Europe/Minsk':'ru','Asia/Riyadh':'ar','Asia/Dubai':'ar','Asia/Qatar':'ar','Asia/Kuwait':'ar','Asia/Baghdad':'ar','Asia/Amman':'ar','Asia/Beirut':'ar','Africa/Cairo':'ar','Africa/Casablanca':'ar','Africa/Algiers':'ar','America/Mexico_City':'es','America/Bogota':'es','America/Lima':'es','America/Santiago':'es','America/Argentina/Buenos_Aires':'es','Europe/Lisbon':'pt'};
const BR=/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Boa_Vista|Araguaina|Maceio|Santarem|Noronha|Eirunepe)$/;
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
function detect(){
  const s=ls('lang');if(s&&L[s])return s;
  for(const x of(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language])){const c=String(x||'').slice(0,2).toLowerCase();if(L[c])return c}
  let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
  if(TZ[tz])return TZ[tz];if(BR.test(tz))return'pt';
  return'en';
}
function setCk(l){
  const past='expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/',h=location.hostname;
  if(l==='pt'){document.cookie='googtrans=; '+past;document.cookie='googtrans=; '+past+'; domain='+h;document.cookie='googtrans=; '+past+'; domain=.'+h}
  else document.cookie='googtrans=/pt/'+(G[l]||l)+'; path=/';
}
function current(){const m=document.cookie.match(/(?:^|; )googtrans=\/pt\/([^;]+)/);if(!m)return'pt';const c=m[1].toLowerCase();return c==='zh-cn'?'zh':c}
const FL={"pt": "<rect width=\"30\" height=\"20\" fill=\"#009c3b\"/><path d=\"M15 2.5L27 10 15 17.5 3 10z\" fill=\"#ffdf00\"/><circle cx=\"15\" cy=\"10\" r=\"4.2\" fill=\"#002776\"/>", "en": "<rect width=\"30\" height=\"20\" fill=\"#012169\"/><path d=\"M0 0L30 20M30 0L0 20\" stroke=\"#fff\" stroke-width=\"4\"/><path d=\"M0 0L30 20M30 0L0 20\" stroke=\"#c8102e\" stroke-width=\"1.6\"/><path d=\"M15 0V20M0 10H30\" stroke=\"#fff\" stroke-width=\"6\"/><path d=\"M15 0V20M0 10H30\" stroke=\"#c8102e\" stroke-width=\"3.4\"/>", "es": "<rect width=\"30\" height=\"20\" fill=\"#aa151b\"/><rect y=\"5\" width=\"30\" height=\"10\" fill=\"#f1bf00\"/>", "fr": "<rect width=\"10\" height=\"20\" fill=\"#0055a4\"/><rect x=\"10\" width=\"10\" height=\"20\" fill=\"#fff\"/><rect x=\"20\" width=\"10\" height=\"20\" fill=\"#ef4135\"/>", "it": "<rect width=\"10\" height=\"20\" fill=\"#009246\"/><rect x=\"10\" width=\"10\" height=\"20\" fill=\"#fff\"/><rect x=\"20\" width=\"10\" height=\"20\" fill=\"#ce2b37\"/>", "zh": "<rect width=\"30\" height=\"20\" fill=\"#de2910\"/><path d=\"M5 2l.9 2.8h2.9L6.4 6.5l.9 2.8L5 7.6 2.7 9.3l.9-2.8L1.2 4.8h2.9z\" fill=\"#ffde00\"/><g fill=\"#ffde00\"><circle cx=\"10\" cy=\"2.5\" r=\".8\"/><circle cx=\"12\" cy=\"4.8\" r=\".8\"/><circle cx=\"12\" cy=\"7.5\" r=\".8\"/><circle cx=\"10\" cy=\"9.8\" r=\".8\"/></g>", "ja": "<rect width=\"30\" height=\"20\" fill=\"#fff\"/><circle cx=\"15\" cy=\"10\" r=\"6\" fill=\"#bc002d\"/>", "de": "<rect width=\"30\" height=\"7\" fill=\"#000\"/><rect y=\"6.67\" width=\"30\" height=\"6.67\" fill=\"#dd0000\"/><rect y=\"13.33\" width=\"30\" height=\"6.67\" fill=\"#ffce00\"/>", "ru": "<rect width=\"30\" height=\"6.67\" fill=\"#fff\"/><rect y=\"6.67\" width=\"30\" height=\"6.67\" fill=\"#0039a6\"/><rect y=\"13.33\" width=\"30\" height=\"6.67\" fill=\"#d52b1e\"/>", "ar": "<rect width=\"30\" height=\"20\" fill=\"#fff\"/><rect width=\"30\" height=\"6.67\" fill=\"#00732f\"/><rect y=\"13.33\" width=\"30\" height=\"6.67\" fill=\"#000\"/><rect width=\"7.5\" height=\"20\" fill=\"#f00\"/>"};
const flag=k=>'<svg class="fg" viewBox="0 0 30 20" aria-hidden="true">'+FL[k]+'</svg>';
const want=detect(),have=current(),box=document.getElementById('lg');
document.documentElement.lang=want==='zh'?'zh-CN':want;
if(want==='ar')document.documentElement.dir='rtl';
if(box){
  box.innerHTML='<button type="button" class="lgb" aria-haspopup="true" aria-expanded="false" aria-label="Idioma: '+L[want]+'">'+flag(want)+'<span>'+want.toUpperCase()+'</span></button><ul class="lgl" hidden>'+Object.keys(L).map(k=>'<li><button type="button" data-l="'+k+'" title="'+L[k]+'" aria-label="'+L[k]+'"'+(k===want?' aria-current="true"':'')+'>'+flag(k)+'<span>'+k.toUpperCase()+'</span></button></li>').join('')+'</ul>';
  const b=box.querySelector('.lgb'),u=box.querySelector('.lgl'),close=()=>{u.hidden=true;b.setAttribute('aria-expanded','false')};
  b.addEventListener('click',e=>{e.stopPropagation();u.hidden=!u.hidden;b.setAttribute('aria-expanded',String(!u.hidden))});
  document.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  u.addEventListener('click',e=>{const t=e.target.closest('button[data-l]');if(!t)return;ls('lang',t.dataset.l);try{sessionStorage.removeItem('lt')}catch(x){}setCk(t.dataset.l);location.reload()});
}
setCk(want);
if(want!==have){
  let n=0;try{n=+sessionStorage.getItem('lt')||0}catch(e){}
  if(have!=='pt'&&n<2){try{sessionStorage.setItem('lt',n+1)}catch(e){}location.reload();return}
}
if(want!=='pt'){
  window.gtInit=function(){new google.translate.TranslateElement({pageLanguage:'pt',autoDisplay:false,includedLanguages:'en,es,fr,it,zh-CN,ja,de,ru,ar'},'gt')};
  const s=document.createElement('script');s.async=true;s.src='https://translate.google.com/translate_a/element.js?cb=gtInit';document.head.appendChild(s);
}
})();
