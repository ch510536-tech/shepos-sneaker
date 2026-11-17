import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,setDoc,deleteDoc,onSnapshot} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./config.js";
import {SEED} from "./seed.js";

/* ================= Utilidades ================= */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2,minimumFractionDigits:0}).format(Number(n)||0);
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>ymd(new Date());
const addDays=(s,n)=>{const [y,m,d]=s.split("-").map(Number);return ymd(new Date(y,m-1,d+n))};
const fdate=s=>{if(!s)return"";const [y,m,d]=String(s).split("-");return d+"/"+m+"/"+y};
const nowHM=()=>new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const digits=s=>String(s||"").replace(/\D/g,"");
const fphone=s=>{const d=digits(s);return d.length===10?d.slice(0,3)+" "+d.slice(3,6)+" "+d.slice(6):s||""};
const num=v=>Number(v)||0;
const SIZES=["22","22.5","23","23.5","24","24.5","25","25.5","26","26.5","27","27.5","28","28.5","29","29.5","30","31"];
const METODOS={efectivo:"Efectivo",tarjeta:"Tarjeta",transferencia:"Transferencia"};
const BIZ_PHONE="282 104 8780";
const sortSizes=a=>a.slice().sort((x,y)=>(parseFloat(x)-parseFloat(y))||String(x).localeCompare(String(y)));

const state={user:null,modelos:[],pedidos:[],mode:"loading",view:"ventas",filter:"todos",catFilter:"todos",debtFilter:"todos",qd:"",qp:"",qc:"",openId:null,payType:"abono",repMes:today().slice(0,7)};

/* ================= Firebase ================= */
let fs=null,auth=null,unsubs=[];
function fail(e){const c=e&&e.code;
  if(c==="permission-denied")toast("Tu cuenta no tiene permiso para guardar. Revisa que tu correo esté en las reglas de Firestore.");
  else if(c==="resource-exhausted")toast("Se alcanzó el límite gratuito de hoy en Firebase. Intenta más tarde.");
  else toast("No se pudo guardar. Revisa tu conexión e intenta otra vez.");
  return false}
/* Se guarda primero en el celular y Firebase lo sube en cuanto hay internet. */
function save(col,id,data){try{setDoc(doc(fs,col,id),data).catch(fail);return true}catch(e){return fail(e)}}
function remove(col,id){try{deleteDoc(doc(fs,col,id)).catch(fail);return true}catch(e){return fail(e)}}
function stopSubs(){unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[]}
function subscribe(){
  stopSubs();state.mode="loading";render();
  let gotM=false,gotP=false;
  const timer=setTimeout(()=>{if(state.mode==="loading")banner("Los datos tardan en cargar. Revisa tu conexión a internet.")},10000);
  const done=()=>{if(gotM&&gotP&&state.mode==="loading"){clearTimeout(timer);state.mode="db";banner("")}};
  const onErr=e=>{clearTimeout(timer);state.mode="db";render();
    banner(e&&e.code==="permission-denied"?"Tu cuenta no tiene permiso para ver los datos. Hay que agregar tu correo en las reglas de Firestore (ver LEEME).":"No se pudieron cargar los datos. Revisa tu conexión.")};
  unsubs.push(onSnapshot(collection(fs,"modelos"),s=>{state.modelos=s.docs.map(d=>({id:d.id,...d.data()}));gotM=true;done();render()},onErr));
  unsubs.push(onSnapshot(collection(fs,"pedidos"),s=>{state.pedidos=s.docs.map(d=>({id:d.id,...d.data()}));gotP=true;done();render()},onErr));
}
const AUTH_ERR={"auth/invalid-credential":"Correo o contraseña incorrectos.","auth/wrong-password":"Correo o contraseña incorrectos.","auth/user-not-found":"Correo o contraseña incorrectos.","auth/invalid-email":"Revisa que el correo esté bien escrito.","auth/too-many-requests":"Demasiados intentos. Espera unos minutos.","auth/network-request-failed":"Sin conexión a internet.","auth/user-disabled":"Esta cuenta está desactivada."};
function showLogin(msg,setup){$("#login").classList.add("open");$("#login-msg").textContent=msg||"Inicia sesión para entrar.";
  ["#lf-email","#lf-pass","#l-go","#l-reset"].forEach(s=>$(s).style.display=setup?"none":"")}
function renderUser(){const u=state.user;
  $("#userbox").innerHTML=u?esc(u.email||"")+' · <button class="btn small ghost" id="logout" style="padding:2px 8px">Salir</button>':"";
  const b=$("#logout");if(b)b.onclick=async()=>{if(await confirmBox("¿Cerrar sesión en este dispositivo?","Sí, salir"))try{await signOut(auth)}catch(e){}}}
function start(){
  if(!firebaseConfig||!firebaseConfig.apiKey||String(firebaseConfig.apiKey).includes("PEGA")){showLogin("Falta configurar la base de datos: abre el archivo config.js y pega los datos de tu proyecto de Firebase (ver LEEME).",true);return}
  let app;try{app=initializeApp(firebaseConfig)}catch(e){showLogin("Los datos de config.js no son válidos. Revísalos (ver LEEME).",true);return}
  try{fs=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}catch(e){fs=getFirestore(app)}
  auth=getAuth(app);
  onAuthStateChanged(auth,u=>{state.user=u||null;renderUser();
    if(u){$("#login").classList.remove("open");subscribe()}
    else{stopSubs();state.modelos=[];state.pedidos=[];state.mode="loading";closeAllOv();render();showLogin()}});
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();const em=$("#l-email").value.trim(),pw=$("#l-pass").value;
    if(!em||!pw){$("#login-msg").textContent="Escribe tu correo y tu contraseña.";return}
    $("#l-go").disabled=true;$("#login-msg").textContent="Entrando…";
    try{await signInWithEmailAndPassword(auth,em,pw);$("#l-pass").value=""}catch(err){$("#login-msg").textContent=AUTH_ERR[err&&err.code]||"No se pudo iniciar sesión. Intenta de nuevo."}
    $("#l-go").disabled=false});
  $("#l-reset").onclick=async()=>{const em=$("#l-email").value.trim();if(!em){$("#login-msg").textContent="Escribe tu correo arriba y vuelve a tocar \"Olvidé mi contraseña\".";return}
    try{await sendPasswordResetEmail(auth,em);$("#login-msg").textContent="Te enviamos un correo para cambiar tu contraseña. Revisa también spam."}catch(err){$("#login-msg").textContent=AUTH_ERR[err&&err.code]||"No se pudo enviar el correo."}};
}
window.addEventListener("online",()=>render());window.addEventListener("offline",()=>render());

/* ================= Cálculos ================= */
function calc(p){
  const movs=Array.isArray(p.movimientos)?p.movimientos:[];
  let pagado=0;for(const m of movs){const v=num(m.monto);pagado+=m.tipo==="resta"?-v:v}
  pagado=Math.round(pagado*100)/100;
  const total=num(p.precio);const saldo=Math.round((total-pagado)*100)/100;
  const pct=total>0?Math.max(0,Math.min(100,pagado/total*100)):0;
  const late=saldo>0&&!!p.proximoPago&&p.proximoPago<today();
  let est="warn",lab="Con saldo";
  if(total>0&&saldo<=0){est="ok";lab="Liquidado"}else if(pagado<=0){est="none";lab="Sin abonos"}
  return {movs,pagado,total,saldo,pct,est,lab,late}}
function movsSorted(p){return (Array.isArray(p.movimientos)?p.movimientos:[]).slice().sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")))}
function nextNumber(){return state.pedidos.reduce((m,p)=>Math.max(m,num(p.numero)),0)+1}
function modelLabel(m){return [m.marca,m.nombre].filter(Boolean).join(" ")+(m.color?" · "+m.color:"")}
/* Existencias: {talla: piezas}. Modelos viejos solo tenían la lista de tallas (sin cantidad). */
function stockOf(m){if(m&&m.stock&&typeof m.stock==="object")return m.stock;const o={};(m&&Array.isArray(m.tallas)?m.tallas:[]).forEach(t=>o[t]=null);return o}
function stockTotal(m){return Object.values(stockOf(m)).reduce((a,v)=>a+(v==null?0:num(v)),0)}
function hasCounts(m){return Object.values(stockOf(m)).some(v=>v!=null)}
function modelDoc(m){const d={...m};delete d.id;return d}
function adjustStock(modeloId,talla,delta){
  const m=state.modelos.find(x=>x.id===modeloId);if(!m||!talla)return false;
  const st={...stockOf(m)};if(!(talla in st)||st[talla]==null)return false;
  st[talla]=Math.max(0,num(st[talla])+delta);
  const d=modelDoc(m);d.stock=st;d.tallas=sortSizes(Object.keys(st).filter(k=>st[k]==null||num(st[k])>0));
  m.stock=st;m.tallas=d.tallas;save("modelos",m.id,d);return true}
function clientes(){const map=new Map();
  for(const p of state.pedidos.slice().sort((a,b)=>num(a.creado)-num(b.creado))){const n=(p.cliente||"").trim();if(n)map.set(n.toLowerCase(),{nombre:n,tel:p.telefono||""})}
  return [...map.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre))}

/* ================= Render general ================= */
function banner(t){$("#banner").innerHTML=t?'<div class="notice">'+esc(t)+'</div>':""}
function render(){
  const v=state.view;
  ["ventas","deudores","catalogo","reportes"].forEach(k=>{$("#view-"+k).hidden=v!==k});
  $$("[data-tab]").forEach(a=>{if(a.dataset.tab===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("#sync").innerHTML=state.mode==="db"?(navigator.onLine?"<b>● En línea</b>":"<b>Sin conexión</b> · se sube al volver"):"<b>Cargando…</b>";
  const lateN=state.pedidos.filter(p=>calc(p).late).length;
  $$("[data-late]").forEach(b=>{b.hidden=!lateN;b.textContent=lateN});
  const debtN=new Set(state.pedidos.filter(p=>calc(p).saldo>0).map(p=>(p.cliente||"").trim().toLowerCase())).size;
  $$("[data-debt]").forEach(b=>{b.hidden=!debtN;b.textContent=debtN});
  const dis=state.mode==="loading";["#btn-contado","#btn-apartado","#btn-new-model","#btn-deuda"].forEach(s=>$(s).disabled=dis);
  $$(".xlsx-btn").forEach(b=>b.disabled=dis);
  if(v==="ventas"){renderStats();renderOrders()}
  if(v==="deudores")renderDebts();
  if(v==="catalogo")renderCatalog();
  if(v==="reportes")renderReport();
  if(state.openId)renderDetail();
}
function renderStats(){
  const mes=today().slice(0,7),hoy=today();let vend=0,cobHoy=0,pen=0,late=0;
  for(const p of state.pedidos){const c=calc(p);if(p.fecha&&p.fecha.startsWith(mes))vend+=c.total;if(c.saldo>0)pen+=c.saldo;if(c.late)late++;
    for(const m of c.movs)if(m.fecha===hoy&&!m.inicial)cobHoy+=m.tipo==="resta"?-num(m.monto):num(m.monto)}
  $("#st-mes").textContent=money(vend);$("#st-hoy").textContent=money(cobHoy);$("#st-pen").textContent=money(pen);$("#st-late").textContent=late}
function renderOrders(){
  const el=$("#orders");
  if(state.mode==="loading"){el.innerHTML='<div class="empty">Cargando ventas…</div>';return}
  if(!state.pedidos.length){el.innerHTML='<div class="empty"><strong>Aún no hay ventas</strong>Registra una venta de contado o un apartado con su anticipo.<span class="actions-row" style="justify-content:center"><button class="btn light" data-act="contado">+ Venta de contado</button><button class="btn primary" data-act="apartado">+ Apartado</button></span></div>';return}
  const q=state.qp.trim().toLowerCase();
  let list=state.pedidos.slice().sort((a,b)=>{const ca=calc(a),cb=calc(b);if(ca.late!==cb.late)return ca.late?-1:1;return num(b.numero)-num(a.numero)});
  list=list.filter(p=>{const c=calc(p);
    if(state.filter==="pend"&&!(c.saldo>0))return false;
    if(state.filter==="late"&&!c.late)return false;
    if(state.filter==="liq"&&!(c.saldo<=0&&c.total>0))return false;
    if(state.filter==="noent"&&p.entregado)return false;
    if(!q)return true;
    return [p.cliente,p.telefono,digits(p.telefono),p.modelo,p.talla,"pedido "+p.numero,"#"+p.numero,String(p.numero)].join(" ").toLowerCase().includes(q)});
  if(!list.length){el.innerHTML='<div class="empty">Ninguna venta coincide con la búsqueda o el filtro.</div>';return}
  el.innerHTML=list.map(p=>{const c=calc(p);return '<button class="order'+(c.late?' late':c.saldo<=0&&c.total>0?' done':'')+'" data-open="'+esc(p.id)+'">'+
    '<div class="head"><span class="n">'+(p.tipo==="contado"?"Venta ":"Pedido ")+esc(p.numero)+'</span><span class="pills">'+(p.anterior?'<span class="pill del">Anterior</span>':'')+(p.tipo==="contado"?'<span class="pill cash">Contado</span>':'')+(c.late?'<span class="pill late">Atrasado</span>':'')+(p.entregado?'<span class="pill del">Entregado</span>':'')+'<span class="pill '+c.est+'">'+c.lab+'</span></span></div>'+
    '<div><div class="client">'+esc(p.cliente||"Cliente sin nombre")+'</div><div class="meta">'+esc(p.modelo||"Sin modelo")+(p.talla?' · Talla '+esc(p.talla):'')+'</div><div class="meta">'+esc(fdate(p.fecha))+(p.telefono?' · '+esc(fphone(p.telefono)):'')+(c.saldo>0&&p.proximoPago?' · Próx. pago <b style="color:'+(c.late?'#FF8A8E':'var(--ink)')+'">'+esc(fdate(p.proximoPago))+'</b>':'')+'</div></div>'+
    (p.tipo==="contado"&&c.saldo<=0?'':'<div class="bar"><i class="'+(c.pct>=100?'full':'')+'" style="width:'+c.pct.toFixed(1)+'%"></i></div>')+
    '<div class="money num"><span>Pagado <b>'+money(c.pagado)+'</b> de '+money(c.total)+'</span><span>Saldo <b style="color:'+(c.saldo>0?'#FF8A8E':'#6EE0A0')+'">'+money(Math.max(c.saldo,0))+'</b></span></div>'+
  '</button>'}).join("")}

/* ================= Inventario ================= */
function renderCatalog(){
  const el=$("#catalog");
  let pares=0,valVenta=0,valCosto=0,agot=0;
  for(const m of state.modelos){const t=stockTotal(m);pares+=t;valVenta+=t*num(m.precio);valCosto+=t*num(m.costo);if(hasCounts(m)&&t===0)agot++}
  $("#inv-stats").innerHTML='<div class="stat"><small>Modelos</small><strong class="num">'+state.modelos.length+'</strong></div><div class="stat good"><small>Pares en existencia</small><strong class="num">'+pares+'</strong></div><div class="stat"><small>Valor a precio de venta</small><strong class="num">'+money(valVenta)+'</strong></div><div class="stat alert"><small>Modelos agotados</small><strong class="num">'+agot+'</strong></div>';
  if(state.mode==="loading"){el.innerHTML='<div class="empty">Cargando inventario…</div>';return}
  if(!state.modelos.length){el.innerHTML='<div class="empty"><strong>Tu inventario está vacío</strong>Agrega cada modelo con su foto, precio, costo y cuántos pares tienes por talla.<span class="actions-row" style="justify-content:center"><button class="btn primary" data-act="new-model">+ Agregar modelo</button><button class="btn" data-act="seed">Agregar mis 5 modelos</button></span></div>';return}
  const q=state.qc.trim().toLowerCase();
  const list=state.modelos.slice().sort((a,b)=>modelLabel(a).localeCompare(modelLabel(b))).filter(m=>{
    const t=stockTotal(m);
    if(state.catFilter==="disp"&&!(t>0||(!hasCounts(m)&&Object.keys(stockOf(m)).length)))return false;
    if(state.catFilter==="agot"&&!(hasCounts(m)&&t===0))return false;
    return !q||(modelLabel(m)+" "+Object.keys(stockOf(m)).join(" ")).toLowerCase().includes(q)});
  if(!list.length){el.innerHTML='<div class="empty">Ningún modelo coincide con la búsqueda o el filtro.</div>';return}
  el.innerHTML=list.map(m=>{const st=stockOf(m);const keys=sortSizes(Object.keys(st));const pr=num(m.precio),co=num(m.costo);const t=stockTotal(m);const counts=hasCounts(m);
    const sizes=keys.filter(k=>st[k]==null||num(st[k])>0);
    return '<article class="model">'+
    '<div class="pic">'+(m.foto&&String(m.foto).startsWith("data:image/")?'<img src="'+esc(m.foto)+'" alt="'+esc(modelLabel(m))+'">':'<span class="ph">Sin foto</span>')+
      (counts?(t===0?'<span class="pill late">Agotado</span>':'<span class="pill cash">'+t+(t===1?' par':' pares')+'</span>'):'')+'</div>'+
    '<div class="body"><span class="brand-n">'+esc(m.marca)+'</span><h3>'+esc(m.nombre)+'</h3>'+(m.color?'<span class="meta">'+esc(m.color)+'</span>':'')+
    (pr>0?'<span class="price num">'+money(pr)+'</span>':'<span class="price missing">Falta agregar precio</span>')+
    (co>0&&pr>0?'<span class="meta num">Costo '+money(co)+' · Ganancia <b style="color:#6EE0A0">'+money(pr-co)+'</b></span>':'')+
    '<div class="sizes">'+(sizes.length?sizes.map(s=>'<span class="size">'+esc(s)+(st[s]!=null?' <b>×'+num(st[s])+'</b>':'')+'</span>').join(""):'<span style="color:var(--warn);font-size:.86rem">'+(keys.length?'Sin existencias':'Sin tallas registradas')+'</span>')+'</div></div>'+
    '<div class="actions"><button class="btn small light" data-sell="'+esc(m.id)+'" data-kind="contado">Vender</button><button class="btn small primary" data-sell="'+esc(m.id)+'" data-kind="apartado">Apartar</button><button class="btn small" data-edit-model="'+esc(m.id)+'">Editar</button><button class="btn small danger" data-del-model="'+esc(m.id)+'" aria-label="Eliminar modelo">Eliminar</button></div>'+
  '</article>'}).join("")}

/* ================= Deudores ================= */
function lastPay(p){const ms=movsSorted(p).filter(m=>m.tipo!=="resta");const d=ms.filter(m=>m.fecha);return d.length?d[d.length-1]:ms.length?ms[ms.length-1]:null}
function renderDebts(){
  const all=state.pedidos.map(p=>({p,c:calc(p)})).filter(x=>x.c.saldo>0);
  const personas=new Set(all.map(x=>(x.p.cliente||"").trim().toLowerCase())).size;
  const total=all.reduce((a,x)=>a+x.c.saldo,0),lateN=all.filter(x=>x.c.late).length,ant=all.filter(x=>x.p.anterior).reduce((a,x)=>a+x.c.saldo,0);
  $("#debt-stats").innerHTML='<div class="stat"><small>Personas que deben</small><strong class="num">'+personas+'</strong></div><div class="stat alert"><small>Total por cobrar</small><strong class="num">'+money(total)+'</strong></div><div class="stat warn"><small>Atrasados</small><strong class="num">'+lateN+'</strong></div><div class="stat"><small>De deudas anteriores</small><strong class="num">'+money(ant)+'</strong></div>';
  const el=$("#debts");
  if(state.mode==="loading"){el.innerHTML='<div class="empty">Cargando…</div>';return}
  if(!all.length){el.innerHTML='<div class="empty"><strong>Nadie te debe</strong>Aquí aparecen los apartados con saldo pendiente. Si alguien ya te debía antes de usar la app, regístralo con "Registrar deuda anterior".<button class="btn primary" data-act="deuda">+ Registrar deuda anterior</button></div>';return}
  const q=state.qd.trim().toLowerCase();
  const list=all.filter(({p,c})=>{
    if(state.debtFilter==="late"&&!c.late)return false;
    if(state.debtFilter==="anterior"&&!p.anterior)return false;
    return !q||[p.cliente,p.telefono,digits(p.telefono),p.modelo,p.talla].join(" ").toLowerCase().includes(q)})
   .sort((a,b)=>(b.c.late-a.c.late)||(a.p.cliente||"").localeCompare(b.p.cliente||"")||(b.c.saldo-a.c.saldo));
  if(!list.length){el.innerHTML='<div class="empty">Nadie coincide con la búsqueda o el filtro.</div>';return}
  const sum=list.reduce((a,x)=>a+x.c.saldo,0);
  el.innerHTML='<div class="debt-head"><span>Persona</span><span>Modelo</span><span>Precio</span><span>Abonado</span><span>Último abono</span><span>Debe</span></div>'+
    list.map(({p,c})=>{const lp=lastPay(p);return '<button class="debt'+(c.late?' late':'')+'" data-open="'+esc(p.id)+'">'+
      '<span class="who"><b>'+esc(p.cliente||"Sin nombre")+'</b><span class="meta">'+(p.telefono?esc(fphone(p.telefono)):'')+(c.late?' <span class="pill late">Atrasado</span>':p.proximoPago?' · Próx. '+esc(fdate(p.proximoPago)):'')+(p.anterior?' <span class="pill del">Anterior</span>':'')+'</span></span>'+
      '<span class="mod"><span class="k">Modelo</span>'+esc(p.modelo||"Sin modelo")+(p.talla?' <span class="meta">· T. '+esc(p.talla)+'</span>':'')+'</span>'+
      '<span class="r num"><span class="k">Precio</span>'+money(c.total)+'</span>'+
      '<span class="r num"><span class="k">Abonado</span>'+money(c.pagado)+'</span>'+
      '<span class="r num"><span class="k">Último abono</span>'+(lp?(lp.fecha?esc(fdate(lp.fecha)):'<span class="meta">Sin fecha</span>')+'<br><span class="meta">'+money(lp.monto)+'</span>':'<span class="meta">Sin abonos</span>')+'</span>'+
      '<span class="r"><span class="k">Debe</span><span class="saldo num">'+money(c.saldo)+'</span></span>'+
    '</button>'}).join("")+
    '<div class="debt-total"><span>'+list.length+(list.length===1?' deuda':' deudas')+'</span><span class="num">Total: '+money(sum)+'</span></div>'}
function abRow(){return '<div class="abrow"><input type="date" aria-label="Fecha del abono"><input type="number" min="0" step="1" inputmode="decimal" placeholder="Cantidad" aria-label="Cantidad del abono"><button type="button" class="btn small ghost" data-abdel aria-label="Quitar abono">✕</button></div>'}
function readAbonos(){return $$("#d-abonos .abrow").map(r=>{const [f,m]=r.querySelectorAll("input");return {fecha:f.value,monto:num(m.value)}}).filter(a=>a.monto>0)}
function openDebt(){
  $("#clientes-d").innerHTML=clientes().map(c=>'<option value="'+esc(c.nombre)+'">'+esc(fphone(c.tel))+'</option>').join("");
  ["#d-cliente","#d-tel","#d-modelo","#d-talla","#d-precio","#d-fventa","#d-prox","#d-notas"].forEach(s=>$(s).value="");
  $("#d-abonos").innerHTML=abRow();$("#d-entregado").checked=false;updDebtSaldo();
  openOv("#ov-debt");setTimeout(()=>{try{$("#d-cliente").focus()}catch(e){}},50)}
function updDebtSaldo(){const p=num($("#d-precio").value),a=readAbonos().reduce((s,x)=>s+x.monto,0);
  $("#d-saldo").textContent=(a>0?"Lleva "+money(a):"")+(p>0?(a>0?" · ":"")+"Le falta "+money(Math.max(p-a,0)):"")}
$("#d-precio").addEventListener("input",updDebtSaldo);
$("#d-abonos").addEventListener("input",updDebtSaldo);
$("#d-abonos").addEventListener("click",e=>{const b=e.target.closest("[data-abdel]");if(!b)return;b.parentElement.remove();if(!$("#d-abonos .abrow"))$("#d-abonos").innerHTML=abRow();updDebtSaldo()});
$("#d-add").onclick=()=>{$("#d-abonos").insertAdjacentHTML("beforeend",abRow());const r=$$("#d-abonos .abrow").pop();r.querySelector("input[type=number]").focus()};
$("#d-cliente").addEventListener("change",()=>{const n=$("#d-cliente").value.trim().toLowerCase();const c=clientes().find(x=>x.nombre.toLowerCase()===n);if(c&&c.tel&&!$("#d-tel").value)$("#d-tel").value=c.tel});
$("#form-debt").addEventListener("submit",e=>{e.preventDefault();
  const cliente=$("#d-cliente").value.trim(),modelo=$("#d-modelo").value.trim(),precio=num($("#d-precio").value);
  const abs=readAbonos();const abonado=abs.reduce((s,x)=>s+x.monto,0);
  if(!cliente){toast("Escribe el nombre de la persona.");return}
  if(!(precio>0)){toast("Escribe el precio del tenis.");return}
  if(abonado>precio){toast("Los abonos suman más que el precio. Revisa las cantidades.");return}
  /* Abono con fecha = pago normal (cuenta en su mes). Sin fecha = abono anterior (solo suma a lo abonado). */
  const movs=abs.map(a=>a.fecha?{id:uid(),fecha:a.fecha,hora:"",tipo:"abono",monto:a.monto,metodo:"",nota:"Abono anterior"}:{id:uid(),fecha:"",hora:"",tipo:"abono",monto:a.monto,metodo:"",nota:"Abono anterior (sin fecha)",inicial:true});
  const data={numero:nextNumber(),tipo:"apartado",anterior:true,cliente,telefono:$("#d-tel").value.trim(),fecha:$("#d-fventa").value||"",
    modeloId:"",modelo,talla:$("#d-talla").value.trim(),precio,costo:0,notas:$("#d-notas").value.trim(),entregado:$("#d-entregado").checked,
    proximoPago:precio-abonado>0?$("#d-prox").value:"",movimientos:movs,stockRef:null,creado:Date.now()};
  const id=uid();if(!save("pedidos",id,data))return;
  if(!state.pedidos.some(x=>x.id===id))state.pedidos.push({id,...data});closeOv("#ov-debt");toast("Deuda de "+cliente+" registrada");render()});

/* ================= Reportes ================= */
function renderReport(){
  const mes=state.repMes||today().slice(0,7);$("#rep-mes").value=mes;
  let vendido=0,pares=0,cobrado=0,gan=0,conCosto=0,ventasMes=0,pen=0,late=0;
  const met={efectivo:0,tarjeta:0,transferencia:0,otro:0};const top=new Map();
  for(const p of state.pedidos){const c=calc(p);if(c.saldo>0)pen+=c.saldo;if(c.late)late++;
    if(p.fecha&&p.fecha.startsWith(mes)){ventasMes++;vendido+=c.total;pares++;const k=p.modelo||"Sin modelo";top.set(k,(top.get(k)||0)+1);
      if(num(p.costo)>0){gan+=c.total-num(p.costo);conCosto++}}
    for(const m of c.movs)if(!m.inicial&&(m.fecha||"").startsWith(mes)){const v=(m.tipo==="resta"?-1:1)*num(m.monto);cobrado+=v;met[METODOS[m.metodo]?m.metodo:"otro"]+=v}}
  $("#rep-stats").innerHTML=
    '<div class="stat"><small>Vendido en el mes</small><strong class="num">'+money(vendido)+'</strong></div>'+
    '<div class="stat good"><small>Cobrado en el mes</small><strong class="num">'+money(cobrado)+'</strong></div>'+
    '<div class="stat good"><small>Ganancia estimada</small><strong class="num">'+money(gan)+'</strong></div>'+
    '<div class="stat"><small>Pares vendidos</small><strong class="num">'+pares+'</strong></div>'+
    '<div class="stat alert"><small>Por cobrar (total)</small><strong class="num">'+money(pen)+'</strong></div>'+
    '<div class="stat warn"><small>Pagos atrasados</small><strong class="num">'+late+'</strong></div>';
  const mx=Math.max(1,...Object.values(met).map(Math.abs));
  $("#rep-metodos").innerHTML=Object.entries(met).filter(([k,v])=>k!=="otro"||v).map(([k,v])=>'<div class="hbar"><span>'+(METODOS[k]||"Sin especificar")+'</span><span class="track"><i style="width:'+(Math.abs(v)/mx*100).toFixed(1)+'%"></i></span><b class="num">'+money(v)+'</b></div>').join("")+
    (conCosto<ventasMes?'<p class="hint" style="margin:0">La ganancia solo cuenta '+conCosto+' de '+ventasMes+' venta(s) del mes; a las demás les falta el costo del modelo.</p>':'');
  const tops=[...top.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);const tmx=Math.max(1,...tops.map(t=>t[1]));
  $("#rep-top").innerHTML=tops.length?tops.map(([k,v])=>'<div class="hbar"><span title="'+esc(k)+'">'+esc(k)+'</span><span class="track"><i style="width:'+(v/tmx*100)+'%"></i></span><b class="num">'+v+'</b></div>').join(""):'<p class="muted" style="margin:0">Sin ventas en este mes.</p>';
  const deud=state.pedidos.map(p=>({p,c:calc(p)})).filter(x=>x.c.saldo>0).sort((a,b)=>(b.c.late-a.c.late)||(b.c.saldo-a.c.saldo));
  $("#rep-deudores").innerHTML=deud.length?deud.slice(0,12).map(({p,c})=>'<button class="lrow" data-open="'+esc(p.id)+'"><span><b>'+esc(p.cliente||"Sin nombre")+'</b><br><span class="muted" style="font-size:.82rem">'+(c.late?'<span style="color:#FF8A8E">Atrasado desde '+esc(fdate(p.proximoPago))+'</span>':p.proximoPago?'Próx. pago '+esc(fdate(p.proximoPago)):'Sin fecha de pago')+'</span></span><b class="num" style="color:#FF8A8E">'+money(c.saldo)+'</b></button>').join("")+(deud.length>12?'<p class="hint" style="margin:0">Y '+(deud.length-12)+' más en la pestaña Ventas.</p>':''):'<p class="muted" style="margin:0">Nadie te debe. 🎉</p>';
  let tp=0,vv=0,vc=0;const agot=[];for(const m of state.modelos){const t=stockTotal(m);tp+=t;vv+=t*num(m.precio);vc+=t*num(m.costo);if(hasCounts(m)&&t===0)agot.push(modelLabel(m))}
  $("#rep-inv").innerHTML='<div class="money"><span>Pares en existencia</span><b class="num">'+tp+'</b></div><div class="money"><span>Valor a precio de venta</span><b class="num">'+money(vv)+'</b></div><div class="money"><span>Lo que te costaron</span><b class="num">'+money(vc)+'</b></div>'+
    (agot.length?'<div><span class="lbl">Agotados</span><div class="sizes" style="margin-top:4px">'+agot.map(a=>'<span class="size">'+esc(a)+'</span>').join("")+'</div></div>':'');
}

/* ================= Detalle de venta ================= */
function waMsg(p,c){
  const head="Hola "+(p.cliente||"")+", te saluda Shepo's Sneaker 👟\n";
  if(c.saldo<=0)return head+"Tu "+(p.tipo==="contado"?"compra":"pedido")+" "+p.numero+" ("+(p.modelo||"")+(p.talla?" talla "+p.talla:"")+") está liquidado. ¡Gracias por tu compra!";
  return head+(c.late?"Te recordamos que tu pago del "+fdate(p.proximoPago)+" está pendiente.\n":"")+
    "Pedido "+p.numero+": "+(p.modelo||"")+(p.talla?" talla "+p.talla:"")+"\nTotal: "+money(c.total)+"\nAbonado: "+money(c.pagado)+"\nSaldo pendiente: "+money(c.saldo)+
    (p.proximoPago&&!c.late?"\nPróximo pago: "+fdate(p.proximoPago):"")+"\n¡Gracias!"}
function waLink(tel,msg){const ph=digits(tel);return ph.length>=10?"https://wa.me/"+(ph.length===10?"52"+ph:ph)+"?text="+encodeURIComponent(msg):""}
function renderDetail(){
  const p=state.pedidos.find(x=>x.id===state.openId);
  if(!p){closeOv("#ov-detail");return}
  const c=calc(p);const msg=waMsg(p,c);const wa=waLink(p.telefono,msg);const movs=movsSorted(p);
  const keep=id=>$(id)?$(id).value:null;
  const kAmt=keep("#p-monto")||"",kNota=keep("#p-nota")||"",kF=keep("#p-fecha")||today(),kM=keep("#p-metodo")||"efectivo",kProx=keep("#p-prox");
  const proxDefault=p.proximoPago&&p.proximoPago>=today()?p.proximoPago:addDays(today(),15);
  $("#detail").innerHTML=
   '<div class="sh"><div><h2 id="det-title">'+(p.tipo==="contado"?"Venta ":"Pedido ")+esc(p.numero)+'</h2><span class="pills" style="margin-top:4px">'+(p.tipo==="contado"?'<span class="pill cash">Contado</span>':'')+(c.late?'<span class="pill late">Atrasado</span>':'')+(p.entregado?'<span class="pill del">Entregado</span>':'<span class="pill warn">Por entregar</span>')+'<span class="pill '+c.est+'">'+c.lab+'</span></span></div><button type="button" class="x" data-close aria-label="Cerrar">×</button></div>'+
   '<div class="detail-grid"><div><small>Cliente</small>'+esc(p.cliente||"—")+'</div><div><small>Teléfono</small>'+(p.telefono?esc(fphone(p.telefono)):'—')+'</div>'+
   '<div><small>Modelo</small>'+esc(p.modelo||"—")+'</div><div><small>Talla</small>'+esc(p.talla||"—")+'</div>'+
   '<div><small>Fecha</small>'+esc(fdate(p.fecha))+'</div><div><small>Próximo pago</small>'+(c.saldo>0&&p.proximoPago?'<span style="color:'+(c.late?'#FF8A8E':'inherit')+'">'+esc(fdate(p.proximoPago))+(c.late?' (atrasado)':'')+'</span>':'—')+'</div>'+
   (p.notas?'<div style="grid-column:1/-1"><small>Notas</small>'+esc(p.notas)+'</div>':'')+'</div>'+
   '<div class="totals num"><div><small>Precio</small><strong>'+money(c.total)+'</strong></div><div><small>Pagado</small><strong>'+money(c.pagado)+'</strong></div><div class="saldo'+(c.saldo<=0?' done':'')+'"><small>'+(c.saldo<0?'A favor':'Saldo')+'</small><strong>'+money(Math.abs(c.saldo))+'</strong></div></div>'+
   '<div class="bar"><i class="'+(c.pct>=100?'full':'')+'" style="width:'+c.pct.toFixed(1)+'%"></i></div>'+
   '<form class="payform" id="payform" novalidate>'+
     '<div class="full seg" role="group" aria-label="Tipo de movimiento"><button type="button" data-pt="abono" aria-pressed="'+(state.payType==="abono")+'">+ Registrar pago</button><button type="button" data-pt="resta" aria-pressed="'+(state.payType==="resta")+'">− Restar (devolución o error)</button></div>'+
     '<div class="field"><label for="p-monto">Cantidad</label><input id="p-monto" type="number" min="0" step="1" inputmode="decimal" placeholder="'+(c.saldo>0?c.saldo:100)+'" value="'+esc(kAmt)+'"></div>'+
     '<div class="field"><label for="p-metodo">Forma de pago</label><select id="p-metodo">'+Object.entries(METODOS).map(([k,v])=>'<option value="'+k+'"'+(k===kM?' selected':'')+'>'+v+'</option>').join("")+'</select></div>'+
     '<div class="field"><label for="p-fecha">Fecha</label><input id="p-fecha" type="date" value="'+esc(kF)+'"></div>'+
     '<div class="field"><label for="p-prox">Siguiente pago</label><input id="p-prox" type="date" value="'+esc(kProx!=null?kProx:proxDefault)+'"></div>'+
     '<div class="field full"><label for="p-nota">Nota (opcional)</label><input id="p-nota" placeholder="Ej. Segundo pago" value="'+esc(kNota)+'"></div>'+
     '<div class="full row-end"><button class="btn ghost small" type="button" data-act="liquidar"'+(c.saldo>0?'':' disabled')+'>Pagar todo ('+money(Math.max(c.saldo,0))+')</button><button class="btn primary" type="submit">Guardar y ver ticket</button></div>'+
   '</form>'+
   '<div><h3 style="font-size:1.15rem;text-transform:uppercase;margin-bottom:4px">Historial de pagos</h3>'+
   (movs.length?'<div class="tbl"><table><thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Cantidad</th><th></th></tr></thead><tbody>'+
     movs.map(m=>'<tr><td class="num">'+(m.fecha?esc(fdate(m.fecha)):'<span class="muted">Sin fecha</span>')+(m.hora?'<br><span class="muted" style="font-size:.78rem">'+esc(m.hora)+'</span>':'')+'</td><td>'+(m.inicial?'Abono anterior':m.tipo==="resta"?'Resta':'Pago')+(m.metodo?' · '+esc(METODOS[m.metodo]||m.metodo):'')+(m.nota?'<br><span class="muted" style="font-size:.82rem">'+esc(m.nota)+'</span>':'')+'</td><td class="amt'+(m.tipo==="resta"?' neg':'')+'">'+(m.tipo==="resta"?'−':'+')+money(m.monto)+'</td><td style="text-align:right;white-space:nowrap">'+(m.tipo!=="resta"?'<button class="btn small" data-ticket="'+esc(m.id)+'">Ticket</button> ':'')+'<button class="btn small ghost" data-del-mov="'+esc(m.id)+'" aria-label="Borrar pago">✕</button></td></tr>').join("")+
     '</tbody></table></div>':'<p class="muted" style="margin:0">Todavía no hay pagos.</p>')+'</div>'+
   '<div class="row-end" style="justify-content:flex-start"><button class="btn" data-act="ticket-all">Ticket con estado de cuenta</button></div>'+
   '<div class="msgbox"><strong>'+(c.late?'Recordatorio de pago':'Mensaje para el cliente')+'</strong><p id="msg-text">'+esc(msg)+'</p><div class="row-end" style="justify-content:flex-start">'+
     (wa?'<a class="btn small primary" href="'+esc(wa)+'" target="_blank" rel="noopener">Enviar por WhatsApp</a>':'<span class="hint">Agrega un teléfono de 10 dígitos para enviarlo por WhatsApp.</span>')+
     '<button class="btn small" data-act="copy-msg">Copiar</button></div></div>'+
   '<div class="row-end"><button class="btn danger" data-act="del-order">Eliminar</button><button class="btn" data-act="toggle-ent">'+(p.entregado?'Marcar no entregado':'Marcar entregado')+'</button><button class="btn" data-act="edit-order">Editar datos</button></div>';
}

/* ================= Ventanas ================= */
let lastFocus=null;
function openOv(sel){lastFocus=document.activeElement;$(sel).classList.add("open")}
function closeOv(sel){$(sel).classList.remove("open");if(sel==="#ov-detail")state.openId=null;if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}
function closeAllOv(){$$(".overlay.open").forEach(o=>o.classList.remove("open"));state.openId=null}
$$(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o||e.target.closest("[data-close]"))closeOv("#"+o.id)}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const o=$$(".overlay.open").pop();if(o)closeOv("#"+o.id)}});
let cfResolve=null;
function confirmBox(text,yes){$("#cf-text").textContent=text;$("#cf-yes").textContent=yes||"Sí, eliminar";openOv("#ov-confirm");return new Promise(r=>{cfResolve=r})}
$("#cf-yes").onclick=()=>{closeOv("#ov-confirm");cfResolve&&cfResolve(true)};
$("#cf-no").onclick=()=>{closeOv("#ov-confirm");cfResolve&&cfResolve(false)};
let tt=null;function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>el.classList.remove("show"),3200)}

/* ================= Formulario de modelo ================= */
let editModelId=null,modelFoto="",extraSizes=[];
function drawStockGrid(st){
  const keys=sortSizes([...new Set([...SIZES,...Object.keys(st||{}),...extraSizes])]);
  $("#m-stock").innerHTML=keys.map(k=>{const v=st&&k in st?st[k]:"";return '<label class="'+(v!==""&&v!=null?'has':'')+'"><span style="flex:1">'+esc(k)+'</span><input type="number" min="0" step="1" inputmode="numeric" data-size="'+esc(k)+'" value="'+(v==null?(st&&k in st?"1":""):esc(v))+'" aria-label="Pares talla '+esc(k)+'"></label>'}).join("")}
function readStockGrid(){const o={};$$("#m-stock input").forEach(i=>{if(i.value!==""){o[i.dataset.size]=Math.max(0,Math.floor(num(i.value)))}});return o}
$("#m-stock").addEventListener("input",e=>{const i=e.target.closest("input");if(i)i.parentElement.classList.toggle("has",i.value!=="")});
function drawThumb(){$("#m-thumb").innerHTML=modelFoto?'<img src="'+esc(modelFoto)+'" alt="Vista previa">':'<span style="color:#9AA7B0;font-size:.8rem">Sin foto</span>'}
function updGan(){const p=num($("#m-precio").value),c=num($("#m-costo").value);$("#m-gan").textContent=p>0&&c>0?"Ganas "+money(p-c)+" por par ("+Math.round((p-c)/p*100)+"%)":""}
$("#m-precio").addEventListener("input",updGan);$("#m-costo").addEventListener("input",updGan);
function openModel(m){editModelId=m?m.id:null;extraSizes=[];$("#mdl-title").textContent=m?"Editar modelo":"Agregar modelo";
  $("#m-marca").value=m?m.marca||"":"";$("#m-nombre").value=m?m.nombre||"":"";$("#m-color").value=m?m.color||"":"";
  $("#m-precio").value=m&&num(m.precio)>0?m.precio:"";$("#m-costo").value=m&&num(m.costo)>0?m.costo:"";
  modelFoto=m&&m.foto?m.foto:"";$("#m-foto").value="";drawStockGrid(m?stockOf(m):{});drawThumb();updGan();openOv("#ov-model")}
$("#m-talla-add").onclick=()=>{const v=$("#m-talla-extra").value.trim();if(!v)return;const cur=readStockGrid();extraSizes.push(v);if(!(v in cur))cur[v]=1;$("#m-talla-extra").value="";drawStockGrid(cur)};
$("#m-foto-del").onclick=()=>{modelFoto="";$("#m-foto").value="";drawThumb()};
$("#m-foto").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;
  try{modelFoto=await shrink(f,480,.82);if(modelFoto.length>180000)modelFoto=await shrink(f,360,.7);drawThumb()}catch(err){toast("No se pudo leer esa imagen. Prueba con otra foto.")}});
function shrink(file,max,q){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
    let d=c.toDataURL("image/webp",q);if(!d.startsWith("data:image/webp"))d=c.toDataURL("image/jpeg",q);res(d)};
  img.onerror=()=>{URL.revokeObjectURL(url);rej()};img.src=url})}
$("#form-model").addEventListener("submit",e=>{e.preventDefault();
  const marca=$("#m-marca").value.trim(),nombre=$("#m-nombre").value.trim();
  if(!marca||!nombre){toast("Escribe la marca y el nombre del modelo.");return}
  const prev=editModelId?state.modelos.find(m=>m.id===editModelId):null;
  const stock=readStockGrid();
  const data={marca,nombre,color:$("#m-color").value.trim(),precio:num($("#m-precio").value),costo:num($("#m-costo").value),stock,
    tallas:sortSizes(Object.keys(stock).filter(k=>stock[k]>0)),foto:modelFoto,creado:prev&&prev.creado?prev.creado:Date.now()};
  if(save("modelos",editModelId||uid(),data)){closeOv("#ov-model");toast(editModelId?"Modelo actualizado":"Modelo agregado al inventario")}});

/* ================= Formulario de venta / apartado ================= */
let editOrderId=null,orderKind="apartado";
function fillModelSelect(sel){
  const opts=state.modelos.slice().sort((a,b)=>modelLabel(a).localeCompare(modelLabel(b)));
  $("#o-modelo").innerHTML='<option value="">Elige un modelo</option>'+opts.map(m=>{const t=stockTotal(m),c=hasCounts(m);return '<option value="'+esc(m.id)+'">'+esc(modelLabel(m))+(c?(t?' ('+t+')':' (agotado)'):'')+'</option>'}).join("")+'<option value="__otro">Otro (escribir)</option>';
  $("#o-modelo").value=sel||""}
function fillSizes(keepTalla){
  const v=$("#o-modelo").value;const m=state.modelos.find(x=>x.id===v);
  $("#o-modelo-libre-f").hidden=v!=="__otro";
  const st=m?stockOf(m):{};const keys=sortSizes(Object.keys(st));
  const sel=$("#o-talla"),libre=$("#o-talla-libre");
  if(m&&keys.length){sel.style.display="";libre.style.display="none";
    sel.innerHTML='<option value="">Elige talla</option>'+keys.map(k=>{const q=st[k];const out=q!=null&&num(q)<=0;return '<option value="'+esc(k)+'"'+(out&&k!==keepTalla?' disabled':'')+'>'+esc(k)+(q!=null?(out?' · agotada':' · '+q+' disp.'):'')+'</option>'}).join("")+'<option value="__otra">Otra talla</option>';
    sel.value=keepTalla&&keys.includes(keepTalla)?keepTalla:(keepTalla?"__otra":"");if(sel.value==="__otra"){libre.style.display="";libre.value=keepTalla||""}}
  else{sel.style.display="none";libre.style.display="";libre.value=keepTalla||""}}
$("#o-modelo").addEventListener("change",()=>{fillSizes("");const m=state.modelos.find(x=>x.id===$("#o-modelo").value);if(m&&num(m.precio)>0)$("#o-precio").value=m.precio});
$("#o-talla").addEventListener("change",()=>{const o=$("#o-talla").value==="__otra";$("#o-talla-libre").style.display=o?"":"none";if(o)$("#o-talla-libre").focus()});
$("#o-cliente").addEventListener("change",()=>{const n=$("#o-cliente").value.trim().toLowerCase();const c=clientes().find(x=>x.nombre.toLowerCase()===n);if(c&&c.tel&&!$("#o-tel").value)$("#o-tel").value=c.tel});
function setKindUI(kind,editing){
  const contado=kind==="contado";
  $("#o-anticipo-f").hidden=editing||contado;$("#o-prox-f").hidden=contado&&!editing?true:false;
  if(editing&&kind==="contado")$("#o-prox-f").hidden=true;
  $("#o-metodo-f").hidden=editing;$("#o-entregado-f").hidden=contado&&!editing;
  $("#o-save").textContent=editing?"Guardar cambios":contado?"Cobrar y ver ticket":"Guardar apartado"}
function openOrder(p,opts){opts=opts||{};editOrderId=p?p.id:null;orderKind=p?(p.tipo||"apartado"):(opts.kind||"apartado");
  $("#ord-title").textContent=p?"Editar "+(orderKind==="contado"?"venta ":"pedido ")+p.numero:(orderKind==="contado"?"Venta de contado ":"Apartado ")+"#"+nextNumber();
  $("#clientes").innerHTML=clientes().map(c=>'<option value="'+esc(c.nombre)+'">'+esc(fphone(c.tel))+'</option>').join("");
  $("#o-cliente").value=p?p.cliente||"":"";$("#o-tel").value=p?p.telefono||"":"";$("#o-fecha").value=p?p.fecha||today():today();
  $("#o-precio").value=p?p.precio||"":"";$("#o-notas").value=p?p.notas||"":"";$("#o-entregado").checked=!!(p&&p.entregado);
  $("#o-anticipo").value="";$("#o-metodo").value="efectivo";$("#o-prox").value=p?(p.proximoPago||""):addDays(today(),15);
  let sel=opts.modelId||"";if(p)sel=p.modeloId&&state.modelos.some(m=>m.id===p.modeloId)?p.modeloId:(p.modelo?"__otro":"");
  fillModelSelect(sel);$("#o-modelo-libre").value=p&&sel==="__otro"?p.modelo||"":"";fillSizes(p?p.talla||"":"");
  if(!p&&opts.modelId){const m=state.modelos.find(x=>x.id===opts.modelId);if(m&&num(m.precio)>0)$("#o-precio").value=m.precio}
  setKindUI(orderKind,!!p);openOv("#ov-order");setTimeout(()=>{try{$("#o-cliente").focus()}catch(e){}},50)}
$("#form-order").addEventListener("submit",e=>{e.preventDefault();
  const cliente=$("#o-cliente").value.trim(),precio=num($("#o-precio").value);
  const contado=orderKind==="contado";
  if(!cliente&&!contado){toast("Escribe el nombre del cliente.");return}
  if(!(precio>0)){toast("Escribe el precio total.");return}
  const sel=$("#o-modelo").value;const m=state.modelos.find(x=>x.id===sel);
  const modelo=sel==="__otro"?$("#o-modelo-libre").value.trim():m?modelLabel(m):"";
  const tSel=$("#o-talla").style.display!=="none"?$("#o-talla").value:"__otra";
  const talla=tSel==="__otra"?$("#o-talla-libre").value.trim():tSel;
  if(m&&hasCounts(m)&&!talla){toast("Elige la talla.");return}
  const prev=editOrderId?state.pedidos.find(x=>x.id===editOrderId):null;
  const fecha=$("#o-fecha").value||today();
  const movs=prev&&Array.isArray(prev.movimientos)?prev.movimientos.map(x=>({...x})):[];
  let newMov=null;
  if(!prev){
    const metodo=$("#o-metodo").value;
    if(contado)newMov={id:uid(),fecha,hora:nowHM(),tipo:"abono",monto:precio,metodo,nota:"Pago de contado"};
    else{const ant=num($("#o-anticipo").value);if(ant>precio){toast("El anticipo no puede ser mayor que el precio.");return}
      if(ant>0)newMov={id:uid(),fecha,hora:nowHM(),tipo:"abono",monto:ant,metodo,nota:"Anticipo"}}
    if(newMov)movs.push(newMov)}
  /* Inventario: devolver el par anterior y descontar el nuevo */
  let stockRef=prev&&prev.stockRef?prev.stockRef:null;
  const changed=!prev||!stockRef||stockRef.modeloId!==(m?m.id:"")||stockRef.talla!==talla;
  if(changed){
    if(stockRef)adjustStock(stockRef.modeloId,stockRef.talla,+1);
    stockRef=null;
    if(m&&talla){const st=stockOf(m);if(talla in st&&st[talla]!=null){if(num(st[talla])<=0)toast("Ojo: esa talla estaba agotada en tu inventario.");if(adjustStock(m.id,talla,-1))stockRef={modeloId:m.id,talla}}}}
  const data={numero:prev?prev.numero:nextNumber(),tipo:prev?(prev.tipo||"apartado"):orderKind,cliente:cliente||"Mostrador",telefono:$("#o-tel").value.trim(),fecha,
    modeloId:m?m.id:"",modelo,talla,precio,costo:m?num(m.costo):(prev?num(prev.costo):0),notas:$("#o-notas").value.trim(),
    entregado:contado&&!prev?true:$("#o-entregado").checked,proximoPago:contado&&!prev?"":$("#o-prox").value,
    movimientos:movs,stockRef,creado:prev&&prev.creado?prev.creado:Date.now()};
  const id=editOrderId||uid();
  if(!save("pedidos",id,data))return;
  closeOv("#ov-order");
  const local={id,...data};const i=state.pedidos.findIndex(x=>x.id===id);if(i>=0)state.pedidos[i]=local;else state.pedidos.push(local);
  if(prev){toast("Cambios guardados");render();return}
  toast((contado?"Venta ":"Apartado ")+data.numero+" registrado");
  state.openId=id;state.payType="abono";renderDetail();openOv("#ov-detail");render();
  if(newMov)showTicket(local,newMov.id)});

/* ================= Acciones en el detalle ================= */
function updateOrder(p,patch){const data={...p,...patch};delete data.id;const ok=save("pedidos",p.id,data);if(ok){Object.assign(p,patch);render()}return ok}
$("#detail").addEventListener("click",async e=>{
  const p=state.pedidos.find(x=>x.id===state.openId);if(!p)return;
  const pt=e.target.closest("[data-pt]");if(pt){state.payType=pt.dataset.pt;renderDetail();return}
  const tk=e.target.closest("[data-ticket]");if(tk){showTicket(p,tk.dataset.ticket);return}
  const dm=e.target.closest("[data-del-mov]");if(dm){if(await confirmBox("¿Borrar este pago del historial?"))updateOrder(p,{movimientos:(p.movimientos||[]).filter(m=>m.id!==dm.dataset.delMov)})&&toast("Pago borrado");return}
  const a=e.target.closest("[data-act]");if(!a)return;
  const act=a.dataset.act;
  if(act==="liquidar"){const c=calc(p);if(c.saldo>0){$("#p-monto").value=c.saldo;state.payType="abono";$$("#payform [data-pt]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pt==="abono"))}}
  else if(act==="ticket-all")showTicket(p,null);
  else if(act==="edit-order")openOrder(p);
  else if(act==="toggle-ent")updateOrder(p,{entregado:!p.entregado})&&toast(p.entregado?"Marcado como entregado":"Marcado como no entregado");
  else if(act==="copy-msg"){try{await navigator.clipboard.writeText($("#msg-text").textContent);toast("Mensaje copiado")}catch(err){toast("No se pudo copiar. Selecciona el texto y cópialo a mano.")}}
  else if(act==="del-order"){
    const extra=p.stockRef?" El par regresa a tu inventario.":"";
    if(await confirmBox("¿Eliminar "+(p.tipo==="contado"?"la venta ":"el pedido ")+p.numero+(p.cliente?" de "+p.cliente:"")+"? Se borra también su historial de pagos."+extra)){
      if(p.stockRef)adjustStock(p.stockRef.modeloId,p.stockRef.talla,+1);
      if(remove("pedidos",p.id)){closeOv("#ov-detail");toast("Eliminado")}}}
});
$("#detail").addEventListener("submit",e=>{if(e.target.id!=="payform")return;e.preventDefault();
  const p=state.pedidos.find(x=>x.id===state.openId);if(!p)return;
  const monto=num($("#p-monto").value);if(!(monto>0)){toast("Escribe una cantidad mayor a 0.");return}
  const mov={id:uid(),fecha:$("#p-fecha").value||today(),hora:nowHM(),tipo:state.payType,monto,metodo:$("#p-metodo").value,nota:$("#p-nota").value.trim()};
  const movimientos=[...(p.movimientos||[]),mov];
  const after=calc({...p,movimientos});
  const patch={movimientos,proximoPago:after.saldo>0?($("#p-prox").value||p.proximoPago||""):""};
  $("#p-monto").value="";$("#p-nota").value="";
  if(updateOrder(p,patch)){state.payType="abono";
    if(mov.tipo==="abono"){toast(after.saldo<=0?"¡Pedido liquidado!":"Pago de "+money(monto)+" registrado");showTicket(p,mov.id)}
    else toast("Se restaron "+money(monto))}});

/* ================= Ticket ================= */
let tkBlob=null,tkName="ticket.png",tkUrl=null;
function loadLogo(){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src="logo.webp"})}
function wrap(x,text,maxW){const words=String(text||"").split(/\s+/);const lines=[];let cur="";
  for(const w of words){const t=cur?cur+" "+w:w;if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t}if(cur)lines.push(cur);return lines.length?lines:[""]}
async function drawTicket(p,movId){
  try{await document.fonts.ready}catch(e){}
  const W=576,P=30,B='"Barlow",Arial,sans-serif',D='"Barlow Condensed","Arial Narrow",Arial,sans-serif';
  const all=movsSorted(p);let mov=null,upto=all;
  if(movId){const i=all.findIndex(m=>m.id===movId);if(i>=0){mov=all[i];upto=all.slice(0,i+1)}}
  let pagado=0;for(const m of upto)pagado+=(m.tipo==="resta"?-1:1)*num(m.monto);
  const total=num(p.precio),saldo=Math.round((total-pagado)*100)/100;
  const pagos=all.filter(m=>m.tipo!=="resta");
  const folio=String(p.numero).padStart(4,"0")+(mov?"-"+String(pagos.indexOf(mov)+1):"");
  const c=document.createElement("canvas");c.width=W;c.height=2600;const x=c.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,c.height);x.fillStyle="#000";x.textBaseline="alphabetic";
  let y=24;
  const logo=await loadLogo();if(logo){x.drawImage(logo,(W-190)/2,y,190,190);y+=200}
  const center=(t,font,dy)=>{x.font=font;x.textAlign="center";x.fillText(t,W/2,y+dy);x.textAlign="left";y+=dy};
  center("SHEPO'S SNEAKER","800 46px "+D,44);
  center("Tenis 100% originales","600 24px "+B,32);
  center("Pedidos y WhatsApp: "+BIZ_PHONE,"500 22px "+B,30);
  const dash=()=>{y+=16;x.save();x.strokeStyle="#000";x.setLineDash([8,6]);x.lineWidth=2;x.beginPath();x.moveTo(P,y);x.lineTo(W-P,y);x.stroke();x.restore();y+=12};
  const row=(l,r,font,dy)=>{x.font=font||"500 24px "+B;x.textAlign="left";x.fillText(l,P,y+(dy||32));x.textAlign="right";x.fillText(r,W-P,y+(dy||32));x.textAlign="left";y+=(dy||32)};
  const text=(t,font,dy)=>{x.font=font||"500 24px "+B;for(const ln of wrap(x,t,W-2*P)){x.fillText(ln,P,y+(dy||30));y+=(dy||30)}};
  dash();
  center(mov?(p.tipo==="contado"&&saldo<=0&&pagos.length===1?"TICKET DE VENTA":"TICKET DE PAGO"):"ESTADO DE CUENTA","800 34px "+D,40);
  row("Folio: "+folio,fdate(mov&&mov.fecha?mov.fecha:today())+" "+(mov&&mov.hora?mov.hora:nowHM()),"600 24px "+B,36);
  row((p.tipo==="contado"?"Venta":"Pedido")+" #"+p.numero,p.tipo==="contado"?"Contado":"Apartado","500 22px "+B,30);
  dash();
  text("Cliente: "+(p.cliente||"Mostrador"),"600 24px "+B,32);
  if(p.telefono)text("Tel: "+fphone(p.telefono),"500 22px "+B,28);
  dash();
  x.font="700 22px "+B;x.fillText("ARTÍCULO",P,y+28);x.textAlign="right";x.fillText("IMPORTE",W-P,y+28);x.textAlign="left";y+=30;
  x.font="600 25px "+B;const desc=wrap(x,(p.modelo||"Tenis")+(p.talla?" · Talla "+p.talla:""),W-2*P-150);
  desc.forEach((ln,i)=>{x.fillText(ln,P,y+32);if(i===0){x.textAlign="right";x.fillText(money(total),W-P,y+32);x.textAlign="left"}y+=32});
  text("1 par","500 21px "+B,28);
  dash();
  if(mov){
    x.fillStyle="#000";x.fillRect(P,y+6,W-2*P,74);x.fillStyle="#fff";
    x.font="700 24px "+B;x.fillText(mov.inicial?"ABONADO ANTERIORMENTE":mov.tipo==="resta"?"DEVOLUCIÓN":(saldo<=0&&pagos.length===1?"PAGO TOTAL":"ABONO RECIBIDO"),P+16,y+36);
    x.font="500 20px "+B;x.fillText(METODOS[mov.metodo]||"",P+16,y+64);
    x.font="800 44px "+D;x.textAlign="right";x.fillText(money(mov.monto),W-P-16,y+60);x.textAlign="left";x.fillStyle="#000";y+=90;
    if(mov.nota)text("Nota: "+mov.nota,"italic 500 21px "+B,28);
  } else {
    x.font="700 22px "+B;x.fillText("PAGOS",P,y+28);y+=32;
    if(!all.length)text("Sin pagos registrados","500 22px "+B,28);
    for(const m of all){const neg=m.tipo==="resta";row((m.fecha?fdate(m.fecha):"Sin fecha")+"  "+(neg?"Resta":(METODOS[m.metodo]||"Pago")),(neg?"-":"")+money(m.monto),"500 22px "+B,30)}
  }
  dash();
  row("Total",money(total),"600 26px "+B,34);
  row(mov?"Pagado a la fecha":"Total pagado",money(pagado),"600 26px "+B,34);
  row(saldo>0?"SALDO PENDIENTE":saldo<0?"SALDO A FAVOR":"SALDO",money(Math.abs(saldo)),"800 34px "+D,46);
  if(saldo>0&&p.proximoPago){text("Próximo pago: "+fdate(p.proximoPago),"700 24px "+B,32)}
  if(saldo<=0&&total>0){y+=10;x.save();x.strokeStyle="#000";x.lineWidth=4;x.strokeRect(W/2-130,y,260,60);x.font="800 40px "+D;x.textAlign="center";x.fillText("LIQUIDADO",W/2,y+45);x.restore();x.textAlign="left";y+=70}
  dash();
  center("¡GRACIAS POR TU COMPRA!","800 32px "+D,40);
  center("Conserva este ticket como comprobante","500 20px "+B,28);
  if(p.tipo!=="contado"&&saldo>0)center("Tu par se entrega al liquidar el total","500 20px "+B,26);
  y+=30;
  const out=document.createElement("canvas");out.width=W;out.height=y;out.getContext("2d").drawImage(c,0,0);
  tkName="ticket-shepos-"+folio+".png";
  return await new Promise(r=>out.toBlob(r,"image/png"))}
async function showTicket(p,movId){
  try{tkBlob=await drawTicket(p,movId)}catch(e){toast("No se pudo generar el ticket.");return}
  if(tkUrl)URL.revokeObjectURL(tkUrl);tkUrl=URL.createObjectURL(tkBlob);$("#tk-img").src=tkUrl;
  const c=calc(p);const wa=waLink(p.telefono,"Hola "+(p.cliente||"")+", te comparto tu ticket de Shepo's Sneaker. "+(c.saldo>0?"Saldo pendiente: "+money(c.saldo)+".":"¡Gracias por tu compra!"));
  const a=$("#tk-wa");if(wa){a.href=wa;a.hidden=false}else a.hidden=true;
  const f=tkFile();$("#tk-share").hidden=!(f&&navigator.canShare&&navigator.canShare({files:[f]}));
  openOv("#ov-ticket")}
function tkFile(){try{return new File([tkBlob],tkName,{type:"image/png"})}catch(e){return null}}
function saveBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
$("#tk-share").onclick=async()=>{const f=tkFile();if(!f)return;try{await navigator.share({files:[f],title:"Ticket Shepo's Sneaker"})}catch(e){if(e&&e.name==="AbortError")return;toast("No se pudo compartir. Usa Guardar imagen.")}};
$("#tk-save").onclick=()=>{if(tkBlob){saveBlob(tkBlob,tkName);toast("Ticket guardado")}};
$("#tk-print").onclick=()=>{if(!tkUrl)return;const pa=$("#print-area");pa.innerHTML='<img alt="Ticket">';const img=pa.querySelector("img");
  img.onload=()=>{setTimeout(()=>{try{window.print()}catch(e){toast("Tu navegador no permite imprimir desde aquí.")}},100)};img.src=tkUrl};

/* ================= Excel ================= */
const MONEYF='"$"#,##0.00';
function xlDate(s){if(!s)return "";const [y,m,d]=String(s).split("-").map(Number);if(!y||!m||!d)return s;return {t:"n",v:(Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000,z:"dd/mm/yyyy"}}
function sheet(rows,widths,moneyCols){const ws=XLSX.utils.aoa_to_sheet(rows);const r=XLSX.utils.decode_range(ws["!ref"]);
  for(let R=1;R<=r.e.r;R++)for(const C of moneyCols){const a=XLSX.utils.encode_cell({r:R,c:C});if(ws[a]&&ws[a].t==="n")ws[a].z=MONEYF}
  ws["!cols"]=widths.map(w=>({wch:w}));if(r.e.r>0)ws["!autofilter"]={ref:ws["!ref"]};return ws}
function exportExcel(){
  if(!window.XLSX){toast("No se pudo preparar el Excel. Recarga la app e intenta de nuevo.");return}
  const peds=state.pedidos.slice().sort((a,b)=>num(a.numero)-num(b.numero));
  const V=[["No.","Tipo","Fecha","Cliente","Teléfono","Modelo","Talla","Precio","Costo","Ganancia","Pagado","Saldo","Estado","Próximo pago","Entregado","Notas"]];
  const A=[["No.","Cliente","Fecha","Hora","Movimiento","Forma de pago","Cantidad","Nota"]];
  for(const p of peds){const c=calc(p);const co=num(p.costo);
    V.push([num(p.numero),p.tipo==="contado"?"Contado":"Apartado",xlDate(p.fecha),p.cliente||"",fphone(p.telefono),p.modelo||"",p.talla||"",c.total,co||"",co?c.total-co:"",c.pagado,c.saldo,c.late?"Atrasado":c.lab,c.saldo>0?xlDate(p.proximoPago):"",p.entregado?"Sí":"No",p.notas||""]);
    for(const m of movsSorted(p)){const v=num(m.monto);A.push([num(p.numero),p.cliente||"",xlDate(m.fecha),m.hora||"",m.tipo==="resta"?"Resta":"Pago",METODOS[m.metodo]||"",m.tipo==="resta"?-v:v,m.nota||""])}}
  const I=[["Marca","Modelo","Color","Precio","Costo","Ganancia por par","Pares","Existencias por talla"]];
  for(const m of state.modelos.slice().sort((a,b)=>modelLabel(a).localeCompare(modelLabel(b)))){const st=stockOf(m);
    I.push([m.marca||"",m.nombre||"",m.color||"",num(m.precio),num(m.costo)||"",num(m.costo)?num(m.precio)-num(m.costo):"",hasCounts(m)?stockTotal(m):"",sortSizes(Object.keys(st)).map(k=>st[k]==null?k:k+": "+st[k]).join(", ")])}
  const now=new Date();let tot=0,cob=0,pen=0;for(const p of peds){const c=calc(p);tot+=c.total;cob+=c.pagado;if(c.saldo>0)pen+=c.saldo}
  const R=[["Shepo's Sneaker · Resumen"],["Generado el",now.toLocaleDateString("es-MX")+" "+nowHM()],[],["Ventas registradas",peds.length],["Total vendido",tot],["Total cobrado",cob],["Por cobrar",pen],["Pagos atrasados",peds.filter(p=>calc(p).late).length],["Pares en inventario",state.modelos.reduce((a,m)=>a+stockTotal(m),0)]];
  const wsR=XLSX.utils.aoa_to_sheet(R);["B5","B6","B7"].forEach(a=>{if(wsR[a])wsR[a].z=MONEYF});wsR["!cols"]=[{wch:24},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,wsR,"Resumen");
  XLSX.utils.book_append_sheet(wb,sheet(V,[6,10,12,22,14,30,7,11,11,11,11,11,11,13,10,28],[7,8,9,10,11]),"Ventas");
  const DD=[["Persona","Teléfono","Modelo","Talla","Precio","Abonado","Último abono","Monto último abono","Debe","Próximo pago","Estado","Deuda anterior"]];
  for(const p of peds.slice().sort((a,b)=>(a.cliente||"").localeCompare(b.cliente||""))){const c=calc(p);if(!(c.saldo>0))continue;const lp=lastPay(p);
    DD.push([p.cliente||"",fphone(p.telefono),p.modelo||"",p.talla||"",c.total,c.pagado,lp?xlDate(lp.fecha):"",lp&&!lp.inicial?num(lp.monto):"",c.saldo,xlDate(p.proximoPago),c.late?"Atrasado":"Al corriente",p.anterior?"Sí":"No"])}
  XLSX.utils.book_append_sheet(wb,sheet(DD,[22,14,30,7,11,11,13,12,11,13,12,10],[4,5,7,8]),"Deudores");
  XLSX.utils.book_append_sheet(wb,sheet(A,[6,22,12,8,10,14,12,26],[6]),"Pagos");
  XLSX.utils.book_append_sheet(wb,sheet(I,[12,20,20,11,11,14,8,44],[3,4,5]),"Inventario");
  const buf=XLSX.write(wb,{bookType:"xlsx",type:"array",compression:true});
  saveBlob(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"shepos-sneaker-"+today()+".xlsx");toast("Excel descargado")}
$$(".xlsx-btn").forEach(b=>b.addEventListener("click",exportExcel));

/* ================= Respaldo ================= */
$("#bk-file").addEventListener("change",async e=>{const file=e.target.files[0];e.target.value="";if(!file)return;
  let d;try{d=JSON.parse(await file.text())}catch(err){toast("Ese archivo no es un respaldo válido.");return}
  if(!d||typeof d.modelos!=="object"||typeof d.pedidos!=="object"){toast("Ese archivo no es un respaldo de Shepo's Sneaker.");return}
  const n=Object.keys(d.pedidos).length,m=Object.keys(d.modelos).length;
  if(!await confirmBox("¿Importar "+n+" venta(s) y "+m+" modelo(s)? Se agregan a lo que ya tienes; si un registro ya existe, se reemplaza.","Sí, importar"))return;
  for(const [id,v] of Object.entries(d.modelos))save("modelos",id,v);
  for(const [id,v] of Object.entries(d.pedidos))save("pedidos",id,v);
  toast("Respaldo importado")});

/* ================= Navegación y eventos ================= */
function route(){const h=location.hash.replace("#","");state.view=["deudores","catalogo","reportes"].includes(h)?h:"ventas";render();window.scrollTo(0,0)}
window.addEventListener("hashchange",route);
$("#q-ped").addEventListener("input",e=>{state.qp=e.target.value;renderOrders()});
$("#q-cat").addEventListener("input",e=>{state.qc=e.target.value;renderCatalog()});
$("#q-debt").addEventListener("input",e=>{state.qd=e.target.value;renderDebts()});
$("#f-debt").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;state.debtFilter=b.dataset.f;$$("#f-debt .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));renderDebts()});
$("#btn-deuda").onclick=()=>openDebt();
$("#rep-mes").addEventListener("change",e=>{state.repMes=e.target.value||today().slice(0,7);renderReport()});
$("#f-ped").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;state.filter=b.dataset.f;$$("#f-ped .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));renderOrders()});
$("#f-cat").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;state.catFilter=b.dataset.f;$$("#f-cat .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));renderCatalog()});
$("#btn-contado").onclick=()=>openOrder(null,{kind:"contado"});
$("#btn-apartado").onclick=()=>openOrder(null,{kind:"apartado"});
$("#btn-new-model").onclick=()=>openModel(null);
document.addEventListener("click",async e=>{
  if(e.target.closest("#detail"))return;
  const o=e.target.closest("[data-open]");if(o){state.openId=o.dataset.open;state.payType="abono";$("#detail").innerHTML="";renderDetail();openOv("#ov-detail");return}
  const a=e.target.closest("[data-act]");
  if(a){const k=a.dataset.act;
    if(k==="contado")openOrder(null,{kind:"contado"});
    if(k==="apartado")openOrder(null,{kind:"apartado"});
    if(k==="new-model")openModel(null);
    if(k==="deuda")openDebt();
    if(k==="seed"){for(const [id,m] of Object.entries(SEED))save("modelos",id,{...m,costo:0,stock:{}});toast("Modelos agregados. Ponles precio y existencias con Editar.")}
    return}
  const s=e.target.closest("[data-sell]");if(s){openOrder(null,{kind:s.dataset.kind,modelId:s.dataset.sell});return}
  const em=e.target.closest("[data-edit-model]");if(em){openModel(state.modelos.find(m=>m.id===em.dataset.editModel));return}
  const dm=e.target.closest("[data-del-model]");if(dm){const m=state.modelos.find(x=>x.id===dm.dataset.delModel);if(m&&await confirmBox("¿Eliminar "+modelLabel(m)+" del inventario? Las ventas que ya lo tienen no se borran.")){if(remove("modelos",m.id))toast("Modelo eliminado")}}
});

route();start();
if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})})}
