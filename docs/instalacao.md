# Instalação

## Requisitos

- Node 18 ou superior (só para as ferramentas de linha de comando)
- Os apps Adobe que você quiser usar

```bash
git clone https://github.com/icarobragaotaviano/designprod.git
cd designprod
npm run validate
```

Não há `npm install`: o repositório não usa dependências externas.

## Opção 1 — Scripts no menu do app (mais simples)

```bash
npm run install:dev -- --list   # confere as pastas detectadas
npm run install:dev             # instala
```

O comando grava um lançador em cada pasta de scripts encontrada. Depois disso:

| App | Onde aparece |
|---|---|
| Photoshop | Arquivo › Scripts › `IBD ...` |
| Illustrator | Arquivo › Scripts › `IBD ...` |
| InDesign | Painel Scripts (Janela › Utilitários › Scripts) |
| After Effects | Janela › `IBD ...` |

Reinicie os apps que estiverem abertos.

### Se a pasta não for encontrada

O instalador procura nos caminhos padrão:

**macOS**
- `/Applications/Adobe Photoshop */Presets/Scripts`
- `/Applications/Adobe Illustrator */Presets/*/Scripts`
- `~/Library/Preferences/Adobe InDesign/Version */*/Scripts/Scripts Panel`
- `/Applications/Adobe After Effects */Scripts/ScriptUI Panels`

**Windows**
- `C:\Program Files\Adobe\Adobe Photoshop *\Presets\Scripts`
- `C:\Program Files\Adobe\Adobe Illustrator *\Presets\*\Scripts`
- `%APPDATA%\Adobe\InDesign\Version *\*\Scripts\Scripts Panel`
- `C:\Program Files\Adobe\Adobe After Effects *\Support Files\Scripts\ScriptUI Panels`

Instalação em local não padrão: copie um lançador gerado ou crie o arquivo à mão com uma linha:

```jsx
#include "/caminho/para/designprod/apps/photoshop/scripts/exportar-camadas.jsx"
```

### Erro de permissão no macOS

A pasta do Photoshop e do After Effects fica dentro de `/Applications` e costuma exigir administrador:

```bash
sudo npm run install:dev
```

### Sem instalar nada

Arquivo › Scripts › Procurar (Photoshop/Illustrator) e aponte direto para o `.jsx` do repositório. Funciona, só não fica no menu.

## Opção 2 — Plugin UXP do Photoshop

```bash
npm run build:plugin
```

1. Instale o [UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/guides/devtool/) (gratuito, pela Creative Cloud).
2. **Add Plugin** › selecione `plugins/photoshop-uxp/manifest.json`.
3. **Load** — o painel aparece em Plugins › IBD Ferramentas.

Para distribuir depois como `.ccx` instalável, é preciso empacotar e assinar pelo UDT. Veja [guia-uxp.md](guia-uxp.md).

## Remover

```bash
npm run uninstall:dev
```

Remove só os lançadores gerados por este repositório — arquivos de terceiros na mesma pasta são preservados.
