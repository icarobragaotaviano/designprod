# Folha no DesignProd

A Bancada Nobel, os painéis Adobe e o comando de terminal usam o motor em `core/producao/folha/`. O ponto de partida foi a cópia já distribuída pelo DesignProd, de blob `5fd54fe928c9897275ee62c74a4bd42ce469f2db`, comparada com a `main` do [Folha em `50ead7c`](https://github.com/icarobragaotaviano/ibd-folha/commit/50ead7c62dc7cc95995a6beb32918dfe4e8f46e7). A cópia pública já preservava a busca de corte misto em folhas com mais de 700 posições. O contrato mantém o bloqueio de edição e informa a capacidade calculada nesses casos.

## Operações

| ID | Recursos | Mini app da Bancada |
|---|---|---|
| `montar-pecas` | Grade simples ou mista, viradas, sangria, fibra, CTP, tiragem, métricas, acabamentos e edições por SKU | Montagem e virada |
| `planejar-cadernos` | F4-1, F8-1, F16-1 e 2-up, ordem de páginas, brancos, creep e lombada | Cadernos e lombada |
| `planejar-lona` | Formato de corte, panos, emenda, bainha, bolsas e ilhós | Lona e ilhós |
| `avaliar-orientacoes` | Comparação de retrato, paisagem e corte misto, com seleção de estratégia | Montagem rápida |
| `comparar-folhas` | Até oito formatos em escala proporcional | Comparar folhas |
| `sugerir-folhas` | Ranking por tamanho da peça, família, margem, rendimento e folhas personalizadas | Escolher folha |

O painelamento de produção de **Lona e ilhós** usa o cálculo de panos já existente da Bancada, com as margens informadas. O formato de corte e os ilhós vêm do Folha. Ao comparar saídas, confira qual cálculo produziu o plano de panos.

## Contrato versão 1

Execute `node tools/folha.mjs < pedido.json` em um shell com redirecionamento de entrada. No PowerShell, use `Get-Content -Raw pedido.json | node tools/folha.mjs`.

```json
{
  "versaoContrato": 1,
  "operacao": "montar-pecas",
  "parametros": {"sw": 328, "sh": 478, "pw": 90, "ph": 50, "qty": 1000}
}
```

`parametros` recebe chaves do motor, com os valores omitidos preenchidos por seus padrões. A ordem usa coordenadas de folha em milímetros, com origem no canto superior esquerdo e Y crescente para baixo. As posições de montagem incluem ID, tamanho, ângulo, face e SKU. Para montagem de peças, `faces` devolve as posições por face ou forma única com suas guias. Em todas as operações, `resultado` preserva os campos do motor, `diagnosticos` descreve erros e avisos e `materializavel` indica se há geometria válida para o modo. O comando devolve código 1 quando houver erro de validação ou execução.

O plano exportado contém os parâmetros efetivos e a revisão do motor. O consumidor importa a operação e seus parâmetros e os recalcula antes de agir no editor. A revisão no arquivo identifica o motor que gerou a prova original. Para reproduzir a saída byte a byte, use a revisão original do motor.

## Adaptadores e conferência

- **Bancada Nobel.** Abra a ferramenta pelo catálogo. Em Escolher folha, aplique a sugestão em Montagem e virada. Use a exportação do plano na montagem para abrir a mesma geometria em um editor compatível.
- **Illustrator CEP.** Use Folha · Montagem de peças para calcular ou importar um plano. Depois de conferir a prévia, crie pranchetas com corte e sangria. A repetição da arte selecionada está disponível para frente simples, com conferência de tamanho antes de duplicar. O cálculo direto exige um runtime CEP que execute os módulos JavaScript atuais.
- **InDesign UXP.** Calcule ou importe a operação editorial. A prova cria um documento novo, com página por face e quadros técnicos rotulados por página, rotação e creep. A prova pode ser conferida sem alterar o documento ativo.
- **Photoshop UXP.** Calcule, confira e troque arquivos JSON de plano no painel. A aplicação em camadas é uma etapa posterior.

Instalação e uso dos painéis seguem os empacotadores existentes. As verificações automatizadas cobrem o contrato, a paridade com o cálculo direto, os fluxos da Bancada, os pacotes e as pontes com hosts simulados. Para liberar produção, conferir um caso real de cada painel na versão de editor utilizada e medir arte, pranchetas, registro e dobras. Os pontos pendentes de paridade visual incluem as marcas técnicas avançadas do SVG original, a migração entre origens de armazenamento do navegador e a homologação física.

Consulte também [design.md](design.md).
