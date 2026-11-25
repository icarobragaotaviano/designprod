#!/usr/bin/env node
/**
 * Empacota os plugins instalaveis nos softwares:
 *  - photoshop-uxp    -> dist/<marca>-ferramentas-<versao>.{ccx,zip}
 *  - indesign-uxp     -> dist/<marca>-indesign-uxp-<versao>.{ccx,zip}
 *  - adobe-cep        -> dist/<marca>-adobe-cep-<versao>.zip
 *  - aftereffects-dock-> dist/<marca>-aftereffects-painel-<versao>.zip
 *  - coreldraw-toolbar-> dist/<marca>-coreldraw-barra-<versao>.zip
 *
 * Uso:
 *   npm run build:plugin            (gera photoshop-uxp)
 *   npm run build:plugins           (gera todos os plugins)
 *   node tools/build-plugin.mjs <alvo>
 */
import { readFile, writeFile, readdir, cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarZip } from './lib/zip.mjs';
import { gerarPngIcone, gerarIcoIcone, gerarCodigoIconesJs, resolverIconeId } from './lib/icones.mjs';
import { resolverIncludes, montarArquivoPublicavel } from './lib/incluir.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marca = JSON.parse(await readFile(path.join(RAIZ, 'brand.config.json'), 'utf8'));
const catalogo = JSON.parse(await readFile(path.join(RAIZ, 'catalog.json'), 'utf8'));
const DIST = path.join(RAIZ, 'dist');
await mkdir(DIST, { recursive: true });

const mapaTokens = {
  fundo: 'fundo',
  superficie: 'superficie',
  texto: 'texto',
  textoSecundario: 'texto-secundario',
  acento: 'acento',
  acentoTexto: 'acento-texto',
  borda: 'borda',
  erro: 'erro',
  sucesso: 'sucesso'
};

async function aplicarTokensCss(cssPath) {
  let css = await readFile(cssPath, 'utf8');
  for (const [chave, token] of Object.entries(mapaTokens)) {
    const valor = marca.cores[chave];
    if (!valor) continue;
    css = css.replace(new RegExp(`(--${token}:\\s*)[^;]+;`), () => `--${token}: ${valor};`);
  }
  await writeFile(cssPath, css, 'utf8');
}

async function varrer(dir, base = dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const saida = [];
  for (const entrada of entradas) {
    if (entrada.name.startsWith('.')) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await varrer(completo, base)));
    } else if (entrada.isFile()) {
      saida.push(path.relative(base, completo).split(path.sep).join('/'));
    }
  }
  return saida.sort();
}

async function gerarStandaloneAdobe(destinoRaiz, appsAlvo) {
  await rm(destinoRaiz, { recursive: true, force: true });
  await mkdir(destinoRaiz, { recursive: true });
  for (const f of catalogo.ferramentas || []) {
    if (f.tipo !== 'script' || !appsAlvo.includes(f.app)) continue;
    const { conteudo, embutidos } = await resolverIncludes(RAIZ, f.arquivo);
    const pronto = montarArquivoPublicavel(f, marca, conteudo, embutidos);
    const relOut = f.arquivo.replace(/^apps\//, '');
    const alvo = path.join(destinoRaiz, relOut);
    await mkdir(path.dirname(alvo), { recursive: true });
    await writeFile(alvo, pronto, 'utf8');
  }
}

async function ziparDiretorio(dir) {
  const caminhos = await varrer(dir);
  const entradas = [];
  for (const relativo of caminhos) {
    entradas.push({ nome: relativo, dados: await readFile(path.join(dir, relativo)) });
  }
  return { caminhos, pacote: criarZip(entradas) };
}

async function empacotarUxp(pluginDir, prefixoSaida, iconeId, incluirFullBundle) {
  const DIR = path.join(RAIZ, 'plugins', pluginDir);
  const SRC = path.join(DIR, 'src');

  await aplicarTokensCss(path.join(SRC, 'styles.css'));

  const iconsDir = path.join(SRC, 'icons');
  await mkdir(iconsDir, { recursive: true });
  await writeFile(path.join(iconsDir, 'icone-48.png'), gerarPngIcone(iconeId, 48, marca.cores.acento, marca.cores.fundo));
  await writeFile(path.join(iconsDir, 'icone-48@2x.png'), gerarPngIcone(iconeId, 96, marca.cores.acento, marca.cores.fundo));

  await mkdir(path.join(SRC, 'lib'), { recursive: true });
  await writeFile(path.join(SRC, 'lib', 'icones.js'), gerarCodigoIconesJs(), 'utf8');

  const manifestPath = path.join(DIR, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.name = pluginDir === 'photoshop-uxp'
    ? `${marca.nome} Ferramentas`
    : `${marca.nome} Ferramentas (InDesign)`;
  manifest.version = marca.versao;
  manifest.entrypoints[0].label.default = `${marca.nome} Ferramentas`;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  await cp(path.join(RAIZ, 'catalog.json'), path.join(SRC, 'catalog.json'));

  const bundle = path.join(SRC, 'bundle');
  await rm(bundle, { recursive: true, force: true });
  await mkdir(bundle, { recursive: true });
  if (incluirFullBundle) {
    await cp(path.join(RAIZ, 'core'), path.join(bundle, 'core'), { recursive: true });
    await cp(path.join(RAIZ, 'apps'), path.join(bundle, 'apps'), { recursive: true });
  } else {
    await gerarStandaloneAdobe(path.join(bundle, 'standalone'), ['indesign']);
  }

  const { caminhos, pacote } = await ziparDiretorio(DIR);
  if (!caminhos.includes('manifest.json')) {
    throw new Error(`${pluginDir}: manifest.json precisa estar na raiz.`);
  }

  const base = `${marca.id}-${prefixoSaida}-${marca.versao}`;
  await writeFile(path.join(DIST, `${base}.ccx`), pacote);
  await writeFile(path.join(DIST, `${base}.zip`), pacote);
  console.log(`Plugin ${pluginDir} pronto: dist/${base}.ccx e dist/${base}.zip — ${caminhos.length} arquivos, ${(pacote.length / 1024).toFixed(0)} KB.`);
}

async function buildPhotoshopUxp() {
  await empacotarUxp('photoshop-uxp', 'ferramentas', 'organizacao', true);
}

async function buildInDesignUxp() {
  await empacotarUxp('indesign-uxp', 'indesign-uxp', 'pdf', false);
}

async function buildAdobeCep() {
  const DIR = path.join(RAIZ, 'plugins', 'adobe-cep');
  await aplicarTokensCss(path.join(DIR, 'styles.css'));
  await mkdir(path.join(DIR, 'js'), { recursive: true });
  await writeFile(path.join(DIR, 'js', 'icones.js'), gerarCodigoIconesJs(), 'utf8');
  await cp(path.join(RAIZ, 'catalog.json'), path.join(DIR, 'catalog.json'));
  await writeFile(
    path.join(DIR, 'catalog.js'),
    `window.IBDCatalogo = ${JSON.stringify(catalogo)};\n`,
    'utf8'
  );

  const manifestXmlPath = path.join(DIR, 'CSXS', 'manifest.xml');
  let xml = await readFile(manifestXmlPath, 'utf8');
  xml = xml
    .replace(/ExtensionBundleVersion="[^"]+"/, `ExtensionBundleVersion="${marca.versao}"`)
    .replace(/ExtensionBundleName="[^"]+"/, `ExtensionBundleName="${marca.nome} Ferramentas"`)
    .replace(/(<Extension[^>]+Version=")[^"]+(")/, `$1${marca.versao}$2`)
    .replace(/<Menu>[^<]+<\/Menu>/, `<Menu>${marca.nome} Ferramentas</Menu>`);
  await writeFile(manifestXmlPath, xml, 'utf8');

  await gerarStandaloneAdobe(path.join(DIR, 'bundle', 'standalone'), [
    'illustrator',
    'aftereffects',
    'indesign',
    'photoshop'
  ]);

  const { caminhos, pacote } = await ziparDiretorio(DIR);
  const base = `${marca.id}-adobe-cep-${marca.versao}`;
  await writeFile(path.join(DIST, `${base}.zip`), pacote);
  console.log(`Plugin adobe-cep pronto: dist/${base}.zip — ${caminhos.length} arquivos, ${(pacote.length / 1024).toFixed(0)} KB.`);
}

async function buildAfterEffectsDock() {
  const DIR = path.join(RAIZ, 'plugins', 'aftereffects-dock');
  await mkdir(DIR, { recursive: true });

  const stripDirectivas = (src) => src
    .replace(/^[ \t]*#target\b[^\r\n]*\r?\n?/gm, '')
    .replace(/^[ \t]*#include[ \t]+"[^"]+"[^\r\n]*\r?\n?/gm, '')
    .trim();

  const cores = ['ibd-core.jsx', 'ibd-prefs.jsx', 'ibd-ui.jsx'];
  const blocosCore = [];
  for (const nome of cores) {
    const raw = await readFile(path.join(RAIZ, 'core', 'extendscript', nome), 'utf8');
    blocosCore.push(`/* ----- ${nome} ----- */\n${stripDirectivas(raw)}`);
  }

  const toolsAe = (catalogo.ferramentas || []).filter((f) => f.app === 'aftereffects' && f.tipo === 'script');
  const entradas = [];
  for (const f of toolsAe) {
    const raw = await readFile(path.join(RAIZ, f.arquivo), 'utf8');
    const corpo = stripDirectivas(raw);
    entradas.push(
      `    {\n` +
      `      id: ${JSON.stringify(f.id)},\n` +
      `      titulo: ${JSON.stringify(f.titulo)},\n` +
      `      descricao: ${JSON.stringify(f.descricao)},\n` +
      `      icone: ${JSON.stringify(f.icone || resolverIconeId(f.id, f.tipo))},\n` +
      `      executar: function () {\n${corpo}\n      }\n` +
      `    }`
    );
  }

  const painelJsx = `/**
 * ${marca.nome} Ferramentas — Painel encaixavel para After Effects (ScriptUI Panel).
 * Copie este arquivo para a pasta "Scripts/ScriptUI Panels/" do After Effects
 * e abra em Janela (Window) > IBD Ferramentas Painel.jsx.
 *
 * Gerado automaticamente por tools/build-plugin.mjs — v${marca.versao}
 */
#target aftereffects

(function (thisObj) {
${blocosCore.join('\n\n')}

  var FERRAMENTAS = [
${entradas.join(',\n')}
  ];

  var win = (thisObj instanceof Panel)
    ? thisObj
    : new Window('palette', '${marca.nome} Ferramentas', undefined, { resizeable: true });
  win.orientation = 'column';
  win.alignChildren = ['fill', 'top'];
  win.spacing = 8;
  win.margins = 10;

  var cab = win.add('panel', undefined, '');
  cab.orientation = 'row';
  cab.alignChildren = ['left', 'center'];
  cab.alignment = 'fill';
  cab.margins = 8;
  try {
    var gCab = cab.graphics;
    gCab.backgroundColor = gCab.newBrush(gCab.BrushType.SOLID_COLOR, [0.094, 0.102, 0.122, 1]);
  } catch (e) {}
  var selo = cab.add('statictext', undefined, '${marca.nome}');
  try {
    var gSelo = selo.graphics;
    gSelo.backgroundColor = gSelo.newBrush(gSelo.BrushType.SOLID_COLOR, [0.941, 0.769, 0.098, 1]);
    gSelo.foregroundColor = gSelo.newPen(gSelo.PenType.SOLID_COLOR, [0.086, 0.094, 0.114, 1], 1);
  } catch (e) {}
  cab.add('statictext', undefined, 'After Effects · v${marca.versao}');

  var grpBusca = win.add('group');
  grpBusca.orientation = 'row';
  grpBusca.alignChildren = ['fill', 'center'];
  grpBusca.add('statictext', undefined, 'Filtrar:');
  var inpBusca = grpBusca.add('edittext', undefined, '');
  inpBusca.alignment = ['fill', 'center'];

  var listaGrupo = win.add('panel', undefined, 'Ferramentas instaladas');
  listaGrupo.orientation = 'column';
  listaGrupo.alignChildren = ['fill', 'top'];
  listaGrupo.alignment = ['fill', 'fill'];
  listaGrupo.spacing = 6;
  listaGrupo.margins = 8;

  var lblStatus = win.add('statictext', undefined, 'Pronto. Clique em Executar.');

  function desenharMiniIcone(canvas, iconeId) {
    canvas.onDraw = function () {
      var g = this.graphics;
      var c = IBD.ui.desenho;
      c.fundo(g, 24, 24, c.cor(24, 26, 31), c.cor(58, 64, 77));
      if (iconeId === 'organizacao') {
        c.retangulo(g, 4, 6, 16, 12, null, c.cor(104, 168, 232), 1.5);
        c.linha(g, 4, 10, 20, 10, c.cor(104, 168, 232), 1.5);
      } else {
        c.retangulo(g, 5, 5, 14, 14, null, c.cor(240, 196, 25), 1.5);
        c.linha(g, 8, 12, 16, 12, c.cor(240, 196, 25), 1.5);
      }
    };
  }

  function preencher(filtro) {
    while (listaGrupo.children.length > 0) {
      listaGrupo.remove(listaGrupo.children[0]);
    }
    var q = String(filtro || '').toLowerCase().replace(/^\\s+|\\s+$/g, '');
    for (var i = 0; i < FERRAMENTAS.length; i++) {
      var item = FERRAMENTAS[i];
      if (q && item.titulo.toLowerCase().indexOf(q) === -1 && item.descricao.toLowerCase().indexOf(q) === -1) {
        continue;
      }
      var row = listaGrupo.add('panel', undefined, '');
      row.orientation = 'row';
      row.alignChildren = ['left', 'center'];
      row.alignment = 'fill';
      row.margins = 8;
      row.spacing = 8;

      var iconeCanvas = row.add('group');
      iconeCanvas.preferredSize.width = 24;
      iconeCanvas.preferredSize.height = 24;
      desenharMiniIcone(iconeCanvas, item.icone);

      var colTxt = row.add('group');
      colTxt.orientation = 'column';
      colTxt.alignChildren = ['left', 'top'];
      colTxt.alignment = ['fill', 'center'];
      colTxt.spacing = 2;
      colTxt.add('statictext', undefined, item.titulo);
      var sub = colTxt.add('statictext', undefined, item.descricao, { multiline: true });
      sub.preferredSize.width = 180;

      var btn = row.add('button', undefined, 'Executar');
      (function (alvo) {
        btn.onClick = function () {
          lblStatus.text = 'Executando: ' + alvo.titulo + '...';
          try {
            alvo.executar();
            lblStatus.text = 'Concluido: ' + alvo.titulo;
          } catch (err) {
            lblStatus.text = 'Erro: ' + (err && err.message ? err.message : err);
          }
        };
      })(item);
    }
    win.layout.layout(true);
  }

  inpBusca.onChanging = function () {
    preencher(inpBusca.text);
  };

  win.onResizing = win.onResize = function () {
    this.layout.resize();
  };

  preencher('');

  if (win instanceof Window) {
    win.center();
    win.show();
  } else {
    win.layout.layout(true);
  }
})(this);
`;

  await writeFile(path.join(DIR, 'IBD Ferramentas Painel.jsx'), painelJsx, 'utf8');
  await writeFile(
    path.join(DIR, 'Instalar-LeiaMe.txt'),
    [
      `${marca.nome} Ferramentas — Painel Encaixavel do After Effects (v${marca.versao})`,
      '',
      'Como instalar:',
      '1. Copie o arquivo "IBD Ferramentas Painel.jsx" para a pasta ScriptUI Panels:',
      '   - macOS: /Applications/Adobe After Effects [Versao]/Scripts/ScriptUI Panels/',
      '   - Windows: C:\\Program Files\\Adobe\\Adobe After Effects [Versao]\\Support Files\\Scripts\\ScriptUI Panels\\',
      '2. Reinicie o After Effects.',
      '3. Abra em Janela (Window) > IBD Ferramentas Painel.jsx e encaixe onde preferir.'
    ].join('\n') + '\n',
    'utf8'
  );

  const { caminhos, pacote } = await ziparDiretorio(DIR);
  const base = `${marca.id}-aftereffects-painel-${marca.versao}`;
  await writeFile(path.join(DIST, `${base}.zip`), pacote);
  console.log(`Plugin aftereffects-dock pronto: dist/${base}.zip — ${caminhos.length} arquivos, ${(pacote.length / 1024).toFixed(0)} KB.`);
}

async function buildCorelDrawToolbar() {
  const DIR = path.join(RAIZ, 'plugins', 'coreldraw-toolbar');
  await rm(DIR, { recursive: true, force: true });
  await mkdir(path.join(DIR, 'scripts'), { recursive: true });
  await mkdir(path.join(DIR, 'icones'), { recursive: true });

  const toolsCorel = (catalogo.ferramentas || []).filter((f) => f.app === 'coreldraw' && f.tipo === 'script');
  const macros = [];

  for (const f of toolsCorel) {
    const raw = await readFile(path.join(RAIZ, f.arquivo), 'utf8');
    const pronto = montarArquivoPublicavel(f, marca, raw, []);
    const baseBas = path.basename(f.arquivo);
    await writeFile(path.join(DIR, 'scripts', baseBas), pronto, 'utf8');

    const slug = f.id.split('/').pop();
    const icoName = `${slug}.ico`;
    const iconeId = f.icone || resolverIconeId(f.id, f.tipo);
    await writeFile(
      path.join(DIR, 'icones', icoName),
      gerarIcoIcone(iconeId, 32, marca.cores.acento, marca.cores.fundo)
    );

    const vbName = (raw.match(/^Attribute\s+VB_Name\s*=\s*"([^"]+)"/m) || [])[1] || `IBD_${slug}`;
    const subName = (raw.match(/^Public\s+Sub\s+([A-Za-z0-9_]+)\s*\(/m) || [])[1] || 'Executar';
    macros.push({
      titulo: f.titulo,
      macro: `GlobalMacros.${vbName}.${subName}`,
      ico: icoName
    });
  }

  const linhasAdd = macros.map((m) => `
    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(cdrCmdCategoryMacros, "${m.macro}")
    If Not btn Is Nothing Then
        btn.Caption = "${m.titulo}"
        btn.TooltipText = "${marca.nome}: ${m.titulo}"
        Err.Clear
        btn.SetIcon2 pastaIcones & "${m.ico}"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "${m.ico}"
        End If
    End If
    On Error GoTo ErrHandler`).join('\n');

  const basInstalador = `Attribute VB_Name = "IBD_BarraFerramentas"
' ${marca.nome} — Instalador da Barra de Ferramentas com Icones (.ico)
' Importe os .bas de scripts/ e este modulo em GlobalMacros (Alt + F11),
' depois execute InstalarBarraIBD().

Option Explicit

Public Sub InstalarBarraIBD()
    Const BAR_NOME As String = "${marca.nome} Ferramentas"
    Dim bar As CommandBar
    Dim btn As CommandBarControl
    Dim pastaIcones As String
    Dim i As Long

    pastaIcones = InputBox( _
        "Informe o caminho completo da pasta 'icones' extraida do ZIP (terminando com \\):", _
        "${marca.nome} — Instalar Barra de Ferramentas", _
        "C:\\${marca.nome}_Ferramentas\\icones\\")
    If Trim$(pastaIcones) = "" Then Exit Sub
    If Right$(pastaIcones, 1) <> "\\" And Right$(pastaIcones, 1) <> "/" Then
        pastaIcones = pastaIcones & "\\"
    End If

    On Error GoTo ErrHandler
    For i = FrameWork.CommandBars.Count To 1 Step -1
        If FrameWork.CommandBars(i).Name = BAR_NOME Then
            FrameWork.CommandBars(i).Delete
        End If
    Next i

    Set bar = FrameWork.CommandBars.Add(BAR_NOME, cdrBarTop, False)
${linhasAdd}

    bar.Visible = True
    MsgBox "Barra '" & BAR_NOME & "' criada com " & bar.Controls.Count & " icone(s)!", vbInformation, "${marca.nome} Ferramentas"
    Exit Sub

ErrHandler:
    MsgBox "Erro ao montar barra no CorelDRAW: " & Err.Description, vbCritical, "${marca.nome} Ferramentas"
End Sub
`;

  await writeFile(path.join(DIR, 'IBD_InstalarBarraFerramentas.bas'), basInstalador, 'utf8');
  await writeFile(
    path.join(DIR, 'Instalar-LeiaMe.txt'),
    [
      `${marca.nome} Ferramentas — Barra de Ferramentas com Icones para CorelDRAW (v${marca.versao})`,
      '',
      'Como instalar e criar os botoes com icone:',
      '1. Extraia este ZIP em uma pasta fixa (ex: C:\\IBD_Ferramentas\\).',
      '2. No CorelDRAW, abra o editor VBA (Alt + F11).',
      '3. Clique com o botao direito em GlobalMacros > Importar Arquivo... e importe:',
      '   - Todos os arquivos .bas da pasta scripts\\',
      '   - O arquivo IBD_InstalarBarraFerramentas.bas',
      '4. Execute a macro GlobalMacros.IBD_BarraFerramentas.InstalarBarraIBD (F5).',
      '5. Quando solicitado, informe o caminho da pasta "icones\\" (ex: C:\\IBD_Ferramentas\\icones\\).',
      '6. A barra "IBD Ferramentas" aparecera no topo do CorelDRAW com todos os iconezinhos!'
    ].join('\n') + '\n',
    'utf8'
  );

  const { caminhos, pacote } = await ziparDiretorio(DIR);
  const base = `${marca.id}-coreldraw-barra-${marca.versao}`;
  await writeFile(path.join(DIST, `${base}.zip`), pacote);
  console.log(`Plugin coreldraw-toolbar pronto: dist/${base}.zip — ${caminhos.length} arquivos, ${(pacote.length / 1024).toFixed(0)} KB.`);
}

const builders = {
  'photoshop-uxp': buildPhotoshopUxp,
  'indesign-uxp': buildInDesignUxp,
  'adobe-cep': buildAdobeCep,
  'aftereffects-dock': buildAfterEffectsDock,
  'coreldraw-toolbar': buildCorelDrawToolbar
};

const arg = process.argv[2] || 'photoshop-uxp';
if (arg === '--all') {
  for (const fn of Object.values(builders)) {
    await fn();
  }
} else if (builders[arg]) {
  await builders[arg]();
} else {
  console.error(`Alvo desconhecido: "${arg}". Use: ${Object.keys(builders).join(', ')} ou --all`);
  process.exit(1);
}
