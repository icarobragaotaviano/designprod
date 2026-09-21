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

## Distribuir

1. `npm run build:plugin`
2. No UDT: **Package** — gera o `.ccx` assinado
3. O `.ccx` instala com duplo clique

Publicar no Adobe Exchange exige conta de desenvolvedor e revisão da Adobe. Para uso próprio e de clientes, o `.ccx` direto basta.

## Novo plugin para outro app

1. Confirme que o app suporta UXP (tabela acima, verificada no site da Adobe).
2. Copie `plugins/photoshop-uxp/` para `plugins/<app>-uxp/`.
3. No `manifest.json`: troque `id`, `host.app` e a versão mínima.
4. Em `main.js`: troque o filtro `f.app === 'photoshop'`.
5. Adapte `ferramentas-uxp.js` para a API daquele app.
6. `node tools/build-plugin.mjs <app>-uxp`.

`main.js`, `styles.css` e o catálogo não mudam — essa é a razão de o catálogo existir.
