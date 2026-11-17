// VORTICE - CONFIG COMPARTILHADA - index + portal + cursos + contratacoes + investigador leem daqui
const VORTICE_ADMIN_EMAIL = "vorticesolucoesglobais@gmail.com";
const VORTICE_ADMIN_PASS_PADRAO = "Vortice@2026";
const VORTICE_WHATSAPP = "5511921913395";
const VORTICE_EMAIL = "vorticesolucoesglobais@gmail.com";
const WA = VORTICE_WHATSAPP;
const MAIL = VORTICE_EMAIL;
const CFG = { LEAD_API: "" };
function track(){}
function vorticeGetDB(){ try{ return JSON.parse(localStorage.getItem('vortice_db') || '{"empresas":[],"users":[],"config":{}}') }catch(e){ return {empresas:[],users:[],config:{}} } }
function vorticeSaveDB(db){ localStorage.setItem('vortice_db', JSON.stringify(db)); }
function vorticeGetAdminPass(){ return localStorage.getItem('vortice_admin_pass') || VORTICE_ADMIN_PASS_PADRAO; }
