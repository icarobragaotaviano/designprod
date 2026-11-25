#!/usr/bin/env node
/**
 * Criador de plugin com icone personalizado ("iconezinho").
 * Transforma um unico script ou uma selecao de favoritos em um pacote
 * instalavel para o software escolhido (UXP .ccx, CEP .zip, CorelDRAW .zip + .ico,
 * painel ScriptUI do After Effects .jsx ou bundle TraceDraw .js).
 *
 * Uso:
 *   npm run plugin:criar -- --tools illustrator/margem-seguranca-guias --icone guia-interna --cor "#68a8e8" --nome "Margem Segura"
 *   npm run plugin:criar -- --tools photoshop/auto-layout,photoshop/redimensionar-lote --formato uxp --nome "Kit Layout"
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarZip } from './lib/zip.mjs';
import { ICONES, PALETA_ICONES, resolverIconeId, iconeSvg, gerarPngIcone, gerarIcoIcone } from './lib/icones.mjs';
import { resolverIncludes, montarArquivoPublicavel } from './lib/incluir.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function slugify(texto) {
  return String(texto || 'plugin')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom';
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inferirFormato(selecionadas) {
  const apps = [...new Set(selecionadas.map((f) => f.app))];
  if (apps.length === 1) {
    if (apps[0] === 'photoshop') return 'photoshop-uxp';
    if (apps[0] === 'indesign') return 'indesign-uxp';
    if (apps[0] === 'coreldraw') return 'coreldraw-barra';
    if (apps[0] === 'tracedraw') return 'tracedraw';
    if (apps[0] === 'aftereffects') return 'aftereffects-painel';
    return 'adobe-cep';
  }
  return 'adobe-cep';
}

/**
 * Monta um plugin instalavel a partir de uma lista de IDs do catalogo.
 */
export async function criarPluginCustom({
  raiz = RAIZ,
  tools = [],
  nome,
  icone,
  cor = PALETA_ICONES[0].hex,
  fundo = PALETA_ICONES[0].fundo,
  formato = 'auto',
  saida
}) {
  const marca = JSON.parse(await readFile(path.join(raiz, 'brand.config.json'), 'utf8'));
  const catalogo = JSON.parse(await readFile(path.join(raiz, 'catalog.json'), 'utf8'));
  const mapa = new Map((catalogo.ferramentas || []).map((f) => [f.id, f]));

  const ids = (Array.isArray(tools) ? tools : String(tools).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) throw new Error('Informe ao menos uma ferramenta em --tools.');

  const selecionadas = ids.map((id) => {
    const item = mapa.get(id);
    if (!item) throw new Error(`Ferramenta nao encontrada no catalogo: ${id}`);
    if (item.tipo !== 'script') throw new Error(`Apenas scripts podem ser empacotados como plugin (${id} e ${item.tipo}).`);
    return item;
  });

  const primeiro = selecionadas[0];
  const nomeFinal = (nome && nome.trim()) || (selecionadas.length === 1 ? primeiro.titulo : `${marca.nome} Kit Personalizado`);
  const slug = slugify(nomeFinal);
  const iconeId = (icone && ICONES[icone]) ? icone : (primeiro.icone || resolverIconeId(primeiro.id, 'script'));
  const formatoReal = (!formato || formato === 'auto') ? inferirFormato(selecionadas) : formato;
  const versao = primeiro.versao || marca.versao || '1.0.0';
  const dirDist = path.join(raiz, 'dist');
  await mkdir(dirDist, { recursive: true });

  const standaloneMap = new Map();
  for (const f of selecionadas) {
    const ext = path.extname(f.arquivo).toLowerCase();
    const { conteudo, embutidos } = ext === '.jsx'
      ? await resolverIncludes(raiz, f.arquivo)
      : { conteudo: await readFile(path.join(raiz, f.arquivo), 'utf8'), embutidos: [] };
    standaloneMap.set(f.id, montarArquivoPublicavel(f, marca, conteudo, embutidos));
  }

  /* 1. Photoshop / InDesign UXP (.ccx / .zip) --------------------------- */
  if (formatoReal === 'photoshop-uxp' || formatoReal === 'indesign-uxp' || formatoReal === 'uxp') {
    const ehInDesign = formatoReal === 'indesign-uxp' || (selecionadas.every((f) => f.app === 'indesign'));
    const hostApp = ehInDesign ? 'ID' : 'PS';
    const hostMin = ehInDesign ? '18.5.0' : '24.0.0';
    const pluginId = `com.${marca.id}.custom.${slug.replace(/[^a-z0-9]/g, '') || 'tool'}`.slice(0, 48);

    const manifest = {
      manifestVersion: 5,
      id: pluginId,
      name: nomeFinal,
      version: /^\d+\.\d+\.\d+$/.test(versao) ? versao : '1.0.0',
      main: 'src/index.html',
      host: [{ app: hostApp, minVersion: hostMin }],
      entrypoints: [
        {
          type: 'panel',
          id: `${pluginId}.painel`,
          label: { default: nomeFinal },
          minimumSize: { width: 220, height: 180 },
          maximumSize: { width: 1600, height: 1600 },
          preferredDockedSize: { width: 280, height: 360 },
          preferredFloatingSize: { width: 320, height: 420 }
        }
      ],
      requiredPermissions: { localFileSystem: 'fullAccess' },
      icons: [
        { width: 48, height: 48, path: 'src/icons/icone-48.png', scale: [1, 2], theme: ['darkest', 'dark', 'medium', 'lightest', 'light'] }
      ]
    };

    const metaTools = selecionadas.map((f, idx) => ({
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      arquivo: `src/scripts/${idx}-${path.basename(f.arquivo)}`
    }));

    const svgCustom = iconeSvg(iconeId, cor, 28);
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeXml(nomeFinal)}</title>
<style>
body{margin:0;padding:10px;background:${fundo};color:#e4e7ee;font-family:"Adobe Clean","Segoe UI",sans-serif;font-size:12px}
.hdr{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid #3a404d}
.ico{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#181a1f;border:1px solid ${cor}}
h1{margin:0;font-size:13px}.sub{font-size:10px;color:#b6bcc8}
.list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.btn{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:1px solid #3a404d;background:#20232a;color:#e4e7ee;text-align:left;cursor:pointer}
.btn:hover{border-color:${cor}}
.t{font-weight:600;font-size:12px}.d{font-size:10px;color:#b6bcc8;margin-top:2px}
#st{margin-top:12px;font-size:10px;color:#b6bcc8}
</style></head><body>
<div class="hdr"><span class="ico">${svgCustom}</span><div><h1>${escapeXml(nomeFinal)}</h1><span class="sub">${ehInDesign ? 'InDesign UXP' : 'Photoshop UXP'}</span></div></div>
<div class="list" id="lista"></div><div id="st">Pronto.</div>
<script src="main.js"></script></body></html>`;

    const mainJs = ehInDesign
      ? `const { app, ScriptLanguage } = require('indesign');
const fs = require('uxp').storage.localFileSystem;
const TOOLS = ${JSON.stringify(metaTools)};
const st = document.getElementById('st');
const lista = document.getElementById('lista');
async function rodar(t) {
  st.textContent = 'Executando ' + t.titulo + '...';
  try {
    const pasta = await fs.getPluginFolder();
    const arq = await pasta.getEntry(t.arquivo);
    const code = await arq.read();
    app.doScript(code, ScriptLanguage.JAVASCRIPT);
    st.textContent = 'Concluido: ' + t.titulo;
  } catch (e) { st.textContent = 'Erro: ' + (e.message || e); }
}`
      : `const { core, action } = require('photoshop');
const fs = require('uxp').storage.localFileSystem;
const TOOLS = ${JSON.stringify(metaTools)};
const st = document.getElementById('st');
const lista = document.getElementById('lista');
async function rodar(t) {
  st.textContent = 'Executando ' + t.titulo + '...';
  try {
    const pasta = await fs.getPluginFolder();
    const arq = await pasta.getEntry(t.arquivo);
    const token = await fs.createSessionToken(arq);
    await core.executeAsModal(async () => {
      const res = await action.batchPlay([{ _obj: 'AdobeScriptAutomation Scripts', javaScript: { _path: token, _kind: 'local' }, javaScriptMessage: 'BatchPlay', _options: { dialogOptions: 'display' } }], { synchronousExecution: false });
      if (Array.isArray(res) && res[0] && (res[0]._obj === 'error' || res[0].message)) {
        throw new Error(res[0].message || 'Erro no Photoshop');
      }
    }, { commandName: t.titulo, interactive: true });
    st.textContent = 'Concluido: ' + t.titulo;
  } catch (e) { st.textContent = 'Erro: ' + (e.message || e); }
}`;

    const fullMain = mainJs + `\nfor (const t of TOOLS) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.innerHTML = '<div><div class="t"></div><div class="d"></div></div>';
  b.querySelector('.t').textContent = t.titulo;
  b.querySelector('.d').textContent = t.descricao;
  b.onclick = () => rodar(t);
  lista.appendChild(b);
}\n`;

    const entradas = [
      { nome: 'manifest.json', dados: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8') },
      { nome: 'src/index.html', dados: Buffer.from(html, 'utf8') },
      { nome: 'src/main.js', dados: Buffer.from(fullMain, 'utf8') },
      { nome: 'src/icons/icone-48.png', dados: gerarPngIcone(iconeId, 48, cor, fundo) },
      { nome: 'src/icons/icone-48@2x.png', dados: gerarPngIcone(iconeId, 96, cor, fundo) }
    ];
    for (let i = 0; i < selecionadas.length; i++) {
      entradas.push({
        nome: metaTools[i].arquivo,
        dados: Buffer.from(standaloneMap.get(selecionadas[i].id), 'utf8')
      });
    }

    const buf = criarZip(entradas);
    const destCcx = saida || path.join(dirDist, `custom-${slug}.ccx`);
    await writeFile(destCcx, buf);
    return { arquivo: destCcx, formato: ehInDesign ? 'indesign-uxp' : 'photoshop-uxp', bytes: buf.length, icone: iconeId };
  }

  /* 2. CorelDRAW Barra + Icone (.zip com .bas + .ico) ----------------- */
  if (formatoReal === 'coreldraw-barra' || formatoReal === 'coreldraw') {
    const icoName = `${slug}.ico`;
    const entradas = [
      { nome: `icones/${icoName}`, dados: gerarIcoIcone(iconeId, 32, cor, fundo) }
    ];
    const macros = [];
    for (const f of selecionadas) {
      const code = standaloneMap.get(f.id);
      const base = path.basename(f.arquivo);
      entradas.push({ nome: `scripts/${base}`, dados: Buffer.from(code, 'utf8') });
      const vbName = (code.match(/^Attribute\s+VB_Name\s*=\s*"([^"]+)"/m) || [])[1] || `IBD_${slug}`;
      const subName = (code.match(/^Public\s+Sub\s+([A-Za-z0-9_]+)\s*\(/m) || [])[1] || 'Executar';
      macros.push({ titulo: f.titulo, macro: `GlobalMacros.${vbName}.${subName}` });
    }

    const barMod = (`Attribute VB_Name = "IBD_${slug.replace(/[^a-z0-9]/gi, '').slice(0, 18)}"
Option Explicit
Public Sub InstalarBarraPersonalizada()
    Const BAR_NOME As String = "${nomeFinal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[—–]/g, '-')}"
    Const CUI_BAR_TOP As Long = 1
    Const CAT_MACROS As String = "2cc24a3e-fe24-4708-9a74-9c75406eebcd"
    Dim bar As CommandBar, btn As Object, pastaIcones As String, i As Long
    pastaIcones = InputBox("Pasta onde extraiu '${icoName}' (com \\ no final):", BAR_NOME, "C:\\IBD_Custom\\icones\\")
    If Trim$(pastaIcones) = "" Then Exit Sub
    If Right$(pastaIcones, 1) <> "\\" And Right$(pastaIcones, 1) <> "/" Then pastaIcones = pastaIcones & "\\"
    For i = FrameWork.CommandBars.Count To 1 Step -1
        If FrameWork.CommandBars(i).Name = BAR_NOME Then FrameWork.CommandBars(i).Delete
    Next i
    Set bar = FrameWork.CommandBars.Add(BAR_NOME, CUI_BAR_TOP, False)
${macros.map((m) => {
  const cap = m.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[—–]/g, '-');
  return `    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "${m.macro}")
    If Not btn Is Nothing Then
        btn.Caption = "${cap}"
        On Error Resume Next
        btn.SetIcon2 pastaIcones & "${icoName}"
        If Err.Number <> 0 Then btn.SetCustomIcon pastaIcones & "${icoName}"
        On Error GoTo 0
    End If`;
}).join('\n')}
    bar.Visible = True
End Sub
`).replace(/\r?\n/g, '\r\n');
    entradas.push({ nome: 'IBD_InstalarCustom.bas', dados: Buffer.from(barMod, 'utf8') });
    const buf = criarZip(entradas);
    const dest = saida || path.join(dirDist, `custom-coreldraw-${slug}.zip`);
    await writeFile(dest, buf);
    return { arquivo: dest, formato: 'coreldraw-barra', bytes: buf.length, icone: iconeId };
  }

  /* 3. After Effects Painel Encaixavel (.jsx standalone) ---------------- */
  if (formatoReal === 'aftereffects-painel' || formatoReal === 'aftereffects') {
    const f = selecionadas[0];
    const dest = saida || path.join(dirDist, `custom-ae-${slug}.jsx`);
    await writeFile(dest, standaloneMap.get(f.id), 'utf8');
    return { arquivo: dest, formato: 'aftereffects-painel', bytes: Buffer.byteLength(standaloneMap.get(f.id)), icone: iconeId };
  }

  /* 4. TraceDraw Plugin (.js) ------------------------------------------- */
  if (formatoReal === 'tracedraw') {
    const blocos = selecionadas.map((f) => `// === ${f.titulo} ===\n${standaloneMap.get(f.id)}`).join('\n\n');
    const dest = saida || path.join(dirDist, `custom-tracedraw-${slug}.js`);
    await writeFile(dest, blocos, 'utf8');
    return { arquivo: dest, formato: 'tracedraw', bytes: Buffer.byteLength(blocos), icone: iconeId };
  }

  /* 5. Adobe CEP Extension (.zip universal Ai/Ae/Id/Ps) ----------------- */
  const bundleId = `com.${marca.id}.custom.${slug.replace(/[^a-z0-9]/g, '') || 'cep'}`.slice(0, 48);
  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="8.0" ExtensionBundleId="${bundleId}" ExtensionBundleVersion="1.0.0" ExtensionBundleName="${escapeXml(nomeFinal)}">
  <ExtensionList><Extension Id="${bundleId}.panel" Version="1.0.0" /></ExtensionList>
  <ExecutionEnvironment>
    <HostList>
      <Host Name="ILST" Version="[22.0,99.9]" />
      <Host Name="AEFT" Version="[15.0,99.9]" />
      <Host Name="IDSN" Version="[14.0,99.9]" />
      <Host Name="PHXS" Version="[19.0,99.9]" />
      <Host Name="PHSP" Version="[19.0,99.9]" />
    </HostList>
    <LocaleList><Locale Code="All" /></LocaleList>
    <RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="8.0" /></RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList><Extension Id="${bundleId}.panel"><DispatchInfo>
    <Resources><MainPath>./index.html</MainPath><ScriptPath>./host/runner.jsx</ScriptPath></Resources>
    <Lifecycle><AutoVisible>true</AutoVisible></Lifecycle>
    <UI><Type>Panel</Type><Menu>${escapeXml(nomeFinal)}</Menu><Geometry><Size><Height>320</Height><Width>260</Width></Size></Geometry></UI>
  </DispatchInfo></Extension></DispatchInfoList>
</ExtensionManifest>\n`;

  const ferramentasCep = selecionadas.map((f, idx) => ({
    id: f.id,
    titulo: f.titulo,
    descricao: f.descricao,
    arquivo: `scripts/${idx}-${path.basename(f.arquivo)}`
  }));

  const htmlCep = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeXml(nomeFinal)}</title>
<style>body{margin:0;padding:10px;background:${fundo};color:#e4e7ee;font-family:"Segoe UI",sans-serif;font-size:12px}
.hdr{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid #3a404d}
.ico{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#181a1f;border:1px solid ${cor}}
h1{margin:0;font-size:13px}.btn{display:block;width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid #3a404d;background:#20232a;color:#e4e7ee;text-align:left;cursor:pointer}
.btn:hover{border-color:${cor}}#st{margin-top:10px;font-size:10px;color:#b6bcc8}</style></head>
<body><div class="hdr"><span class="ico">${iconeSvg(iconeId, cor, 26)}</span><h1>${escapeXml(nomeFinal)}</h1></div>
<div id="lista"></div><div id="st">Pronto.</div>
<script src="js/CSInterface.js"></script><script>
var cs = new CSInterface();
var TOOLS = ${JSON.stringify(ferramentasCep)};
var lista = document.getElementById('lista'), st = document.getElementById('st');
TOOLS.forEach(function(t){
  var b = document.createElement('button'); b.className = 'btn'; b.textContent = t.titulo;
  b.onclick = function(){
    var base = (cs.getSystemPath(SystemPath.EXTENSION) || '').replace(/\\\\/g,'/').replace(/\\/+$/,'');
    var p = base ? (base + '/' + t.arquivo) : t.arquivo;
    st.textContent = 'Executando ' + t.titulo + '...';
    cs.evalScript('ibdExecutarArquivo(' + JSON.stringify(p) + ')', function(r){ var s = r ? String(r) : ''; st.textContent = (!s || s === 'EvalScript error.' || s.indexOf('ERRO:')===0) ? (s || 'Erro de execucao') : 'Concluido: ' + t.titulo; });
  };
  lista.appendChild(b);
});
</script></body></html>`;

  const csInt = await readFile(path.join(raiz, 'plugins', 'adobe-cep', 'js', 'CSInterface.js'), 'utf8');
  const runner = await readFile(path.join(raiz, 'plugins', 'adobe-cep', 'host', 'runner.jsx'), 'utf8');
  const macCmd = (await readFile(path.join(raiz, 'plugins', 'adobe-cep', 'Instalar-macOS.command'), 'utf8')).replace(/com\.ibd\.cep\.ferramentas/g, bundleId);
  const winBat = (await readFile(path.join(raiz, 'plugins', 'adobe-cep', 'Instalar-Windows.bat'), 'utf8')).replace(/com\.ibd\.cep\.ferramentas/g, bundleId);

  const entradasCep = [
    { nome: 'CSXS/manifest.xml', dados: Buffer.from(manifestXml, 'utf8') },
    { nome: 'index.html', dados: Buffer.from(htmlCep, 'utf8') },
    { nome: 'js/CSInterface.js', dados: Buffer.from(csInt, 'utf8') },
    { nome: 'host/runner.jsx', dados: Buffer.from(runner, 'utf8') },
    { nome: 'Instalar-macOS.command', dados: Buffer.from(macCmd, 'utf8') },
    { nome: 'Instalar-Windows.bat', dados: Buffer.from(winBat, 'utf8') }
  ];
  for (let i = 0; i < selecionadas.length; i++) {
    entradasCep.push({
      nome: ferramentasCep[i].arquivo,
      dados: Buffer.from(standaloneMap.get(selecionadas[i].id), 'utf8')
    });
  }

  const bufCep = criarZip(entradasCep);
  const destCep = saida || path.join(dirDist, `custom-cep-${slug}.zip`);
  await writeFile(destCep, bufCep);
  return { arquivo: destCep, formato: 'adobe-cep', bytes: bufCep.length, icone: iconeId };
}

/* CLI entry point ---------------------------------------------------- */
const ehPrincipal = path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url));
if (ehPrincipal) {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      opts[args[i].slice(2)] = args[++i];
    }
  }
  const res = await criarPluginCustom({
    tools: opts.tools || '',
    nome: opts.nome,
    icone: opts.icone,
    cor: opts.cor || PALETA_ICONES[0].hex,
    fundo: opts.fundo || PALETA_ICONES[0].fundo,
    formato: opts.formato || 'auto',
    saida: opts.out
  });
  console.log(`Plugin gerado: ${path.relative(RAIZ, res.arquivo)} (${res.formato}, icone ${res.icone}, ${(res.bytes / 1024).toFixed(1)} KB)`);
}
