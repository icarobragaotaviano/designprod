# Avisos de terceiros

Código de outros autores usado neste repositório, com a licença de cada um. O [LICENSE](LICENSE) da raiz cobre o que é do IBD; os avisos abaixo cobrem o que veio de fora e precisam acompanhar as cópias.

## Size Marks — Roman Shamin

| | |
|---|---|
| Origem | [romashamin/Size-Marks-PS](https://github.com/romashamin/Size-Marks-PS), versão 1.3, commit `2cba97d2abf35b2080855c5cbf59fab6e8961b46` |
| Licença | MIT (texto integral abaixo) |
| Usado em | `apps/photoshop/scripts/marcas-medida.jsx`, `apps/photoshop/scripts/marcas-medida-opcoes.jsx`, `core/extendscript/ibd-medida.jsx`, `core/extendscript/ibd-ps-medida.jsx` |
| O que foi aproveitado | A ideia e o fluxo: seleção retangular vira cota com rótulo; seleção paisagem mede a largura, retrato ou quadrada mede a altura; espaço fino entre número e unidade; cor da frente como cor da marca. |
| O que mudou | O código foi reescrito. Lista das mudanças em [docs/marcas-medida.md](docs/marcas-medida.md#o-que-mudou-em-relação-ao-size-marks). |
| Relação com o autor | Nenhuma. O IBD não contribui com o projeto original, e esta versão não é afiliada ao autor nem endossada por ele. |

O cabeçalho do código-fonte original acrescenta: *"All rights not explicitly granted in the MIT license are reserved."* A licença MIT concede o uso, a cópia, a modificação e a distribuição que este repositório faz, sob a condição de manter o aviso abaixo. Por isso ele está na íntegra no cabeçalho de cada um dos quatro arquivos acima — os dois scripts são os distribuídos pela vitrine, e os dois do `core/` também são servidos avulsos por ela — e aqui.

```text
The MIT License (MIT)

Copyright 2014 Roman Shamin https://github.com/romashamin

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Como registrar código de terceiros

1. Confirme que a licença permite o uso (MIT, BSD, Apache 2.0 e ISC permitem; sem licença, **não** permite).
2. Dê à ferramenta um nome próprio — o do original fica só no crédito.
3. Ponha o aviso completo do original no cabeçalho de cada arquivo com código derivado — no script, depois dos metadados `@ibd-*`. Cada arquivo pode ser copiado ou baixado sozinho.
4. Acrescente uma seção neste arquivo, com a origem fixada por commit.
5. Cubra o aviso com um teste, como o de `tools/test-medida.cjs`, para ele não sumir numa edição futura.
