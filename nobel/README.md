# Catálogo DesignProd

Acesse **Catálogo DesignProd** na vitrine do DesignProd na página inicial. Cada cartão tem URL, manifesto e cache próprios. No navegador compatível, use **Instalar app** ou a opção de instalação do navegador. Abra a ferramenta uma vez com conexão antes do uso offline. Dados de trabalho locais pertencem à origem e ao navegador. Use o backup do gerenciador antes de migrar de aparelho.

## Desenvolvimento

Execute `npm test` e `npm run build:site` na raiz. Para gerar apenas a bancada, execute `node tools/build-nobel.mjs`. A saída é `site/publico/apps/`. Para testar localmente, sirva **site/publico** como raiz HTTP em localhost. O Vercel utiliza o build do repositório.

## Implementação

As ferramentas de balcão e fila usam o mesmo IndexedDB. O botão de ficha fica no detalhe do pedido. Endereços da OS procura as exceções de link e pasta nos pedidos locais, depois aplica as convenções da Nobel. Nos modos de nuvem, consulte a ficha do próprio gerenciador para os endereços personalizados. As funções em `api/` permitem configuração do backend original por ambiente. Supabase e Google exigem o projeto, permissões e origens autorizadas da instalação. A operação básica pode ser local.

Os aplicativos de folha iniciam diretamente no modo indicado no cartão. O corte da folha-mãe compara grades retas em duas orientações. O cartazista exporta SVG com texto editável. O remendo é destinado a imagens raster e informa a medida física de aplicação junto ao PNG. A conferência de resolução mede os eixos X e Y de uma imagem aplicada; a conferência de separações e PDF/X continua no fluxo de pré-impressão.

## Integrações para desktop

- Windows: rode `preparar-pasta.ps1` e informe a OS. A opção `-Raiz` aceita outro mapeamento ou UNC; `-Abrir` abre o destino.
- CorelDRAW Windows: importe o módulo BAS em um projeto VBA e associe o comando à barra. Ele abre a pasta da OS identificada no nome da arte.
- Illustrator: execute o JSX pelo menu de scripts e selecione o SVG técnico.
- TraceDraw: instale o plugin JS pelo menu de plugins. Use documento em mm e uma camada técnica separada.
- VectorCraft: baixe **Conferir contornos de faca** e execute pelo menu de scripts com o documento aberto. Nomeie as camadas de corte FACA ou MEIO-CORTE. O relatório localiza traçados abertos e curvas exatamente duplicadas pela posição dos nós e das alças, inclusive em ordem inversa. A lista completa aparece no console. Sobreposições parciais e curvas aproximadas exigem conferência visual. Para intercâmbio, importe o SVG do gabarito ou do cartaz. Meça o formato e a reserva antes de usar o arquivo na produção.
- PhotoCraft: execute o utilitário de inspeção com `-Pasta` e, se necessário, `-Cli` apontando para o executável instalado.
- Photoshop: a vitrine principal mantém os JSX, ações e painel para preços, guias, sangria, remendos e exportação.

As integrações nativas exigem conferência na versão de software e no equipamento usados pela gráfica. Os gabaritos exportados contêm a prova técnica.

## Procedência do código incorporado

Os diretórios em `origens/` são cópias dos projetos da mesma conta GitHub. Ficam versionados para que o build e o modo offline independam de downloads de código. O build acrescenta a navegação, o manifesto e o modo inicial a cada página gerada.

- [Folha · 50ead7c](https://github.com/icarobragaotaviano/ibd-folha/tree/50ead7c62dc7cc95995a6beb32918dfe4e8f46e7)
- [OS Maneger · 35e87ce](https://github.com/icarobragaotaviano/ibd-os-maneger/tree/35e87cea0019f2804b3f3d895404b8266ce50e7f)
- [Numera-bloco · d105e84](https://github.com/icarobragaotaviano/numera-bloco/tree/d105e8455dcc009172dcd3f76b5f2174570df802)

## Gabarito nativo de Wire-o

No app Gabarito de acabamento, informe as dimensões, a sangria, a reserva de furação e a borda. Os botões BAS e JSX baixam comandos com as medidas daquela revisão. No CorelDRAW Windows, importe o BAS no editor de VBA e execute a macro CriarGabarito identificada pelo sufixo. No Illustrator, escolha o JSX em Arquivo → Scripts → Outro script. O resultado é um documento novo no formato acabado, com sangria configurada e uma camada técnica bloqueada e não imprimível. Salve o mestre como CDR ou AI. A prova SVG cotada continua disponível separadamente.
