import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scriptsRemendo,photoshopRemendo} from '../nobel/remendo/versoes.mjs';
import {apps,desktop as integracoes} from '../nobel/catalogo.mjs';

const raiz=fileURLToPath(new URL('../',import.meta.url));
const fonte=path.join(raiz,'nobel');
const saida=path.join(raiz,'site/publico/apps');
const arquivo=(p)=>readFile(path.join(fonte,p));
const head=(titulo,base)=>`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${base}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#181a1f"><title>${titulo} · IBD</title><link rel="stylesheet" href="estilo.css"></head>`;
const estilo=await arquivo('estilo.css');
const layout=await arquivo('ferramentas/layout.css');
await mkdir(saida,{recursive:true});
await writeFile(path.join(saida,'estilo.css'),estilo);

await mkdir(path.join(saida,'desktop'),{recursive:true});
const geometrias = new Map([
  ['/* @ibd-remendo-janela */', (await arquivo('remendo/janela.js')).toString('utf8')],
  ['/* @ibd-imposicao-grade */', (await arquivo('imposicao/grade.js')).toString('utf8')]
]);
for (const [nome] of integracoes) {
  let codigo = (await arquivo('desktop/'+nome)).toString('utf8');
  for (const [marcador, geometria] of geometrias) codigo = codigo.replace(marcador, () => geometria);
  await writeFile(path.join(saida,'desktop',nome),codigo);
}
for(const [id,titulo,,descricao,origem,modo] of apps){
  const base='/apps/'+id+'/';
  const dir=path.join(saida,id);
  await mkdir(dir,{recursive:true});
  const arquivos=new Map();
  if(origem==='dedicado'){
    const nomes=['calculo','componentes','diagramas','interface',id];
    const pastaMotor='core/producao/folha/';
    for(const nome of nomes){
      const codigo=await arquivo('ferramentas/'+nome+'.mjs');
      arquivos.set('ferramentas/'+nome+'.mjs',nome==='calculo'
        ? codigo.toString().replaceAll('../../'+pastaMotor,'../'+pastaMotor) : codigo);
    }
    for(const nome of ['engine.js','operacoes.js']){
      arquivos.set(pastaMotor+nome,await readFile(path.join(raiz,pastaMotor,nome)));
    }
    if(id==='lona'){
      for(const nome of ['producao/calculo.mjs','calculos.mjs'])arquivos.set(nome,await arquivo(nome));
    }
    arquivos.set('estilo.css',estilo);
    arquivos.set('app.mjs',`import { iniciarApp } from './ferramentas/interface.mjs';
import * as app from './ferramentas/${id}.mjs';
iniciarApp(app);
`);
    arquivos.set('index.html',head(titulo,base)+`<body data-app="${id}" data-app-layout="dedicado"><main><div class="cabecalho-app"><h1>${titulo}</h1><p>${descricao}</p></div><div class="painel"><form id="parametros" aria-label="Parâmetros"><button type="submit">Calcular</button></form><article id="painel-resultado" aria-labelledby="titulo-resultado"><h2 id="titulo-resultado">Resultado</h2><div id="controles-resultado" class="controles-resultado"></div><p role="status" id="aviso"></p><div id="resultado"></div></article></div></main><script type="module" src="app.mjs"></script></body></html>`);
  }else if(origem==='producao'){
    for(const nome of ['interface.mjs','calculo.mjs','fluxo.mjs','codigos.mjs','code128.mjs','qrcode.js','estilo.css','QR-LICENSE.txt','JSBARCODE-LICENSE.txt']){
      arquivos.set('producao/'+nome,await arquivo('producao/'+nome));
    }
    for(const nome of ['calculos.mjs','gabarito-editores.mjs'])arquivos.set(nome,await arquivo(nome));
    arquivos.set('estilo.css',estilo);
    if(id==='lote-imagens')arquivos.set('lote-ps.txt',await arquivo('producao/lote-ps.txt'));
    const cabecalho=head(titulo,base).replace('</head>','<link rel="stylesheet" href="producao/estilo.css"></head>');
    const qr=id==='codigos'?'<script src="producao/qrcode.js"></script>':'';
    arquivos.set('index.html',cabecalho+`<body data-app="${id}" data-app-layout="formulario" data-producao><main><h1>${titulo}</h1><p>${descricao}</p><div class="painel"><form><fieldset aria-label="Parâmetros"></fieldset><button type="submit">Gerar resultado</button></form><article><h2>Resultado</h2><p role="status" id="aviso"></p><div id="resultado"></div></article></div></main>${qr}<script type="module" src="producao/interface.mjs"></script></body></html>`);
  }else if(origem){
    for(const nome of await readdir(path.join(fonte,'origens',origem))){
      if(nome.endsWith('.sql')) continue;
      arquivos.set(nome,await arquivo('origens/'+origem+'/'+nome));
    }
  }else{
    for(const nome of ['bancada.mjs','calculos.mjs','gabarito-editores.mjs','estilo.css'])arquivos.set(nome,await arquivo(nome));
    for(const nome of ['model.js','storage.js'])arquivos.set(nome,await arquivo('origens/os/'+nome));
    const downloadsRemendo = id === 'remendo' ? [
      ['Photoshop','/downloads/ferramentas/'+photoshopRemendo+'.jsx'],
      ...scriptsRemendo.map(([arquivo,rotulo])=>[rotulo.split(' · ')[0],'/apps/desktop/'+arquivo])
    ] : [];
    const linksRemendo = downloadsRemendo.length
      ? '<section aria-label="Scripts de desktop"><h2>Scripts de desktop</h2>'+downloadsRemendo
        .map(([nome,href])=>'<a class="acao" href="'+href+'" download>'+nome+'</a>').join('')+'</section>'
      : '';
    arquivos.set('index.html',head(titulo,base)+`<body data-app="${id}" data-app-layout="formulario"><main><h1>${titulo}</h1><p>${descricao}</p>${linksRemendo}<div class="painel"><form><fieldset aria-label="Parâmetros"></fieldset><button type="submit">${id==='enderecos'?'Localizar OS':'Gerar resultado'}</button></form><article><h2>Resultado</h2><div id="resultado"></div><p role="status" id="aviso"></p></article></div></main><script type="module" src="bancada.mjs"></script></body></html>`);
  }
  arquivos.set('ibd-theme.css',await readFile(path.join(raiz,'docs/ibd-theme.css')));
  let html=arquivos.get('index.html').toString();
  if(origem==='os'||origem==='numera')html=html.replace(/<head>/i,'<head><base href="'+base+'">').replace(/<title>.*?<\/title>/i,'<title>'+titulo+' · IBD</title>');
  html=html.replace('</head>','<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=Space+Mono:wght@400;700&amp;display=swap"><link rel="stylesheet" href="ibd-theme.css"></head>').replace('</head>','<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-192.png"></head>')
    .replace(/<body([^>]*)>/i,'<body$1><nav class="ibd-nav"><a class="ibd-sign" href="/"><span class="ibd-mark">ib<span class="ibd-dot">.</span></span>designprod<span class="ibd-dot">.</span></a><span class="ibd-sub">Suíte de produção gráfica IBD</span><button id="instalar-nobel" type="button" hidden>Instalar app</button></nav>')
    .replace('</body>','<script src="iniciar.js" defer></script></body>');
  if(html.includes('data-app-layout=')){
    arquivos.set('layout-app.css',layout);
    html=html.replace('</head>','<link rel="stylesheet" href="layout-app.css"></head>');
  }
  arquivos.set('index.html',html);
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
  arquivos.set('manifest.webmanifest',JSON.stringify({id:origem==='producao'?base:'/nobel/'+id+'/',name:titulo+' · IBD',short_name:titulo,start_url:base,scope:base,lang:'pt-BR',display:'standalone',background_color:'#181a1f',theme_color:'#181a1f',icons}));
  const hash=createHash('sha256');
  for(const [nome,conteudo] of arquivos){
    hash.update(nome).update(conteudo);
    const destino=path.join(dir,nome);
    await mkdir(path.dirname(destino),{recursive:true});
    await writeFile(destino,conteudo);
  }
  const prefixo='nobel-'+id+'-';
  const versao=prefixo+hash.digest('hex').slice(0,16);
  const recursos=['./',...Array.from(arquivos.keys()).filter(n=>n!=='index.html')];
  await writeFile(path.join(dir,'sw.js'),`const cacheAtual=${JSON.stringify(versao)};
const recursos=${JSON.stringify(recursos)};
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const cache=await caches.open(cacheAtual);
  await cache.addAll(recursos.map(r=>new Request(r,{cache:'reload'})));
  ${origem==='dedicado'?'await self.skipWaiting();':''}
})()));
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
    if(e.request.mode==='navigate'){
      ${origem==='dedicado'?'try { const atual=await fetch(e.request); if(atual.ok)return atual; } catch {}':''}
      return await c.match(base.href) || fetch(e.request);
    }
    return await c.match(e.request) || fetch(e.request);
  })());
});`);
}
console.log(apps.length+' aplicativos disponíveis em /apps/');
