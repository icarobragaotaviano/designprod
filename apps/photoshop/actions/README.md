# Actions do Photoshop

Arquivos `.atn` versionados aqui entram no catálogo automaticamente e aparecem no painel como item do tipo `action`.

## Exportar do Photoshop

Painel Actions › selecione o **conjunto** (a pasta, não a action solta) › menu do painel › **Salvar ações**. Salve como `nome-do-conjunto.atn` nesta pasta e rode `npm run catalog`.

## Instalar

Painel Actions › menu do painel › **Carregar ações** › selecione o `.atn`.

## Limites

`.atn` é binário: o Git versiona, mas não mostra diferença entre versões. Na prática:

- **Um conjunto por arquivo**, com nome descritivo.
- **Descreva a mudança na mensagem do commit** — é o único registro legível do que mudou.
- Se a lógica for complexa ou precisar de condicional, **prefira um script** em `../scripts/`: dá para ler, revisar e corrigir.
