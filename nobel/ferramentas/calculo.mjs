import '../origens/folha/engine.js';

const { compute, suggestImpositions, computeGrommets, pressGuides, PAPER_PRESETS, FOLD_PATTERNS, PROCESS_PROFILES } = globalThis.Folha;
export { PAPER_PRESETS, FOLD_PATTERNS, PROCESS_PROFILES, computeGrommets };
export const nomeFormato = nome => nome.replace(/^Padrão Nobel\s*/i, '');

export function escolherFolhas(valores) {
    const { customW, customH, ...s } = valores;
    if (Boolean(customW) !== Boolean(customH)) throw Error('Informe a largura e a altura da folha adicional.');
    const customPapers = customW ? [{ id:'personalizada', label:'Folha adicional', sw:customW, sh:customH }] : [];
    return suggestImpositions({ ...s, customPapers, marks:false });
}

export function montarFolha(valores) {
    const s = { ...valores, mode:'flat' };
    const r = compute(s);
    const mesmaForma = s.style === 'turn' || s.style === 'tumble';
    const faces = [{ titulo:mesmaForma?'Forma única':'Frente', marcas:pressGuides(s,false), items:r.items }];
    if (s.style === 'sheetwise' || s.style === 'perfector') {
        const horizontal = s.style === 'sheetwise';
        faces.push({ titulo:'Verso', marcas:pressGuides(s,true), items:r.items.map(p=>({
            ...p, label:'V', x:horizontal ? s.sw-p.x-p.w : p.x, y:horizontal ? p.y : s.sh-p.y-p.h,
            angle:horizontal ? p.angle : (p.angle+180)%360
        })) });
    }
    return { ...r, faces, mesmaForma };
}

export function planejarCadernos(valores) {
    const s = { ...valores, mode:'book' };
    const r = compute(s);
    const porCaderno = (FOLD_PATTERNS[s.foldPattern] || FOLD_PATTERNS['F4-1']).pages;
    return { ...r, porCaderno, brancas:Math.max(0, r.plan.length*porCaderno-s.pages) };
}

