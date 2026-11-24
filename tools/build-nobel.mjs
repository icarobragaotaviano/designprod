import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {apps} from '../nobel/catalogo.mjs';

const raiz=fileURLToPath(new URL('../',import.meta.url));
const fonte=path.join(raiz,'nobel');
const saida=path.join(raiz,'site/publico/nobel');
const arquivo=(p)=>readFile(path.join(fonte,p));
const head=(titulo,base)=>`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${base}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#09584b"><title>${titulo} · Nobel</title><link rel="stylesheet" href="estilo.css"></head>`;
const estilo=await arquivo('estilo.css');
await mkdir(saida,{recursive:true});
await writeFile(path.join(saida,'estilo.css'),estilo);
let secoes='';
for(const categoria of [...new Set(apps.map(a=>a[2]))]){
  const cards=apps.filter(a=>a[2]===categoria).map(([id,t,,desc])=>`<a class="cartao" href="${id}/"><h3>${t}</h3><p>${desc}</p></a>`).join('');
  secoes+=`<section><h2>${categoria}</h2><div class="catalogo">${cards}</div></section>`;
}
const integracoes=[['preparar-pasta.ps1','Windows · Preparar pasta da OS'],['abrir-os-corel.bas','CorelDRAW · Abrir pasta da arte'],['abrir-gabarito-illustrator.jsx','Illustrator · Abrir gabarito'],['trace-calendario.js','TraceDraw · Gabarito de calendário'],['conferir-faca-vectorcraft.js','VectorCraft · Conferir contornos de faca'],['inspecionar-photocraft.ps1','PhotoCraft · Inspecionar PSDs']];
await mkdir(path.join(saida,'desktop'),{recursive:true});
for(const [nome] of integracoes)await writeFile(path.join(saida,'desktop',nome),await arquivo('desktop/'+nome));
secoes+='<section><h2>Utilitários de desktop</h2><div class="catalogo">'+integracoes.map(([nome,t])=>'<a download class="cartao" href="desktop/'+nome+'">'+t+'</a>').join('')+'</div></section>';
await writeFile(path.join(saida,'index.html'),head('Bancada de produção','/nobel/')+`<body><header><strong>Nobel Gráfica</strong><a href="/">DesignProd</a></header><main><h1>Bancada de produção</h1>${secoes}</main></body></html>`);

for(const [id,titulo,,descricao,origem,modo] of apps){
  const base='/nobel/'+id+'/';
  const dir=path.join(saida,id);
  await mkdir(dir,{recursive:true});
  const arquivos=new Map();
  if(origem){
    for(const nome of await readdir(path.join(fonte,'origens',origem))){
      if(!nome.endsWith('.sql')) arquivos.set(nome,await arquivo('origens/'+origem+'/'+nome));
    }
  }else{
    for(const nome of ['bancada.mjs','calculos.mjs','estilo.css'])arquivos.set(nome,await arquivo(nome));
    for(const nome of ['model.js','storage.js'])arquivos.set(nome,await arquivo('origens/os/'+nome));
    arquivos.set('index.html',head(titulo,base)+`<body data-app="${id}"><main><h1>${titulo}</h1><p>${descricao}</p><div class="painel"><form><fieldset aria-label="Parâmetros"></fieldset><button type="submit">${id==='enderecos'?'Localizar OS':'Gerar resultado'}</button></form><article><h2>Resultado</h2><div id="resultado"></div><p role="status" id="aviso"></p></article></div></main><script type="module" src="bancada.mjs"></script></body></html>`);
  }
  let html=arquivos.get('index.html').toString();
  if(origem)html=html.replace(/<head>/i,'<head><base href="'+base+'">').replace(/<title>.*?<\/title>/i,'<title>'+titulo+' · Nobel</title>');
  html=html.replace('</head>','<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-192.png"></head>')
    .replace(/<body([^>]*)>/i,'<body$1><nav class="nobel-nav" style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#063f38;color:white;font:14px system-ui"><a style="color:white" href="/nobel/">← Bancada Nobel</a><button id="instalar-nobel" type="button" hidden>Instalar app</button></nav>')
    .replace('</body>','<script src="iniciar.js" defer></script></body>');
  arquivos.set('index.html',html);
  if(origem==='folha')arquivos.set('app.js',arquivos.get('app.js').toString()+'\nsetMode('+JSON.stringify(modo)+');\n');
  if(origem==='os' && process.env.VERCEL_PROJECT_PRODUCTION_URL){
    const oficial='https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL;
    arquivos.set('cloud.js',arquivos.get('cloud.js').toString().replaceAll('https://folha-imposicao.vercel.app',oficial));
  }
  if(origem==='os' && modo==='counter')arquivos.set('app.js',arquivos.get('app.js').toString().replace('  initOsManager();',"  initOsManager().setActiveArea('counter');"));
  arquivos.set('iniciar.js',`if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  const botao=document.querySelector('#instalar-nobel');
  botao.hidden=false;
  botao.onclick=async()=>{await event.prompt();botao.hidden=true;};
});`);
  const icons=[];
  for(const tamanho of [192,512]){
    const src='icon-'+tamanho+'.png';
    arquivos.set(src,Buffer.from((await arquivo(src+'.b64')).toString(),'base64'));
    icons.push({src,sizes:tamanho+'x'+tamanho,type:'image/png'});
  }
  arquivos.set('manifest.webmanifest',JSON.stringify({id:base,name:titulo+' · Nobel',short_name:titulo,start_url:base,scope:base,lang:'pt-BR',display:'standalone',background_color:'#f4f4ec',theme_color:'#09584b',icons}));
  const hash=createHash('sha256');
  for(const [nome,conteudo] of arquivos){hash.update(nome).update(conteudo);await writeFile(path.join(dir,nome),conteudo);}
  const prefixo='nobel-'+id+'-';
  const versao=prefixo+hash.digest('hex').slice(0,16);
  const recursos=['./',...Array.from(arquivos.keys()).filter(n=>n!=='index.html')];
  await writeFile(path.join(dir,'sw.js'),`const cacheAtual=${JSON.stringify(versao)};
const recursos=${JSON.stringify(recursos)};
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheAtual).then(c=>c.addAll(recursos))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k.startsWith(${JSON.stringify(prefixo)}) && k!==cacheAtual)await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const base=new URL(self.registration.scope);
  if(u.origin!==base.origin || !(u.pathname.startsWith(base.pathname) || u.pathname+'/'===base.pathname))return;
  e.respondWith((async()=>{
    const c=await caches.open(cacheAtual);
    if(e.request.mode==='navigate')return await c.match(base.href) || fetch(e.request);
    return await c.match(e.request) || fetch(e.request);
  })());
});`);
}
console.log(apps.length+' aplicativos disponíveis em /nobel/');
