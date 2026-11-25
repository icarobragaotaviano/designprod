# Design das interfaces do Folha

As interfaces seguem a [identidade visual do DesignProd](../../DESIGN.md). Usar os tokens de superfície, texto, foco e validação já presentes na Bancada e nos painéis. Reservar o amarelo IBD para a ação primária da área em uso.

## Bancada Nobel

O catálogo dá acesso direto a Escolher folha, Montagem e virada, Montagem rápida, Comparar folhas, Cadernos e lombada e Lona e ilhós. Cada ferramenta abre em rota própria e usa os componentes e diagramas nativos da Bancada. Nas telas largas, os parâmetros e a prévia podem ficar lado a lado. Nas telas estreitas, ficam em uma coluna na ordem de uso.

Usar rótulos em português com a unidade ao lado de cada medida. Depois do cálculo, mostrar os indicadores da modalidade junto da ação de aplicar ou exportar. Todas as faces de uma montagem usam a mesma escala. Na comparação de formatos, manter a proporção seja lado a lado ou em sobreposição. O zoom deve mover o diagrama dentro de sua área e manter os controles acessíveis.

Em Montagem e virada, a seleção destaca a peça na prévia. As edições de posição, rotação e SKU revalidam a montagem. Colisões e dimensões inválidas aparecem no resultado e impedem a exportação de um plano de montagem para aplicação. Ao abrir uma sugestão na montagem, transferir folha, peça, margem, calhas, sangria e orientação efetivas.

## Painéis Adobe

Em painéis estreitos, manter controles em uma coluna, com prévia e ações depois dos parâmetros. Indicar operação, medidas, rendimento e avisos quando aplicáveis. Os nomes dos comandos distinguem calcular, baixar um plano e criar objetos no editor. Antes de aplicar geometria, apresentar a operação e os avisos relevantes. Os diagnósticos precisam ter texto acessível com ou sem a prévia ou sua legenda.
