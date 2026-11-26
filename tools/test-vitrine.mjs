#!/usr/bin/env node
/**
 * Testes da vitrine (site/src/app.js + site/src/index.html + site/publico):
 *  - valida padronizacao de titulos e descricoes de todos os cartoes gerados
 *  - exercita o sistema de favoritos (aba exclusiva, estrela, propriedades,
 *    busca em favoritos, limpeza com confirmacao e persistencia localStorage)
 *
 * Uso: node tools/test-vitrine.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'build-site.mjs')], { cwd: RAIZ, stdio: 'pipe' });

const html = fs.readFileSync(path.join(RAIZ, 'site', 'publico', 'index.html'), 'utf8');
const matchDados = html.match(/<script id="dados" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(matchDados, 'Bloco #dados ausente em site/publico/index.html');
const dados = JSON.parse(matchDados[1]);
const appCode = fs.readFileSync(path.join(RAIZ, 'site', 'publico', 'app.js'), 'utf8');

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack || String(e) });
  }
}

/* 1. Auditoria de nomenclatura e descricoes de todos os cartoes ------ */

test('Todos os itens da vitrine possuem titulo limpo e descricao informativa', () => {
  assert.ok(dados.ferramentas.length >= 90);
  for (const f of dados.ferramentas) {
    assert.ok(f.titulo && f.titulo.trim() === f.titulo && f.titulo.length >= 5, `Titulo invalido em ${f.id}: "${f.titulo}"`);
    assert.ok(!f.titulo.includes('_'), `Underscore no titulo de ${f.id}: "${f.titulo}"`);
    assert.ok(f.descricao && f.descricao.length >= 45, `Descricao curta demais em ${f.id}: "${f.descricao}"`);
    assert.notEqual(f.descricao, 'Disponível no painel UXP do Photoshop.', `Descricao legada UXP em ${f.id}`);
    const nomeEditor = dados.nomesApps[f.app] || '';
    if (nomeEditor) {
      assert.notEqual(f.descricao, `${nomeEditor} · ${f.titulo}`, `Descricao redundante em ${f.id}`);
    }
  }
});

test('Tutoriais ilustrados apontam para as ferramentas publicadas', () => {
  const guia = fs.readFileSync(path.join(RAIZ, 'site/publico/tutoriais/index.html'), 'utf8');
  assert.match(html, /href="\/tutoriais\/">Tutoriais/);
  const licoes = [...guia.matchAll(/<article class="licao" id="([^"]+)"/g)];
  assert.equal(licoes.length, 13);
  assert.equal(new Set(licoes.map(m => m[1])).size, licoes.length);
  assert.equal((guia.match(/<figcaption>/g) || []).length, licoes.length);
  assert.equal((guia.match(/<ol class="passos">/g) || []).length, licoes.length);
  for (const ferramenta of dados.ferramentas.filter(f => f.tutorial)) {
    assert.ok(guia.includes(`id="${ferramenta.tutorial.split('#')[1]}"`), ferramenta.id);
    if (ferramenta.baixar) assert.ok(guia.includes(ferramenta.baixar), ferramenta.id);
  }
});

test('Índice de scripts inclui as ferramentas do catálogo e da bancada', () => {
  const pasta = path.join(RAIZ, 'site/publico');
  const scripts = fs.readFileSync(path.join(pasta, 'scripts/index.html'), 'utf8');
  assert.match(html, /href="\/scripts\/">Scripts/);
  const esperados = dados.ferramentas.filter(f => f.tipo === 'script' || (f.id.startsWith('desktop/') && f.tipo === 'utilitário'));
  assert.ok(esperados.length >= 65);
  assert.equal((scripts.match(/class="script" data-item/g) || []).length, esperados.length);
  for (const f of esperados) {
    for (const url of [f.baixar, f.codigo]) {
      assert.ok(scripts.includes(url), `${f.id} · ${url}`);
      assert.ok(fs.statSync(path.join(pasta, url)).isFile(), `${f.id} · ${url}`);
    }
  }
});

/* 2. Harness DOM minimo para testar a aba exclusiva de Favoritos ----- */

function criarDomSimulado(storeInicial, hashInicial) {
  const storageMap = new Map(Object.entries(storeInicial || {}));
  const ids = new Map();
  const docListeners = new Map();
  const winListeners = new Map();

  class FakeClassList {
    constructor(el) { this.el = el; }
    _set() { return new Set((this.el.className || '').split(/\s+/).filter(Boolean)); }
    add(...cls) { const s = this._set(); cls.forEach((c) => s.add(c)); this.el.className = [...s].join(' '); }
    remove(...cls) { const s = this._set(); cls.forEach((c) => s.delete(c)); this.el.className = [...s].join(' '); }
    toggle(c, force) {
      const s = this._set();
      const has = force !== undefined ? !!force : !s.has(c);
      if (has) s.add(c); else s.delete(c);
      this.el.className = [...s].join(' ');
      return has;
    }
    contains(c) { return this._set().has(c); }
  }

  class FakeElement {
    constructor(tag, id) {
      this.tagName = String(tag).toUpperCase();
      this.attrs = {};
      this.dataset = {};
      this.children = [];
      this.listeners = new Map();
      this._text = '';
      this.className = '';
      this.classList = new FakeClassList(this);
      this.hidden = false;
      this.value = '';
      this.tabIndex = -1;
      if (id) { this.id = id; this.attrs.id = id; ids.set(id, this); }
    }
    set id(v) { this._id = v; if (v) ids.set(v, this); }
    get id() { return this._id || ''; }
    get textContent() {
      if (this.children.length === 0) return this._text;
      return this._text + this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join('');
    }
    set textContent(v) { this.children = []; this._text = v === null || v === undefined ? '' : String(v); }
    get innerHTML() { return ''; }
    set innerHTML(v) { if (v === '') { this.children = []; this._text = ''; } }
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
      if (k === 'class') this.className = String(v);
    }
    getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener(type, cb) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(cb);
    }
    dispatchEvent(evt) {
      const ev = Object.assign({ preventDefault() {}, stopPropagation() {} }, evt);
      for (const cb of this.listeners.get(ev.type) || []) cb(ev);
    }
    click() { this.dispatchEvent({ type: 'click' }); }
    focus() { doc.activeElement = this; }
    select() {}
    scrollIntoView() {}
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const ch of n.children) {
          if (typeof ch === 'string') continue;
          if (matches(ch, sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
  }

  function matches(el, sel) {
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel === '[data-plataforma]') return el.dataset.plataforma !== undefined;
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return el.tagName.toLowerCase() === sel.toLowerCase();
  }

  const root = new FakeElement('body');
  const platGroup = new FakeElement('div');
  for (const p of ['todas', 'online', 'desktop']) {
    const b = new FakeElement('button');
    b.dataset.plataforma = p;
    platGroup.appendChild(b);
  }
  root.appendChild(platGroup);

  for (const [tag, id] of [
    ['button', 'abrir-biblioteca'], ['button', 'abrir-favoritos'], ['span', 'contador-favoritos'],
    ['button', 'abrir-instalacao'], ['button', 'ajuda-instalar'], ['button', 'modo-grade'], ['button', 'modo-lista'],
    ['section', 'biblioteca'], ['section', 'favoritos'], ['section', 'instalacao'], ['aside', 'propriedades'],
    ['h2', 'titulo-biblioteca'], ['h2', 'titulo-favoritos'], ['h2', 'titulo-instalacao'],
    ['span', 'resultados'], ['span', 'resultados-favoritos'], ['button', 'limpar-favoritos'],
    ['div', 'lista'], ['div', 'lista-favoritos'], ['input', 'busca'], ['div', 'filtros'],
    ['span', 'contagem'], ['nav', 'acoes-repo'], ['div', 'detalhes'], ['span', 'contexto'],
    ['div', 'baixar-painel'], ['h2', 'titulo-propriedades']
  ]) {
    root.appendChild(new FakeElement(tag, id));
  }
  ids.get('dados') || (() => {
    const sc = new FakeElement('script', 'dados');
    sc.textContent = JSON.stringify(dados);
    root.appendChild(sc);
  })();

  const doc = {
    activeElement: root,
    getElementById: (id) => ids.get(id) || null,
    createElement: (t) => new FakeElement(t),
    createElementNS: (_ns, t) => new FakeElement(t),
    createTextNode: (t) => String(t),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener: (t, cb) => { if (!docListeners.has(t)) docListeners.set(t, []); docListeners.get(t).push(cb); }
  };

  const loc = { pathname: '/', search: '', hash: hashInicial || '' };
  const win = {
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v))
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: (t, cb) => { if (!winListeners.has(t)) winListeners.set(t, []); winListeners.get(t).push(cb); }
  };

  const sandbox = {
    window: win,
    document: doc,
    location: loc,
    history: { replaceState: (_s, _t, url) => { loc.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } },
    setTimeout: () => 1,
    clearTimeout: () => {},
    encodeURIComponent,
    decodeURIComponent,
    JSON, Array, Object, String, Number, Boolean, Math, Error
  };
  win.window = win;

  vm.runInContext(appCode, vm.createContext(sandbox));
  return { ids, loc, storageMap, sandbox };
}

test('HTML da vitrine possui botao de aba Favoritos e secao exclusiva #favoritos', () => {
  assert.match(html, /id="abrir-favoritos"/);
  assert.match(html, /id="contador-favoritos"/);
  assert.match(html, /id="favoritos"/);
  assert.match(html, /id="lista-favoritos"/);
  assert.match(html, /id="limpar-favoritos"/);
});

test('Favoritar nos cartoes e no painel atualiza contador, aba exclusiva e localStorage', () => {
  const { ids, storageMap, loc } = criarDomSimulado();
  const favSec = ids.get('favoritos');
  const libSec = ids.get('biblioteca');
  const propSec = ids.get('propriedades');
  assert.equal(favSec.hidden, true);
  assert.equal(ids.get('contador-favoritos').textContent, '0');
  assert.match(ids.get('lista-favoritos').textContent, /Nenhuma ferramenta favoritada/);

  // Favorita o primeiro cartao da biblioteca
  const botoesFav = ids.get('lista').querySelectorAll('.favoritar');
  assert.ok(botoesFav.length >= 90);
  botoesFav[0].click();
  assert.equal(ids.get('contador-favoritos').textContent, '1');
  const salvo = JSON.parse(storageMap.get('ibd-designprod-favoritos-v1'));
  assert.equal(salvo.length, 1);

  // Favorita o segundo item via botao no inspetor de Propriedades
  const segundoCartao = ids.get('lista').querySelectorAll('.cartao')[1];
  segundoCartao.querySelector('.selecionar-ferramenta').click();
  const btnDetFav = ids.get('detalhes').querySelector('.botao-favorito');
  assert.ok(btnDetFav);
  btnDetFav.click();
  assert.equal(ids.get('contador-favoritos').textContent, '2');

  // Abre a aba exclusiva Favoritos
  ids.get('abrir-favoritos').click();
  assert.equal(favSec.hidden, false);
  assert.equal(libSec.hidden, true);
  assert.equal(propSec.hidden, false);
  assert.equal(ids.get('abrir-favoritos').getAttribute('aria-pressed'), 'true');
  assert.match(loc.hash, /aba=favoritos/);
  assert.equal(ids.get('lista-favoritos').querySelectorAll('.cartao').length, 2);
  assert.equal(ids.get('resultados-favoritos').textContent, '2 favoritos');

  // Busca dentro da aba Favoritos sem sair dela
  const busca = ids.get('busca');
  busca.value = dados.ferramentas[0].titulo.toLowerCase();
  busca.dispatchEvent({ type: 'input' });
  assert.equal(favSec.hidden, false);
  assert.equal(ids.get('lista-favoritos').querySelectorAll('.cartao').length, 1);

  // Limpa busca e aciona limpeza dupla de favoritos
  busca.value = '';
  busca.dispatchEvent({ type: 'input' });
  const btnLimpar = ids.get('limpar-favoritos');
  assert.equal(btnLimpar.hidden, false);
  btnLimpar.click();
  assert.equal(btnLimpar.textContent, 'Confirmar limpeza?');
  assert.equal(ids.get('contador-favoritos').textContent, '2');
  btnLimpar.click();
  assert.equal(ids.get('contador-favoritos').textContent, '0');
  assert.equal(JSON.parse(storageMap.get('ibd-designprod-favoritos-v1')).length, 0);
});

test('Reload com localStorage e #aba=favoritos restaura aba e itens favoritados', () => {
  const idAlvo = 'illustrator/margem-seguranca-guias';
  const { ids } = criarDomSimulado({ 'ibd-designprod-favoritos-v1': JSON.stringify([idAlvo, 'inexistente/id']) }, '#aba=favoritos');
  assert.equal(ids.get('favoritos').hidden, false);
  assert.equal(ids.get('biblioteca').hidden, true);
  assert.equal(ids.get('contador-favoritos').textContent, '1');
  const cards = ids.get('lista-favoritos').querySelectorAll('.cartao');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].dataset.ferramenta, idAlvo);
});

/* Relatorio ---------------------------------------------------------- */

const falhas = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
  if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
}
console.log(`\n${results.length - falhas.length}/${results.length} testes da vitrine e favoritos passaram.`);
if (falhas.length) process.exit(1);
