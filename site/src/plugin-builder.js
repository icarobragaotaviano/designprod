/**
 * Construtor 100% em navegador de plugins com icone personalizado ("iconezinho").
 * Monta arquivos .ccx (Photoshop/InDesign UXP), .zip (Adobe CEP / CorelDRAW + .ico),
 * .jsx (After Effects ScriptUI Panel) ou .js (TraceDraw) usando as definicoes de
 * window.IBDIcones sem depender de servidor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.IBDPluginBuilder = factory(root);
  }
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var TABELA_CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  }());

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function adler32(bytes) {
    var a = 1;
    var b = 0;
    for (var i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function strBytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(str));
    var s = unescape(encodeURIComponent(String(str)));
    var arr = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
  }

  function concat(parts) {
    var total = 0;
    for (var i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total);
    var off = 0;
    for (var j = 0; j < parts.length; j++) {
      out.set(parts[j], off);
      off += parts[j].length;
    }
    return out;
  }

  function u32le(v) {
    return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
  }
  function u16le(v) {
    return new Uint8Array([v & 255, (v >>> 8) & 255]);
  }
  function u32be(v) {
    return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  }

  function parseHex(hex) {
    var clean = String(hex || '#f0c419').replace(/^#/, '');
    if (clean.length === 3) clean = clean.replace(/(.)/g, '$1$1');
    var n = parseInt(clean, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  function rasterizarRgba(defIcone, tamanho, corHex, fundoHex) {
    var def = defIcone || { paths: [{ tipo: 'rect', x: 5, y: 5, w: 14, h: 14, rx: 2, stroke: true }] };
    var fg = parseHex(corHex || def.cor || '#f0c419');
    var bg = parseHex(fundoHex || '#1e222a');
    var borda = parseHex('#3a404d');
    var buf = new Uint8Array(tamanho * tamanho * 4);
    var s = tamanho / 24;

    function blend(px, py, rgba, alpha) {
      if (px < 0 || py < 0 || px >= tamanho || py >= tamanho || alpha <= 0) return;
      var i = (py * tamanho + px) * 4;
      var a = Math.min(1, alpha * (rgba[3] / 255));
      var inv = 1 - a;
      buf[i] = Math.round(rgba[0] * a + buf[i] * inv);
      buf[i + 1] = Math.round(rgba[1] * a + buf[i + 1] * inv);
      buf[i + 2] = Math.round(rgba[2] * a + buf[i + 2] * inv);
      buf[i + 3] = Math.min(255, Math.round(255 * (a + (buf[i + 3] / 255) * inv)));
    }

    var pad = Math.max(1, Math.round(tamanho * 0.06));
    var r = Math.max(3, Math.round(tamanho * 0.2));
    for (var y = pad; y < tamanho - pad; y++) {
      for (var x = pad; x < tamanho - pad; x++) {
        var dx = Math.max(pad + r - x, 0, x - (tamanho - 1 - pad - r));
        var dy = Math.max(pad + r - y, 0, y - (tamanho - 1 - pad - r));
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r) {
          var ehBorda = x === pad || x === tamanho - 1 - pad || y === pad || y === tamanho - 1 - pad || d >= r - 1.2;
          blend(x, y, ehBorda ? borda : bg, 1);
        }
      }
    }

    function strokeLine(x1, y1, x2, y2, w) {
      var distTot = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      var steps = Math.max(2, Math.ceil(distTot * s * 3));
      var rad = Math.max(0.7, (w * s) / 2);
      for (var k = 0; k <= steps; k++) {
        var cx = (x1 + ((x2 - x1) * k) / steps) * s;
        var cy = (y1 + ((y2 - y1) * k) / steps) * s;
        var minX = Math.floor(cx - rad - 1), maxX = Math.ceil(cx + rad + 1);
        var minY = Math.floor(cy - rad - 1), maxY = Math.ceil(cy + rad + 1);
        for (var py = minY; py <= maxY; py++) {
          for (var px = minX; px <= maxX; px++) {
            var ddx = px + 0.5 - cx, ddy = py + 0.5 - cy;
            var dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist <= rad) blend(px, py, fg, 1);
            else if (dist <= rad + 0.7) blend(px, py, fg, 1 - (dist - rad) / 0.7);
          }
        }
      }
    }

    var paths = def.paths || [];
    for (var idx = 0; idx < paths.length; idx++) {
      var p = paths[idx];
      if (p.tipo === 'rect') {
        if (p.fill) {
          var x0 = Math.round(p.x * s), y0 = Math.round(p.y * s);
          var x1 = Math.round((p.x + p.w) * s), y1 = Math.round((p.y + p.h) * s);
          for (var py = y0; py <= y1; py++) {
            for (var px = x0; px <= x1; px++) blend(px, py, fg, 1);
          }
        } else {
          strokeLine(p.x, p.y, p.x + p.w, p.y, 1.8);
          strokeLine(p.x + p.w, p.y, p.x + p.w, p.y + p.h, 1.8);
          strokeLine(p.x + p.w, p.y + p.h, p.x, p.y + p.h, 1.8);
          strokeLine(p.x, p.y + p.h, p.x, p.y, 1.8);
        }
      } else if (p.tipo === 'line') {
        strokeLine(p.x1, p.y1, p.x2, p.y2, 1.8);
      } else if (p.tipo === 'circle') {
        var segs = 24;
        for (var c = 0; c < segs; c++) {
          var a1 = (c * 2 * Math.PI) / segs;
          var a2 = ((c + 1) * 2 * Math.PI) / segs;
          strokeLine(
            p.cx + Math.cos(a1) * p.r, p.cy + Math.sin(a1) * p.r,
            p.cx + Math.cos(a2) * p.r, p.cy + Math.sin(a2) * p.r,
            p.fill ? p.r * 1.4 : 1.8
          );
        }
      }
    }
    return buf;
  }

  function pngChunk(tag, dados) {
    var tagBytes = strBytes(tag);
    var crcVal = crc32(concat([tagBytes, dados]));
    return concat([u32be(dados.length), tagBytes, dados, u32be(crcVal)]);
  }

  /** Gera PNG RGBA valido em JS puro (blocos zlib nao comprimidos). */
  function pngBytes(defIcone, tamanho, corHex, fundoHex) {
    var rgba = rasterizarRgba(defIcone, tamanho, corHex, fundoHex);
    var stride = tamanho * 4 + 1;
    var raw = new Uint8Array(stride * tamanho);
    for (var y = 0; y < tamanho; y++) {
      raw[y * stride] = 0;
      raw.set(rgba.subarray(y * tamanho * 4, (y + 1) * tamanho * 4), y * stride + 1);
    }

    var blocks = [new Uint8Array([0x78, 0x01])];
    var offset = 0;
    while (offset < raw.length) {
      var len = Math.min(65535, raw.length - offset);
      var isLast = (offset + len >= raw.length) ? 1 : 0;
      var nlen = (~len) & 0xFFFF;
      blocks.push(new Uint8Array([isLast, len & 255, (len >>> 8) & 255, nlen & 255, (nlen >>> 8) & 255]));
      blocks.push(raw.subarray(offset, offset + len));
      offset += len;
    }
    blocks.push(u32be(adler32(raw)));

    var ihdr = concat([u32be(tamanho), u32be(tamanho), new Uint8Array([8, 6, 0, 0, 0])]);
    return concat([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', concat(blocks)),
      pngChunk('IEND', new Uint8Array(0))
    ]);
  }

  /** Gera arquivo .ico BMP 32-bit BGRA compativel com CorelDRAW. */
  function icoBytes(defIcone, tamanho, corHex, fundoHex) {
    var rgba = rasterizarRgba(defIcone, tamanho, corHex, fundoHex);
    var xorSize = tamanho * tamanho * 4;
    var andRow = Math.ceil(tamanho / 32) * 4;
    var andSize = andRow * tamanho;

    var bih = new Uint8Array(40);
    var dv = new DataView(bih.buffer);
    dv.setUint32(0, 40, true);
    dv.setInt32(4, tamanho, true);
    dv.setInt32(8, tamanho * 2, true);
    dv.setUint16(12, 1, true);
    dv.setUint16(14, 32, true);
    dv.setUint32(16, 0, true);
    dv.setUint32(20, xorSize + andSize, true);

    var xor = new Uint8Array(xorSize);
    var andMask = new Uint8Array(andSize);
    for (var y = 0; y < tamanho; y++) {
      var srcY = tamanho - 1 - y;
      for (var x = 0; x < tamanho; x++) {
        var si = (srcY * tamanho + x) * 4;
        var di = (y * tamanho + x) * 4;
        xor[di] = rgba[si + 2];
        xor[di + 1] = rgba[si + 1];
        xor[di + 2] = rgba[si];
        xor[di + 3] = rgba[si + 3];
        if (rgba[si + 3] < 128) {
          andMask[y * andRow + (x >> 3)] |= (0x80 >> (x & 7));
        }
      }
    }

    var img = concat([bih, xor, andMask]);
    var hdr = new Uint8Array(22);
    var hdv = new DataView(hdr.buffer);
    hdv.setUint16(0, 0, true);
    hdv.setUint16(2, 1, true);
    hdv.setUint16(4, 1, true);
    hdr[6] = tamanho >= 256 ? 0 : tamanho;
    hdr[7] = tamanho >= 256 ? 0 : tamanho;
    hdv.setUint16(10, 1, true);
    hdv.setUint16(12, 32, true);
    hdv.setUint32(14, img.length, true);
    hdv.setUint32(18, 22, true);
    return concat([hdr, img]);
  }

  /** Escritor de ZIP puro em memoria (metodo armazenado, CRC-32 IEEE). */
  function zipBytes(entradas) {
    var hora = 0;
    var data = ((2020 - 1980) << 9) | (1 << 5) | 1;
    var sorted = entradas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'en'); });
    var locais = [];
    var centrais = [];
    var offset = 0;

    for (var i = 0; i < sorted.length; i++) {
      var ent = sorted[i];
      var nomeB = strBytes(ent.nome);
      var dados = ent.dados instanceof Uint8Array ? ent.dados : strBytes(ent.dados);
      var soma = crc32(dados);

      var loc = new Uint8Array(30);
      var ldv = new DataView(loc.buffer);
      ldv.setUint32(0, 0x04034b50, true);
      ldv.setUint16(4, 20, true);
      ldv.setUint16(6, 0x0800, true);
      ldv.setUint16(8, 0, true);
      ldv.setUint16(10, hora, true);
      ldv.setUint16(12, data, true);
      ldv.setUint32(14, soma, true);
      ldv.setUint32(18, dados.length, true);
      ldv.setUint32(22, dados.length, true);
      ldv.setUint16(26, nomeB.length, true);
      ldv.setUint16(28, 0, true);

      var cd = new Uint8Array(46);
      var cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0x0800, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, hora, true);
      cdv.setUint16(14, data, true);
      cdv.setUint32(16, soma, true);
      cdv.setUint32(20, dados.length, true);
      cdv.setUint32(24, dados.length, true);
      cdv.setUint16(28, nomeB.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);

      locais.push(loc, nomeB, dados);
      centrais.push(cd, nomeB);
      offset += loc.length + nomeB.length + dados.length;
    }

    var cdBuf = concat(centrais);
    var eocd = new Uint8Array(22);
    var edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, sorted.length, true);
    edv.setUint16(10, sorted.length, true);
    edv.setUint32(12, cdBuf.length, true);
    edv.setUint32(16, offset, true);

    return concat([concat(locais), cdBuf, eocd]);
  }

  function slugify(txt) {
    var limpo = String(txt || 'plugin');
    if (limpo.normalize) limpo = limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return limpo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
  }

  function escapeXml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inferirFormato(lista) {
    var apps = {};
    lista.forEach(function (f) { apps[f.app] = true; });
    var chaves = Object.keys(apps);
    if (chaves.length === 1) {
      if (chaves[0] === 'photoshop') return 'photoshop-uxp';
      if (chaves[0] === 'indesign') return 'indesign-uxp';
      if (chaves[0] === 'coreldraw') return 'coreldraw-barra';
      if (chaves[0] === 'aftereffects') return 'aftereffects-painel';
      if (chaves[0] === 'tracedraw') return 'tracedraw';
      return 'adobe-cep';
    }
    return 'adobe-cep';
  }

  function construirPacote(opts) {
    var lista = opts.ferramentas || [];
    if (!lista.length) return Promise.reject(new Error('Nenhuma ferramenta selecionada.'));
    var iconesLib = root.IBDIcones || {};
    var defMap = (opts.iconesDef && opts.iconesDef.definicoes) || iconesLib.ICONES || {};
    var iconeId = (opts.iconeId && defMap[opts.iconeId]) ? opts.iconeId : (lista[0].icone || 'acao');
    var defIcone = defMap[iconeId];
    var corHex = opts.corHex || (defIcone && defIcone.cor) || '#f0c419';
    var fundoHex = opts.fundoHex || '#181a1f';
    var nomeFinal = (opts.nome && opts.nome.trim()) || (lista.length === 1 ? lista[0].titulo : 'IBD Kit Personalizado');
    var slug = slugify(nomeFinal);
    var formato = (!opts.formato || opts.formato === 'auto') ? inferirFormato(lista) : opts.formato;
    var svg = iconesLib.iconeSvg ? iconesLib.iconeSvg(iconeId, corHex, 26) : '';

    var obterCodigo = opts.obterCodigo || function (f) {
      if (!f.baixar || typeof fetch !== 'function') return Promise.resolve('// ' + f.titulo);
      return fetch(f.baixar).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
    };

    return Promise.all(lista.map(function (f) {
      return Promise.resolve(obterCodigo(f)).then(function (code) {
        return { item: f, code: code };
      });
    })).then(function (resolvidos) {
      if (formato === 'photoshop-uxp' || formato === 'indesign-uxp') {
        var ehId = formato === 'indesign-uxp';
        var pluginId = ('com.ibd.custom.' + slug.replace(/[^a-z0-9]/g, '')).slice(0, 48);
        var manifest = {
          manifestVersion: 5,
          id: pluginId,
          name: nomeFinal,
          version: '1.0.0',
          main: 'src/index.html',
          host: [{ app: ehId ? 'ID' : 'PS', minVersion: ehId ? '18.5.0' : '24.0.0' }],
          entrypoints: [{
            type: 'panel',
            id: pluginId + '.painel',
            label: { default: nomeFinal },
            minimumSize: { width: 220, height: 180 },
            maximumSize: { width: 1600, height: 1600 },
            preferredDockedSize: { width: 280, height: 360 }
          }],
          requiredPermissions: { localFileSystem: 'fullAccess' },
          icons: [{ width: 48, height: 48, path: 'src/icons/icone-48.png', scale: [1, 2], theme: ['darkest', 'dark', 'medium', 'lightest', 'light'] }]
        };

        var metaTools = resolvidos.map(function (r, idx) {
          var ext = (r.item.arquivo && r.item.arquivo.match(/\.[a-z0-9]+$/i) || ['.jsx'])[0];
          return { id: r.item.id, titulo: r.item.titulo, descricao: r.item.descricao, arquivo: 'src/scripts/' + idx + '-' + slugify(r.item.titulo) + ext };
        });

        var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>' + escapeXml(nomeFinal) + '</title>' +
          '<style>body{margin:0;padding:10px;background:' + fundoHex + ';color:#e4e7ee;font-family:"Adobe Clean","Segoe UI",sans-serif;font-size:12px}' +
          '.hdr{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid #3a404d}' +
          '.ico{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#181a1f;border:1px solid ' + corHex + '}' +
          'h1{margin:0;font-size:13px}.btn{display:block;width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid #3a404d;background:#20232a;color:#e4e7ee;text-align:left;cursor:pointer}' +
          '.btn:hover{border-color:' + corHex + '}#st{margin-top:10px;font-size:10px;color:#b6bcc8}</style></head>' +
          '<body><div class="hdr"><span class="ico">' + svg + '</span><h1>' + escapeXml(nomeFinal) + '</h1></div>' +
          '<div id="lista"></div><div id="st">Pronto.</div><script src="main.js"></script></body></html>';

        var runnerCode = ehId
          ? 'const{app,ScriptLanguage}=require("indesign");const fs=require("uxp").storage.localFileSystem;const TOOLS=' + JSON.stringify(metaTools) + ';const st=document.getElementById("st"),l=document.getElementById("lista");async function rodar(t){st.textContent="Executando "+t.titulo+"...";try{const p=await fs.getPluginFolder();const a=await p.getEntry(t.arquivo);app.doScript(await a.read(),ScriptLanguage.JAVASCRIPT);st.textContent="Concluido: "+t.titulo;}catch(e){st.textContent="Erro: "+(e.message||e);}}'
          : 'const{core,action}=require("photoshop");const fs=require("uxp").storage.localFileSystem;const TOOLS=' + JSON.stringify(metaTools) + ';const st=document.getElementById("st"),l=document.getElementById("lista");async function rodar(t){st.textContent="Executando "+t.titulo+"...";try{const p=await fs.getPluginFolder();const a=await p.getEntry(t.arquivo);const tok=await fs.createSessionToken(a);await core.executeAsModal(async()=>{const res=await action.batchPlay([{_obj:"AdobeScriptAutomation Scripts",javaScript:{_path:tok,_kind:"local"},javaScriptMessage:"BatchPlay",_options:{dialogOptions:"display"}}],{synchronousExecution:false});if(Array.isArray(res)&&res[0]&&(res[0]._obj==="error"||res[0].message))throw new Error(res[0].message||"Erro");},{commandName:t.titulo,interactive:true});st.textContent="Concluido: "+t.titulo;}catch(e){st.textContent="Erro: "+(e.message||e);}}';
        runnerCode += '\nfor(const t of TOOLS){const b=document.createElement("button");b.className="btn";b.textContent=t.titulo;b.onclick=()=>rodar(t);l.appendChild(b);}';

        var entradas = [
          { nome: 'manifest.json', dados: strBytes(JSON.stringify(manifest, null, 2) + '\n') },
          { nome: 'src/index.html', dados: strBytes(html) },
          { nome: 'src/main.js', dados: strBytes(runnerCode) },
          { nome: 'src/icons/icone-48.png', dados: pngBytes(defIcone, 48, corHex, fundoHex) },
          { nome: 'src/icons/icone-48@2x.png', dados: pngBytes(defIcone, 96, corHex, fundoHex) }
        ];
        for (var i = 0; i < resolvidos.length; i++) {
          entradas.push({ nome: metaTools[i].arquivo, dados: strBytes(resolvidos[i].code) });
        }
        return {
          nomeArquivo: 'ibd-custom-' + slug + '.ccx',
          mime: 'application/octet-stream',
          bytes: zipBytes(entradas)
        };
      }

      if (formato === 'coreldraw-barra') {
        var icoNome = slug + '.ico';
        var entradasCd = [{ nome: 'icones/' + icoNome, dados: icoBytes(defIcone, 32, corHex, fundoHex) }];
        var macros = [];
        resolvidos.forEach(function (r, idx) {
          var base = (r.item.arquivo && r.item.arquivo.split('/').pop()) || ('script-' + idx + '.bas');
          entradasCd.push({ nome: 'scripts/' + base, dados: strBytes(r.code) });
          var vb = (r.code.match(/^Attribute\s+VB_Name\s*=\s*"([^"]+)"/m) || [])[1] || ('IBD_' + idx);
          var sub = (r.code.match(/^Public\s+Sub\s+([A-Za-z0-9_]+)\s*\(/m) || [])[1] || 'Executar';
          macros.push({ titulo: r.item.titulo, macro: 'GlobalMacros.' + vb + '.' + sub });
        });
        var basInst = ('Attribute VB_Name = "IBD_' + slug.replace(/[^a-z0-9]/gi, '').slice(0, 16) + '"\r\nOption Explicit\r\nPublic Sub InstalarBarraPersonalizada()\r\n    Const BAR_NOME As String = "' + nomeFinal + '"\r\n    Const CUI_BAR_TOP As Long = 1\r\n    Const CAT_MACROS As String = "2cc24a3e-fe24-4708-9a74-9c75406eebcd"\r\n    Dim bar As CommandBar, btn As Object, pastaIcones As String, i As Long\r\n    pastaIcones = InputBox("Pasta com o arquivo ' + icoNome + ' (terminando com \\):", BAR_NOME, "C:\\IBD_Custom\\icones\\")\r\n    If Trim$(pastaIcones) = "" Then Exit Sub\r\n    If Right$(pastaIcones, 1) <> "\\" And Right$(pastaIcones, 1) <> "/" Then pastaIcones = pastaIcones & "\\"\r\n    For i = FrameWork.CommandBars.Count To 1 Step -1\r\n        If FrameWork.CommandBars(i).Name = BAR_NOME Then FrameWork.CommandBars(i).Delete\r\n    Next i\r\n    Set bar = FrameWork.CommandBars.Add(BAR_NOME, CUI_BAR_TOP, False)\r\n' +
          macros.map(function (m) {
            return '    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "' + m.macro + '")\r\n    If Not btn Is Nothing Then\r\n        btn.Caption = "' + m.titulo + '"\r\n        On Error Resume Next\r\n        btn.SetIcon2 pastaIcones & "' + icoNome + '"\r\n        If Err.Number <> 0 Then btn.SetCustomIcon pastaIcones & "' + icoNome + '"\r\n        On Error GoTo 0\r\n    End If';
          }).join('\r\n') +
          '\r\n    bar.Visible = True\r\nEnd Sub\r\n');
        entradasCd.push({ nome: 'IBD_InstalarCustom.bas', dados: strBytes(basInst) });
        return {
          nomeArquivo: 'ibd-coreldraw-' + slug + '.zip',
          mime: 'application/zip',
          bytes: zipBytes(entradasCd)
        };
      }

      if (formato === 'aftereffects-painel') {
        return {
          nomeArquivo: 'IBD ' + nomeFinal + '.jsx',
          mime: 'text/javascript',
          bytes: strBytes(resolvidos.map(function (r) { return r.code; }).join('\n\n'))
        };
      }

      if (formato === 'tracedraw') {
        return {
          nomeArquivo: 'ibd-tracedraw-' + slug + '.js',
          mime: 'text/javascript',
          bytes: strBytes(resolvidos.map(function (r) { return '// ' + r.item.titulo + '\n' + r.code; }).join('\n\n'))
        };
      }

      /* Adobe CEP Universal (.zip) */
      var bundleId = ('com.ibd.custom.' + slug.replace(/[^a-z0-9]/g, '')).slice(0, 48);
      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ExtensionManifest Version="8.0" ExtensionBundleId="' + bundleId + '" ExtensionBundleVersion="1.0.0" ExtensionBundleName="' + escapeXml(nomeFinal) + '">\n' +
        '  <ExtensionList><Extension Id="' + bundleId + '.panel" Version="1.0.0" /></ExtensionList>\n' +
        '  <ExecutionEnvironment><HostList><Host Name="ILST" Version="[22.0,99.9]"/><Host Name="AEFT" Version="[15.0,99.9]"/><Host Name="IDSN" Version="[14.0,99.9]"/><Host Name="PHXS" Version="[19.0,99.9]"/></HostList><LocaleList><Locale Code="All"/></LocaleList><RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="8.0"/></RequiredRuntimeList></ExecutionEnvironment>\n' +
        '  <DispatchInfoList><Extension Id="' + bundleId + '.panel"><DispatchInfo><Resources><MainPath>./index.html</MainPath><ScriptPath>./host/runner.jsx</ScriptPath></Resources><Lifecycle><AutoVisible>true</AutoVisible></Lifecycle><UI><Type>Panel</Type><Menu>' + escapeXml(nomeFinal) + '</Menu><Geometry><Size><Height>320</Height><Width>260</Width></Size></Geometry></UI></DispatchInfo></Extension></DispatchInfoList>\n</ExtensionManifest>\n';
      var ferramentasCep = resolvidos.map(function (r, idx) {
        return { titulo: r.item.titulo, arquivo: 'scripts/' + idx + '-' + slugify(r.item.titulo) + '.jsx' };
      });
      var csInterfaceCode = '(function(r){function C(){}C.prototype.getSystemPath=function(t){return r.__adobe_cep__?decodeURI(r.__adobe_cep__.getSystemPath(t)):""};C.prototype.evalScript=function(s,cb){if(r.__adobe_cep__)r.__adobe_cep__.evalScript(s,cb||function(){});else if(cb)cb("ERRO:CEP");};r.SystemPath={EXTENSION:"extension"};r.CSInterface=C;}(window));';
      var runnerJsx = 'function ibdExecutarArquivo(c){try{var f=new File(c);if(!f.exists)return "ERRO:Nao encontrado";$.evalFile(f);return "OK";}catch(e){return "ERRO:"+(e.message||e);}}\n';
      var htmlCep = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>' + escapeXml(nomeFinal) + '</title>' +
        '<style>body{margin:0;padding:10px;background:' + fundoHex + ';color:#e4e7ee;font-family:"Segoe UI",sans-serif;font-size:12px}.hdr{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid #3a404d}.ico{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#181a1f;border:1px solid ' + corHex + '}h1{margin:0;font-size:13px}.btn{display:block;width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid #3a404d;background:#20232a;color:#e4e7ee;text-align:left;cursor:pointer}.btn:hover{border-color:' + corHex + '}#st{margin-top:10px;font-size:10px;color:#b6bcc8}</style></head>' +
        '<body><div class="hdr"><span class="ico">' + svg + '</span><h1>' + escapeXml(nomeFinal) + '</h1></div><div id="lista"></div><div id="st">Pronto.</div>' +
        '<script src="js/CSInterface.js"></script><script>var cs=new CSInterface(),TOOLS=' + JSON.stringify(ferramentasCep) + ',l=document.getElementById("lista"),st=document.getElementById("st");TOOLS.forEach(function(t){var b=document.createElement("button");b.className="btn";b.textContent=t.titulo;b.onclick=function(){var base=(cs.getSystemPath(SystemPath.EXTENSION)||"").replace(/\\\\/g,"/").replace(/\\/+$/,"");var p=base?(base+"/"+t.arquivo):t.arquivo;cs.evalScript("ibdExecutarArquivo("+JSON.stringify(p)+")",function(r){st.textContent=r&&r.indexOf("ERRO:")===0?r:"Concluido: "+t.titulo;});};l.appendChild(b);});</script></body></html>';
      var macCmd = '#!/bin/bash\nset -e\nDIR="$(cd "$(dirname "$0")" && pwd)"\nDEST="$HOME/Library/Application Support/Adobe/CEP/extensions/' + bundleId + '"\nmkdir -p "$(dirname "$DEST")" && rm -rf "$DEST" && cp -R "$DIR" "$DEST"\nfor v in 8 9 10 11 12 13 14 15 16; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done\necho "Instalado em $DEST"\n';
      var winBat = '@echo off\r\nset "DEST=%APPDATA%\\Adobe\\CEP\\extensions\\' + bundleId + '"\r\nif exist "%DEST%" rmdir /s /q "%DEST%"\r\nxcopy "%~dp0." "%DEST%\\" /E /I /Y /Q >nul\r\nfor %%V in (8 9 10 11 12 13 14 15 16) do reg add "HKCU\\Software\\Adobe\\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1\r\necho Instalado em %DEST% & pause\r\n';

      var entCep = [
        { nome: 'CSXS/manifest.xml', dados: strBytes(xml) },
        { nome: 'index.html', dados: strBytes(htmlCep) },
        { nome: 'js/CSInterface.js', dados: strBytes(csInterfaceCode) },
        { nome: 'host/runner.jsx', dados: strBytes(runnerJsx) },
        { nome: 'Instalar-macOS.command', dados: strBytes(macCmd) },
        { nome: 'Instalar-Windows.bat', dados: strBytes(winBat) }
      ];
      for (var k = 0; k < resolvidos.length; k++) {
        entCep.push({ nome: ferramentasCep[k].arquivo, dados: strBytes(resolvidos[k].code) });
      }
      return {
        nomeArquivo: 'ibd-cep-' + slug + '.zip',
        mime: 'application/zip',
        bytes: zipBytes(entCep)
      };
    });
  }

  return {
    crc32: crc32,
    pngBytes: pngBytes,
    icoBytes: icoBytes,
    zipBytes: zipBytes,
    inferirFormato: inferirFormato,
    construirPacote: construirPacote
  };
}));
