# Gerador de textos e preços v1

[gerar-textos-precos-v1.jsx](gerar-textos-precos-v1.jsx) é a primeira versão criada para os dois modelos de texto. Contém os PSDs e as miniaturas incorporados e cria novos arquivos com valores DE/POR e unidades definidos na janela.

Foi substituído no fluxo principal após relato de execução muito lenta. Para editar um modelo aberto, use [editar-textos-precos-rapido.jsx](../../apps/photoshop/scripts/editar-textos-precos-rapido.jsx), com [instruções de uso](../../docs/textos-e-precos.md).

O arquivo histórico foi preservado integralmente. Ele fica fora de `apps/photoshop/scripts` para não entrar no catálogo nem aparecer como opção atual no painel. Seus 16 testes de lógica e de integridade dos PSDs continuam disponíveis em `npm run test:textos`.
