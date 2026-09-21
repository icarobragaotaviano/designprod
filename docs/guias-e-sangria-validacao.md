# Validação do kit — v1.0

Data: 21/09/2026.

**28 de 28 verificações locais passaram.** Os cálculos foram executados em JavaScript. As chamadas aos aplicativos foram simuladas com contratos de objetos; Photoshop e Illustrator não foram executados neste ambiente.

Esses testes verificam a lógica e a recuperação prevista para erros. Não validam renderização de ScriptUI, particularidades de versões Adobe, desempenho em arquivos grandes nem o comportamento real de histórico e guias no aplicativo.

## Como reproduzir

```bash
npm run test:guias
```

A suíte lê os scripts em `apps/photoshop/scripts/` e `apps/illustrator/scripts/`. `npm test` executa também a validação estrutural já existente no repositório.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Margem externa: oito posições nos quatro limites e a 10 px deles | Passou |
| Margem interna e ambas: orientação, simetria e 12 posições | Passou |
| Margem zero: somente quatro posições | Passou |
| Margem interna não colapsa nem inverte a área | Passou |
| Entradas inválidas são recusadas; vírgula decimal é aceita | Passou |
| Conversões físicas usam a resolução correta | Passou |
| Sangria 3 mm a 300 ppi: 36 px por lado e corte sem redimensionar | Passou |
| Sangria física nunca fica abaixo do pedido (diferentes resoluções) | Passou |
| Sangria rejeita valor zero e negativo | Passou |
| PS: coordenadas da imagem, preferências e seleção preservadas | Passou |
| PS: posições existentes são reutilizadas sem apagar guias | Passou |
| PS: cancelamento e margem inválida não criam guias | Passou |
| PS: falta de seleção informa o usuário e restaura preferências | Passou |
| PS: falha parcial ao criar guias reverte a operação inteira | Passou |
| PS: sangria em cópia mantém original; centro, guias e resolução corretos | Passou |
| PS: sangria de 20 px no documento atual acrescenta 40 px à tela | Passou |
| PS: falha de sangria no original reverte tela, conteúdo e guias | Passou |
| PS: falha na cópia remove apenas a cópia temporária | Passou |
| PS: documentos com pranchetas são recusados antes de alterar a tela | Passou |
| AI: guias externas corretas com eixo Y para cima e camada separada | Passou |
| AI: opção de traços usa limites visíveis ou geométricos | Passou |
| AI: grupo recortado usa máscara e ignora arte que ultrapassa o recorte | Passou |
| AI: união de múltiplos objetos e grupos ignora guias selecionadas | Passou |
| AI: cancelamento preserva a camada e o sistema de coordenadas | Passou |
| AI: erro parcial remove a camada de guias incompleta | Passou |
| Sintaxe JavaScript do arquivo completo: guias-selecao-margem.jsx | Passou |
| Sintaxe JavaScript do arquivo completo: sangria-guias-canvas.jsx | Passou |
| Sintaxe JavaScript do arquivo completo: guias-selecao-margem.jsx | Passou |

## Conferência dentro dos aplicativos

Faça a conferência em um documento de teste antes de incorporar o kit à produção.

| Caso | Entrada | Resultado esperado |
|---|---|---|
| Photoshop: seleção | Seleção de X=100 a 500 e Y=100 a 300; margem externa de 10 px. | Guias verticais: 90, 100, 500, 510. Horizontais: 90, 100, 300, 310. |
| Photoshop: sangria | Tela 1000 × 600 px; 300 ppi; sangria 3 mm; criar em cópia. | Original intacto. Cópia 1072 × 672 px a 300 ppi. Corte: X=36/1036 e Y=36/636. Borda: X=0/1072 e Y=0/672. |
| Photoshop: recuperação | Desfazer no Histórico após aplicar no documento atual. | Retorno ao tamanho e às guias anteriores. |
| Illustrator: margem física | Retângulo de 100 × 60 mm; margem de 5 mm. | Distância de 5 mm em cada lado; limites externos de 110 × 70 mm. Guias em camada separada bloqueada. |
| Illustrator: recorte | Imagem maior que uma máscara retangular, com o grupo selecionado. | Guias nos limites da máscara, e não nos limites da imagem escondida. |

As guias do Photoshop podem ficar ocultas pelas opções de exibição. As do Illustrator também dependem da visibilidade de guias. Cores e espessuras seguem as preferências do aplicativo.

## Limites deliberados da versão

- Margem uniforme nos quatro lados; sem medidas independentes por lado.
- Seleções são tratadas como um único retângulo envolvente.
- Sangria do Photoshop para tela única; documentos com pranchetas são recusados.
- O script de sangria não prolonga o conteúdo, não salva automaticamente e não cria um PDF de impressão.
- No Illustrator, o retângulo da máscara de recorte é a referência; máscaras de opacidade e efeitos complexos não têm tratamento próprio.
- Nenhuma versão específica de Photoshop ou Illustrator foi homologada nesta entrega.
