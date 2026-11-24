# Backlog de desenvolvimento

Cada linha representa uma entrega verificável. Dep. indica a entrega de que o recurso depende. O identificador pode ser usado no título da issue, no PR e na ficha de homologação.

| ID e marco | Entrega e escopo mínimo | Dep. | Critério de aceite |
|---|---|---|---|
| N01 · Fundação | Contrato v1, perfis, amostras e registro de ferramentas | — | Validar plano de calendário e recusar dimensões inválidas ou versão incompatível antes da edição. |
| N02 · Localização | Endereços da OS em PWA, com cópia de cliente, pedido e pasta e abertura do site e versão imprimível | N01 | Para 0123-004567, copiar 0123 e 004567; usar 4567 no link e em Pedido 4567. Endereço manual salvo prevalece. |
| N03 · Localização | Utilitário Windows e comando Abrir OS da arte | N02 | Usar a raiz configurada, criar apenas subpastas ausentes, preservar arquivos antigos e informar unidade indisponível. |
| N04 · Papel | Escolher folha T4/T8 com miniaturas, orientação, corte e pinça por equipamento | N01 | Exibir área útil, peças por folha e sobra; reproduzir montagem aprovada em ambos os formatos. |
| N05 · Papel | Consumo de papel e corte da folha-mãe | N04 | Separar tiragem líquida, acerto, perdas e total. Mostrar fibra e cortes executáveis a partir de 660 × 960 ou 640 × 880 mm. |
| N06 · Bancada | Gabaritos e cotas de acabamento; primeiro perfil de calendário | N01 | Prova cotada e arte-final separadas, com 14 mm de reserva total no lado solicitado. |
| N07 · Bancada | Cadernos, lombada, Wire-o e modelos Preps | N04, N06 | Usar espessura medida; conferir páginas, brancos, orientação, anel e creep no boneco por tipo de dobra. |
| N08 · Bancada | Montagem, virada, posição X/Y e numeração NCR | N04 | Conferir pares frente/verso e sequência após corte, incluindo repetição do número nas vias. |
| N09 · Bancada | Lona, bolsas, ilhós e emendas | N06 | Desenho aberto cotado reproduz largura acabada e centros dos ilhós na peça medida. |
| N10 · Criação | Cartazista, auto layout e editor de ofertas por lote | N01 | Alterar um SKU e recompor cada formato; listar fonte ou imagem ausente e texto excedente. |
| N11 · Criação | Remendo de adesivo, contorno e saída de recorte | N06 | Gerar remendo 1:1 e mapa de aplicação. Verificar curvas abertas e contornos duplicados antes do PLT homologado. |
| N12 · Saída | Preflight por editor, exportação de prova, PDF de produção e resumo para cliente | N01, N06 | Identificar objeto e página de cada alerta e exportar a finalidade escolhida com OS, item e revisão. |
| N13 · Operação | Balcão e Tempo, Minha Fila e Ficha do Impressor | N02, N12 | Converter uma vez, ver a OS na fila, abrir a revisão liberada por QR e registrar recebimento. |
| N14 · Distribuição | Catálogo instalável e homologação dos adaptadores | N01; incremental com cada piloto | Expor artefato, versão, editor e evidência; instalar e repetir o teste em outra estação. |

## Primeira iteração pronta para desenvolvimento

**Objetivo demonstrável:** receber a OS no Android, copiar seu caminho no Windows e abrir o pedido no site sem cadastrar outro registro.

1. Levantar as funções de referência em `ibd-os-maneger/model.js`, registrar a revisão usada e definir casos de compatibilidade para os dois links e o caminho.
2. Criar o contrato e os casos de teste de OS válida, incompleta, pedido zero e endereço manual. Separar valor para cópia do ID numérico usado pelo painel da gráfica.
3. Implementar a tela de campo único e ações de cópia/abertura. Mostrar o destino antes de abrir e indicar falha de cópia com texto selecionável.
4. Integrar manifesto, escopo, cache e entrada do catálogo. Testar a PWA nas duas plataformas e desconectar a rede depois da primeira carga.
5. Validar usando a OS fictícia. No Windows, conferir o caminho previsto; no celular, conferir link e compartilhamento. Registrar o tempo do percurso.

## Sequência dos marcos

- **M1 — Encontrar o serviço:** N01, N02 e primeira publicação N14. Acrescentar N03 no Windows.
- **M2 — Preparar o calendário:** N04, N05, N06 e primeira exportação N12. Começar pelo CorelDRAW e repetir a amostra no Illustrator e TraceDraw.
- **M3 — Produzir campanhas e adesivos:** N10, N11 e ampliação de N12. Validar Photoshop e PhotoCraft no mesmo PSD; VectorCraft na saída de contorno.
- **M4 — Fechar a produção:** N07, N08, N09 e N13. Liberar cada combinação de perfil, software e máquina separadamente no catálogo.

**Fora do primeiro ciclo:** recálculo contínuo no editor, integração JDF direta e sincronização geral entre os seis programas. Retomar quando houver modelo homologado, versão de destino confirmada e ganho demonstrável sobre o fluxo por arquivo.
