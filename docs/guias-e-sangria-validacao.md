# Validação — remendos, guias e sangria

21/09/2026 · Remendos de adesivos 1.1.0.

**40 de 40 verificações locais passaram.** Os cálculos foram executados em JavaScript. As chamadas aos aplicativos e o recorte de pixels foram simulados com contratos de objetos; Photoshop e Illustrator não foram executados neste ambiente.

Esses testes verificam a lógica e a recuperação prevista para erros. Não homologam a renderização de efeitos, fontes, objetos inteligentes, perfis ICC, transparência ou canais dentro do Photoshop. A imagem final ainda requer conferência visual no aplicativo.

## Como reproduzir

```bash
npm run catalog
npm test
```

`npm run test:guias` executa somente a suíte de 40 verificações. Ela lê os scripts reais de `apps/`, sem manter cópias de implementação nos testes. O CI executa `npm test` e confere se o catálogo gerado está sincronizado.

## O que foi verificado

| Área | Verificações |
|---|---|
| Geometria | Margens, unidades, medidas inválidas, retângulos e arredondamento. |
| Remendo: sequência | Criação de guias antes da seleção total; seleção antes da duplicata mesclada; mesclagem antes do recorte. |
| Remendo: conteúdo | Em uma matriz de pixels simulada, o resultado corresponde à região da composição incluindo margem e transparência; o original fica intacto. |
| Remendo: características | Resolução, modo de cor, bits, perfil, condição sem perfil, proporção de pixels e canais. |
| Remendo: divergência | Cópia recusada se atributos ou dimensões mudarem; original restaurado. |
| Remendo: falhas | Duplicação, recorte e guias locais podem falhar sem deixar alterações parciais previstas no original. |
| Remendo: limites | Margem zero, margem fora da arte, seleção fracionária, nome de documento repetido e pranchetas. |
| Sangria | Dimensões simétricas, cópia opcional, resolução e recuperação de falhas. |
| Illustrator | Eixo Y, traços, máscaras de recorte, conjuntos de objetos e camada de guias. |
| Sintaxe | Compilação dos três arquivos em JavaScript após remover `#target`; verificações básicas de sintaxe compatível com ES3. Não equivale a executar o interpretador ExtendScript. |

## Conferência do remendo no Photoshop

1. Use uma arte com várias camadas visíveis, uma camada oculta, texto, efeitos e um fundo reconhecível. Faça uma cópia de teste.
2. Em um documento de **1000 × 600 px a 300 ppi**, selecione **X=100 a 500; Y=100 a 300**.
3. Execute **Remendo de adesivo — seleção e margem**, com **10 px** por lado.
4. Confira o resultado abaixo.

| Item | Resultado esperado |
|---|---|
| Seleção no original | X=90 a 510; Y=90 a 310, substituindo a seleção anterior. |
| Guias verticais no original | X=90, 100, 500, 510. |
| Guias horizontais no original | Y=90, 100, 300, 310. |
| Novo documento | 420 × 220 px, 300 ppi, uma camada mesclada. |
| Guias verticais no remendo | X=0, 10, 410, 420. |
| Guias horizontais no remendo | Y=0, 10, 210, 220. |
| Características | Mesmo modo, bits, perfil, proporção de pixels e canais do original. |
| Imagem do original | Camadas, visibilidade e conteúdo conservados. |

Para conferir a imagem, compare o novo documento com o mesmo recorte de uma duplicata mesclada manualmente. Use o mesmo modo, profundidade e perfil; não converta cores ao comparar. Inclua uma região transparente quando houver, e repita em RGB e CMYK conforme o fluxo de produção. Perfis de prova e zoom devem ser equivalentes para uma comparação visual.

Com **3 mm a 300 ppi**, a mesma seleção deve produzir **472 × 272 px**: 36 px de margem por lado, equivalentes a 3,048 mm. Se a margem sair da tela, o botão de criação deve permanecer indisponível até ajustar o valor ou a seleção.

No original, desfazer a etapa no Histórico deve restaurar as guias e a seleção anteriores. O remendo criado permanece um documento separado, ainda não salvo.

## Outros scripts

| Caso | Resultado esperado |
|---|---|
| Sangria: tela 1000 × 600 px, 300 ppi, 3 mm | Cópia de 1072 × 672 px. Corte em X=36/1036 e Y=36/636. |
| Illustrator: retângulo 100 × 60 mm, margem externa 5 mm | Guias externas delimitam 110 × 70 mm; guias ficam em uma camada separada. |
| Illustrator: grupo com máscara de recorte | A referência é a máscara, não o conteúdo escondido. |

## Limites da versão

- Remendos e sangria do Photoshop trabalham com uma tela única, sem pranchetas.
- O remendo é retangular e usa a margem externa como sobreposição. O script de Illustrator continua oferecendo margens internas e externas.
- A composição é mesclada; o novo documento não conserva a editabilidade das camadas.
- O script não acrescenta pixels de imagem além da tela original e não salva automaticamente.
- Os ZIPs antigos são históricos; para criar documentos de remendo, use a versão 1.1 ou o script atual em `apps/photoshop/scripts/`.
- A validação dentro dos aplicativos Adobe continua pendente.
