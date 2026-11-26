(() => {
  const busca = document.querySelector('.busca');
  const campo = document.querySelector('#buscar-guias');
  const resultado = document.querySelector('#resultado-busca');
  const grupos = [...document.querySelectorAll('[data-grupo]')];
  const indice = new Map([...document.querySelectorAll('[data-indice-item]')].map(a => [a.dataset.indiceItem, a.parentElement]));
  const itens = [...document.querySelectorAll('[data-item]')];
  const normalizar = valor => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termos = new Map(itens.map(item => [
    item, normalizar([item.textContent, item.dataset.busca || ''].join(' '))
  ]));

  busca.hidden = false;
  function filtrar() {
    const palavras = normalizar(campo.value.trim()).split(/\s+/).filter(Boolean);
    let visiveis = 0;
    for (const item of itens) {
      item.hidden = !palavras.every(palavra => termos.get(item).includes(palavra));
      const link = indice.get(item.id);
      if (link) link.hidden = item.hidden;
      if (!item.hidden) visiveis++;
    }
    for (const grupo of grupos) {
      grupo.hidden = !grupo.querySelector('[data-item]:not([hidden])');
      const area = document.querySelector('[data-indice="' + grupo.id + '"]');
      if (area) {
        area.hidden = grupo.hidden;
        if (palavras.length && !area.hidden) area.open = true;
      }
    }
    document.querySelector('.sem-resultados').hidden = visiveis !== 0;
    resultado.textContent = palavras.length ? visiveis + ' de ' + itens.length : '';
  }

  campo.addEventListener('input', filtrar);
  window.addEventListener('hashchange', () => {
    if (!campo.value) return;
    const destino = document.getElementById(location.hash.slice(1));
    if (!destino || !destino.closest('[hidden]')) return;
    campo.value = '';
    filtrar();
    destino.scrollIntoView();
  });
})();
