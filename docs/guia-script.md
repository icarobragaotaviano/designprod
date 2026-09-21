# Guia de script

## Criar

```bash
npm run new -- <app> <nome-do-arquivo> "<Título>" "<Descrição>"
```

Exemplo:

```bash
npm run new -- illustrator exportar-svg "Exportar SVG" "Exporta cada prancheta como SVG otimizado."
```

Gera `apps/illustrator/scripts/exportar-svg.jsx` com cabeçalho, includes e esqueleto do formulário.

## Cabeçalho obrigatório

```jsx
/**
 * @ibd-id illustrator/exportar-svg     ← sempre <app>/<nome-do-arquivo>
 * @ibd-titulo Exportar SVG             ← aparece no menu e no painel
 * @ibd-descricao Uma frase, até 200 caracteres.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0                    ← semver
 * @ibd-tags export, svg                ← opcional, separado por vírgula
 */
```

`npm run validate` recusa cabeçalho incompleto ou incoerente. É o que mantém o catálogo confiável.

## Estrutura padrão

```jsx
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'illustrator/exportar-svg';
  IBD.exigirHost(['illustrator']);          // 1. valida o app

  var salvas = IBD.prefs.ler(ID);           // 2. lembra a última escolha
  var opcoes = IBD.ui.formulario(...);      // 3. pergunta uma vez só
  if (!opcoes) return;                      // 4. cancelar é saída limpa
  IBD.prefs.gravar(ID, opcoes);

  var barra = IBD.ui.progresso(total, ...); // 5. progresso + cancelamento
  try { /* trabalho */ } finally { barra.fechar(); }

  IBD.ui.resumo(...);                       // 6. relatório final
})();
```

Cinco regras que valem para todos:

1. **Nunca altere o original sem aviso.** Exportação vai para pasta separada.
2. **Restaure o estado do app.** Unidades, `displayDialogs`, prancheta ativa — guarde antes, devolva no `finally`.
3. **Uma falha não derruba o lote.** `try/catch` por item, lista de falhas no resumo.
4. **Cancelar tem que funcionar.** Cheque `barra.cancelado()` a cada volta do laço.
5. **Relate o que aconteceu.** Quantos entraram, quantos saíram, onde ficou.

## API do core

### `IBD` (ibd-core.jsx)

| | |
|---|---|
| `IBD.host()` | id do app: `photoshop`, `illustrator`, ... |
| `IBD.exigirHost(['photoshop'])` | interrompe com mensagem clara se o app não bater |
| `IBD.json.stringify(v, '  ')` / `IBD.json.parse(s)` | JSON (ExtendScript não tem nativo) |
| `IBD.slug('Arte Final')` | `Arte-Final` — sem acento, seguro para nome de arquivo |
| `IBD.pad(7, 3)` | `007` |
| `IBD.carimbo()` | `20260921-1430` |
| `IBD.executar(rótulo, fn)` | executa capturando erro; devolve `{ok, valor, erro}` |
| `IBD.alerta` / `IBD.confirmar` / `IBD.log` | mensagens |

### `IBD.fs` (ibd-fs.jsx)

| | |
|---|---|
| `garantirPasta(caminho)` | cria a pasta e os níveis acima |
| `caminhoLivre(pasta, base, ext)` | acrescenta `-01`, `-02`… para não sobrescrever |
| `listar(pasta, ['psd','jpg'], recursivo)` | lista arquivos filtrando por extensão |
| `lerTexto` / `escreverTexto` / `lerJSON` / `escreverJSON` | leitura e escrita |
| `semExtensao` / `extensao` | nome e extensão |
| `pastaDados()` | pasta de dados do estúdio no perfil do usuário |
| `pastaSaidaPadrao('export')` | pasta na Área de Trabalho já com carimbo de data |

### `IBD.ui` (ibd-ui.jsx)

`IBD.ui.formulario(titulo, campos)` devolve um objeto `id → valor`, ou `null` se cancelado.

Tipos de campo: `texto`, `numero`, `booleano`, `escolha` (usa `opcoes`), `pasta`, `arquivo`.

```jsx
{ id: 'escala', rotulo: 'Escala (%)', tipo: 'numero', padrao: 100, ajuda: 'Texto explicativo opcional.' }
```

`IBD.ui.progresso(total, titulo)` devolve `{atualizar(passo, texto), cancelado(), fechar()}`.

`IBD.ui.resumo(titulo, linhas)` mostra o relatório final.

### `IBD.prefs` (ibd-prefs.jsx)

`ler(ID)` e `gravar(ID, valores)`. Grava JSON em `Folder.userData/IBD/`. `Folder` e `File` viram caminho de texto automaticamente.

## Testar

O CI valida a estrutura do repositório. Para o kit de guias e sangria, `npm run test:guias` também executa 40 verificações de lógica com os contratos dos aplicativos simulados em Node.js. Esses testes não executam ExtendScript dentro dos aplicativos Adobe. Antes de marcar um script como pronto:

1. Rode com 1 item.
2. Rode com 30 itens e cancele no meio.
3. Rode com um arquivo corrompido ou camada vazia no lote.
4. Confira se as unidades e preferências do app voltaram ao normal.

Depois: `npm run catalog && npm run validate` e commit.
