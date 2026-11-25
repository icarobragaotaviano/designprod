import { familiaImposicao } from '../nobel/imposicao/versoes.mjs';
import { familiaRemendo } from '../nobel/remendo/versoes.mjs';

const desktop = nome => 'desktop/' + nome;
const familias = [
    familiaRemendo,
    familiaImposicao,
    ['web/preto-tac','web/preflight',desktop('auditar-arte-corel.bas'),desktop('auditar-arte-illustrator.jsx')],
    ['web/fechamento','photoshop/actions/salvar-pdf-x1a',desktop('fechar-pdf-corel.bas'),desktop('fechar-pdf-illustrator.jsx')],
    ['web/gabarito','web/dobras','illustrator/guias-selecao-margem',desktop('abrir-gabarito-illustrator.jsx'),desktop('trace-calendario.js')],
    ['web/ficha-os','web/enderecos',desktop('preparar-pasta.ps1'),desktop('pastas-passaporte.ps1'),desktop('pastas-passaporte.bat'),desktop('abrir-os-corel.bas')],
    [desktop('conferir-corte-illustrator.jsx'),desktop('conferir-faca-vectorcraft.js')],
    ['web/lote-imagens','photoshop/redimensionar-lote','photoshop/actions/150-dpi'],
    ['web/ofertas','photoshop/gerar-ofertas-preto-dourado','photoshop/criar-textos-precos','photoshop/editar-textos-precos-rapido'],
    ['photoshop/actions/sangria-canvas','photoshop/sangria-guias-canvas'],
    ['illustrator/margem-seguranca-guias','coreldraw/margem-seguranca-guias','affinity/margem-seguranca-guias','tracedraw/margem-seguranca-guias'],
    ['illustrator/texto-dimensoes-objeto','coreldraw/texto-dimensoes-objeto','affinity/texto-dimensoes-objeto','tracedraw/texto-dimensoes-objeto'],
    ['illustrator/deslocamento-expandir-contorno','coreldraw/deslocamento-expandir-contorno','affinity/deslocamento-expandir-contorno','tracedraw/deslocamento-expandir-contorno']
];

export function reunirVersoes(ferramentas) {
    const indice = new Map(ferramentas.map(f=>[f.id,f]));
    for (const ids of familias) {
        const grupo = ids.map(id=>{
            const f = indice.get(id);
            if (!f) throw Error('Ferramenta da família ausente: '+id);
            return f;
        });
        for (const f of grupo) {
            f.versoes = grupo.filter(item=>item!==f).map(({app,titulo,abrir,baixar,baixarNome})=>({app,titulo,abrir,baixar,baixarNome}));
        }
    }
}
