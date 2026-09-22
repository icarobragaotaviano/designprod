# Actions do Photoshop — IBD Produção

As **actions do Photoshop (`.atn`)** aceleram rotinas mecânicas e frequentes de arte-final, manipulação de arquivos vinculados e fechamento de impressos e mídias digitais do estúdio **IBD**.

Elas são versionadas em `apps/photoshop/actions/`, catalogadas automaticamente em `catalog.json`, integradas ao painel UXP da marca e disponibilizadas para download direto na vitrine web e em kit compactado.

---

## Como instalar

### Opção 1: Pacote Consolidado (Recomendado)
Para carregar todas as 9 rotinas de uma só vez:
1. Localize o arquivo `apps/photoshop/actions/ibd-producao.atn` (ou baixe pelo site).
2. Dê um **duplo clique** sobre o arquivo ou **arraste-o** para dentro da janela do Photoshop aberto.
3. Todas as rotinas aparecerão agrupadas na pasta de ações **IBD Produção**.

### Opção 2: Pelo menu do painel Ações
1. No Photoshop, abra a janela de Ações: **Janela > Ações** (atalho `Alt + F9` no Windows ou `Option + F9` no Mac).
2. Clique no menu hambúrguer no canto superior direito do painel de Ações.
3. Escolha **Carregar ações...** (*Load Actions*).
4. Selecione o arquivo `.atn` desejado (o pacote consolidado ou uma ação avulsa).

### Opção 3: Instalação Automática via repositório
Execute no terminal do projeto:
```bash
npm run install:dev
```
O instalador detecta a versão do Photoshop instalada e copia as actions diretamente para a pasta de Presets do sistema:
- **macOS:** `/Applications/Adobe Photoshop [versão]/Presets/Actions/`
- **Windows:** `C:\Program Files\Adobe\Adobe Photoshop [versão]\Presets\Actions\`

Após reiniciar o Photoshop, as actions ficam acessíveis permanentemente na lista suspensa do menu do painel Ações.

---

## Dica de Produção: Modo de Botão (*Button Mode*)

Para máxima agilidade na rotina de fechamento:
1. No menu do painel Ações, clique em **Modo de Botão** (*Button Mode*).
2. O painel se transforma em uma grade de botões coloridos.
3. Cada ação roda com **um único clique**, sem precisar expandir pastas ou selecionar o comando de execução.

---

## Catálogo de Ferramentas

| Ferramenta | Arquivo | O que faz | Contexto de uso |
|---|---|---|---|
| **Kit de Produção** | `ibd-producao.atn` | Pacote consolidado com todas as 9 rotinas de produção | Instalação completa com 1 clique |
| **150 DPI — Ajustar resolução** | `150-dpi.atn` | Converte resolução para 150 DPI mantendo medidas e interpolação | Banners, gigantografias, mídias digitais |
| **Atualizar vínculos** | `atualizar-vinculos.atn` | Atualiza Smart Objects vinculados modificados no disco e salva | Atualização de preços e ofertas em lote |
| **Sangria rápida por tela** | `sangria-canvas.atn` | Expande o canvas de pintura com a cor de fundo | Criação instantânea de margem de corte |
| **Placeholder de produto** | `place-holder.atn` | Insere shape e texto "IMAGEM" padronizado | Diagramação de tablóides e anúncios |
| **Revincular objeto inteligente** | `revincular.atn` | Aciona troca e revinculação rápida do arquivo de origem | Substituição rápida de embalagens e produtos |
| **Exportar JPEG para impressão** | `exportar-jpeg-impressao.atn` | Salva JPEG em alta qualidade sem compressão destrutiva | Conferência de layout e provas visuais |
| **Exportar PNG transparente** | `exportar-png.atn` | Salva PNG otimizado preservando transparência de recorte | Produtos recortados e elementos web |
| **Salvar PDF/X-1a (Gráfica)** | `salvar-pdf-x1a.atn` | Gera PDF normatizado PDF/X-1a em CMYK de trabalho | Fechamento comercial para offset/gráfica |
| **Salvar PDF para aprovação** | `salvar-pdf-leitura.atn` | Gera PDF compacto em baixa para visualização em tela | Envio rápido por WhatsApp e e-mail |

---

## Detalhamento das Rotinas

### 1. `150-dpi.atn` — Ajustar resolução
- **Comando interno:** `imageSize` (`Tamanho da Imagem`).
- **Parâmetros:** Resolução fixada em `150 pixels/polegada`, `scaleStyles: true`, `constrainProportions: true`, `interpolation: automatic`.
- **Finalidade:** Reduz o peso de imagens pesadas (por exemplo de 300 ou 600 DPI) para 150 DPI, ideal para materiais promocionais de grande porte ou outdoors onde 150 DPI é a especificação técnica ideal.

### 2. `atualizar-vinculos.atn` — Atualizar vínculos modificados
- **Comando interno:** `placedLayerUpdateAllModified` (`Atualizar todo o conteúdo modificado`) seguido de `save` (`Salvar`).
- **Finalidade:** Em fluxos com dezenas de Smart Objects vinculados (como ofertas de supermercado ou fotos de produtos), sincroniza todas as alterações salvas nos arquivos externos de uma só vez e grava o PSD.

### 3. `sangria-canvas.atn` — Sangria rápida por tela
- **Comando interno:** `canvasSize` (`Tamanho da Tela de Pintura`).
- **Parâmetros:** Expansão relativa das dimensões da tela com a cor de fundo (`BackC`).
- **Complemento:** Para controle milimétrico e desenho de guias de corte na mesma operação, veja também o script [`photoshop/sangria-guias-canvas`](guias-e-sangria.md).

### 4. `place-holder.atn` — Placeholder de produto
- **Comando interno:** Criação de camada de preenchimento sólida (`solidColorLayer`), demarcador elíptico e camada de texto formatada ("IMAGEM" em SF Pro Condensed Semibold) com dimensões pré-ajustadas.
- **Finalidade:** Estabelecer uma área visual reservada temporária durante o rascunho de encartes promocionais antes da chegada das imagens finais.

### 5. `revincular.atn` — Revincular objeto inteligente
- **Comando interno:** `placedLayerRelinkToFile` (`Revincular no arquivo`) e `save`.
- **Finalidade:** Abre a caixa de diálogo para apontar o Smart Object selecionado para um novo arquivo no disco e salva o documento atualizado.

### 6. `exportar-jpeg-impressao.atn` — Exportar JPEG para impressão
- **Comando interno:** `save As JPEG` com qualidade máxima (`EQlt: 12`) e perfil de cor embutido.
- **Finalidade:** Gerar arquivo JPEG plano para envio à gráfica rápida ou conferência em birôs.

### 7. `exportar-png.atn` — Exportar PNG transparente
- **Comando interno:** `save As PNG` (método rápido, sem perdas, PNG-24).
- **Finalidade:** Exportação de produtos e composições recortadas com transparência pronta para uso em e-commerce, redes sociais ou diagramação.

### 8. `salvar-pdf-x1a.atn` — Salvar PDF/X-1a (Gráfica)
- **Comando interno:** `save As Photoshop PDF` utilizando o preset de exportação `PDF/X-1a:2001` com conversão de cor para o espaço CMYK de trabalho (`workingCMYK`).
- **Finalidade:** Arquivo final certificado para envio a birôs de impressão e gráficas comerciais sem risco de incompatibilidade de fontes ou transparências não achatadas.

### 9. `salvar-pdf-leitura.atn` — Salvar PDF para aprovação / leitura
- **Comando interno:** `save As Photoshop PDF` com preset `PDF EM BAIXA COM QUALIDADE DE LEITURA`.
- **Finalidade:** Gera um PDF ultraleve mantendo textos nítidos para visualização rápida no celular do cliente antes da impressão.

---

## Observações Técnicas Importantes

> [!NOTE]
> **Caminhos de pastas gravados:**
> Actions do Photoshop que utilizam o comando "Salvar Como" salvam internamente o caminho da pasta onde foram gravadas pela primeira vez.
> Quando executadas em outra máquina ou em outro projeto onde a pasta gravada não existe, o Photoshop simplesmente **exibe a caixa de diálogo "Salvar Como"** na pasta atual para que você confirme ou escolha o destino.

> [!TIP]
> **Quando usar Action vs quando usar Script ExtendScript (.jsx):**
> - **Use Actions (`.atn`):** Quando você quer disparar um comando direto nativo do Photoshop com tecla de atalho ou pelo modo de botões sem nenhuma tela de confirmação (ex: redefinir DPI, exportar formato fixo, atualizar vínculos).
> - **Use Scripts (`.jsx`):** Quando o processo exige lógica condicional, cálculo de medidas em milímetros independente da resolução, interfaces personalizadas de diálogo ou processamento em lote de múltiplos arquivos (ex: `sangria-guias-canvas.jsx`, `exportar-camadas.jsx`, `auto-layout.jsx`).

---

## Download do Kit

O kit completo de actions pode ser baixado em [downloads/kit-actions-photoshop-v1.0.zip](../downloads/kit-actions-photoshop-v1.0.zip), contendo o pacote `ibd-producao.atn`, a pasta com todas as actions individuais e o arquivo de instruções de instalação.
