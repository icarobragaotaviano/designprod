# Plugins: UXP, CEP e ExtendScript

## As três tecnologias

| | O que é | Onde roda |
|---|---|---|
| **ExtendScript** (`.jsx`) | Linguagem de script da Adobe, baseada em ES3. Sem interface própria além do ScriptUI. | Praticamente todos os apps Creative Cloud |
| **CEP** | Painel HTML legado, conversa com ExtendScript. Adobe sinalizou substituição pelo UXP. | Apps CC que ainda não migraram |
| **UXP** | Plataforma atual: painel HTML/CSS/JS moderno, API própria, empacotamento `.ccx`. | Apps já migrados |

Este repositório usa **ExtendScript para a lógica** e **UXP para a interface**, pelos motivos em [arquitetura.md](arquitetura.md).

## Suporte por app

O estado abaixo é o ponto de partida do projeto. **Confirme em [developer.adobe.com](https://developer.adobe.com/) antes de começar o plugin de um app**: a Adobe vem migrando apps para UXP a cada ciclo e essa tabela envelhece rápido.

| App | Script | Painel | Observação |
|---|---|---|---|
| Photoshop | ExtendScript e UXP | **UXP** | Plataforma mais madura. É por onde começamos. |
| InDesign | ExtendScript e UXPScript | **UXP** | Suporte a plugin UXP a partir do InDesign 18.5. |
| Illustrator | ExtendScript | CEP | Verificar se já saiu plugin UXP público. |
| After Effects | ExtendScript / ScriptUI | CEP | Painel ScriptUI resolve boa parte dos casos sem plugin. |
| Premiere Pro | ExtendScript | CEP, UXP em migração | Verificar a versão mínima antes de investir. |
| Bridge | ExtendScript | CEP | Baixa prioridade. |

Enquanto um app não tiver UXP, o caminho é: script `.jsx` catalogado + `install:dev` no menu. A ferramenta já funciona; o painel entra quando a plataforma permitir.

## O painel do Photoshop

```
plugins/photoshop-uxp/
├── manifest.json               identidade, permissões, entrypoint
└── src/
    ├── index.html              estrutura
    ├── styles.css              tokens gerados de brand.config.json
    ├── main.js                 lê catalog.json e desenha a lista
    ├── catalog.json            cópia gerada
    ├── bundle/                 cópia gerada de apps/ e core/
    └── lib/
        ├── ferramentas-uxp.js  ferramentas nativas UXP
        └── es-bridge.js        ponte para rodar .jsx
```

`main.js` não conhece nenhuma ferramenta pelo nome. Ele filtra `catalog.json` por `app === 'photoshop'` e concatena com as ferramentas UXP nativas. Adicionar ferramenta é rodar `npm run catalog && npm run build:plugin`.

### Ciclo de desenvolvimento

```bash
npm run build:plugin
```

No UXP Developer Tool: **Add Plugin** → `plugins/photoshop-uxp/manifest.json` → **Load**. Depois de alterar o código, **Reload** no UDT. Alterou um `.jsx`? Rode `build:plugin` de novo — o `bundle/` é uma cópia.

`bundle/` está no `.gitignore` de propósito: é conteúdo derivado.

### Ponte para ExtendScript — estado real

`es-bridge.js` executa um `.jsx` a partir do painel usando o evento `AdobeScriptAutomation Scripts` do `batchPlay`. **Esse evento não faz parte da API pública documentada da Adobe.** Funciona em várias versões do Photoshop, mas pode mudar sem aviso.

O código foi escrito para falhar de forma explícita: se a ponte não funcionar, o painel mostra o erro e o caminho do arquivo, e a saída é Arquivo › Scripts › Procurar. Nenhuma ferramenta fica inacessível por causa disso.

**Pendente:** validar a ponte na sua versão do Photoshop. Se ela não funcionar, as duas alternativas são (a) migrar a ferramenta para UXP nativo em `ferramentas-uxp.js`, que é o caminho preferido, ou (b) manter o script no menu via `install:dev`.

### Ferramenta nativa UXP

Mais estável que a ponte, e o caminho padrão para lógica nova de Photoshop que a API cobre. Em `src/lib/ferramentas-uxp.js`:

```js
{
  id: 'photoshop/uxp/minha-ferramenta',
  titulo: 'Minha ferramenta',
  descricao: 'Uma frase.',
  app: 'photoshop',
  tipo: 'uxp',
  tags: ['camadas'],
  async executar() {
    await core.executeAsModal(async () => { /* ... */ }, { commandName: 'IBD — ...' });
    return 'Mensagem para a barra de status.';
  }
}
```

Toda alteração no documento precisa estar dentro de `core.executeAsModal`. O retorno vira o texto do rodapé do painel.

## Instalar no Photoshop

Dois caminhos. O primeiro é o de uso normal; o segundo é o que funciona quando o Creative Cloud recusa o pacote por ele não ser assinado.

### Pelo Creative Cloud — arquivo `.ccx`

1. Guarde o `.ccx` **no mesmo drive** onde o Photoshop está instalado. O instalador procura só no drive em que o arquivo estiver — é a causa mais comum de "dei duplo clique e não aconteceu nada".
2. Duplo clique. Se nada acontecer, clique com o botão direito e use **Abrir com > Unified Plugin Installer Agent**: a associação do tipo de arquivo costuma se perder.
3. O painel passa a aparecer no menu **Plugins** do Photoshop.

Se o Creative Cloud disser que o plugin não é compatível, confira no aplicativo Creative Cloud se o Photoshop aparece em *Aplicativos instalados* — sem isso ele não reconhece nenhum plugin como compatível.

### Pelo UXP Developer Tool — arquivo `.zip`

1. No Photoshop, abra **Preferências > Plugins** e marque **Ativar modo de desenvolvedor**. No Windows: **Editar > Preferências > Plugins**. Reinicie o Photoshop.
2. Instale o **Adobe UXP Developer Tool** pelo aplicativo Creative Cloud.
3. Descompacte o `.zip` numa pasta definitiva. O UDT aponta para a pasta, não copia o conteúdo: apagar ou mover a pasta tira o painel do Photoshop.
4. No UDT: **Add Plugin** e escolha o `manifest.json` na raiz da pasta descompactada.
5. Na linha do plugin, **Actions > Load**.
6. O painel abre no Photoshop. Fechou? Reabra pelo menu **Plugins**.

Se o painel não estiver lá depois de reiniciar o Photoshop, carregue de novo pelo UDT.

**Menu Plugins inteiro desabilitado** é sintoma de outro plugin quebrando o subsistema UXP na inicialização, não deste. O diagnóstico é tirar os plugins da pasta, reiniciar, e devolver um a um.

Durante o desenvolvimento, **Actions > Watch** recarrega o painel a cada alteração no disco.

## Distribuir

`npm run build:plugin` já deixa o pacote pronto em `dist/`:

| Arquivo | Para quê |
|---|---|
| `ibd-ferramentas-<versao>.ccx` | Duplo clique, instalação pelo Creative Cloud |
| `ibd-ferramentas-<versao>.zip` | Mesmo arquivo, para descompactar e carregar no UDT |

Os dois são byte a byte idênticos — muda só a extensão, porque um `.ccx` é um ZIP com o `manifest.json` na raiz. Quem monta é `tools/lib/zip.mjs`, um escritor de ZIP escrito à mão para o repositório continuar sem nenhuma dependência. As datas dentro do pacote são fixas, então o mesmo conteúdo gera sempre os mesmos bytes e um rebuild só muda o arquivo quando o plugin mudou de verdade.

O pacote também é publicado pela [vitrine](site.md), com um botão de download gerado a cada build.

**O pacote não é assinado.** O Creative Cloud pode recusar um plugin sem assinatura; nesse caso o caminho é o UDT: descompacte o `.zip` e aponte para o `manifest.json`. Para um `.ccx` assinado, use o **Package** do próprio UDT, que assina com um certificado gerado na hora. Publicar no Adobe Exchange exige conta de desenvolvedor e revisão da Adobe.

**Pendente:** confirmar se o Creative Cloud aceita o `.ccx` sem assinatura na sua máquina. É o único elo desta cadeia que não dá para verificar fora do seu computador — o resto (ZIP válido, `manifest.json` na raiz, painel completo dentro do pacote) está coberto por `npm run test:pacote`.

## Novo plugin para outro app

1. Confirme que o app suporta UXP (tabela acima, verificada no site da Adobe).
2. Copie `plugins/photoshop-uxp/` para `plugins/<app>-uxp/`.
3. No `manifest.json`: troque `id`, `host.app` e a versão mínima.
4. Em `main.js`: troque o filtro `f.app === 'photoshop'`.
5. Adapte `ferramentas-uxp.js` para a API daquele app.
6. `node tools/build-plugin.mjs <app>-uxp`.

`main.js`, `styles.css` e o catálogo não mudam — essa é a razão de o catálogo existir.
