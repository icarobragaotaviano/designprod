import '../../core/producao/folha/engine.js';
import '../../core/producao/folha/operacoes.js';

const { PAPER_PRESETS, FOLD_PATTERNS, PROCESS_PROFILES } = globalThis.Folha;
const { executar } = globalThis.FolhaOperacoes;
export { PAPER_PRESETS, FOLD_PATTERNS, PROCESS_PROFILES };
export const nomeFormato = nome => nome.replace(/^Padrão Nobel\s*/i, '');
export const planoFolha = (operacao,parametros) => executar({versaoContrato:1,operacao,parametros});

export function escolherFolhas(valores) {
    const { customW, customH, ...s } = valores;
    if (Boolean(customW) !== Boolean(customH)) throw Error('Informe a largura e a altura da folha adicional.');
    const customPapers = customW ? [{ id:'personalizada', label:'Folha adicional', sw:customW, sh:customH }] : [];
    const plano=planoFolha('sugerir-folhas',{ ...s, customPapers, marks:false });
    return plano.resultado.suggestInfo ?? plano.resultado;
}

export function montarFolha(valores) {
    const plano = planoFolha('montar-pecas',valores);
    const titulos = {'frente':'Frente','verso':'Verso','forma-unica':'Forma única'};
    const faces = plano.faces.map(f=>({titulo:titulos[f.id],marcas:f.guias,items:f.items}));
    return { ...plano.resultado,faces,mesmaForma:plano.faces[0]?.id==='forma-unica',plano };
}

export function planejarCadernos(valores) {
    const s = { ...valores, mode:'book' };
    const plano = planoFolha('planejar-cadernos',s);
    const r = plano.resultado;
    const porCaderno = (FOLD_PATTERNS[s.foldPattern] || FOLD_PATTERNS['F4-1']).pages;
    return { ...r, porCaderno, brancas:Math.max(0, r.plan.length*porCaderno-s.pages), plano };
}

