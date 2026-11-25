'use strict';
/* @ibd-imposicao-grade */
const { BlendMode } = require('affinity:common');
const { SVG11 } = require('/colours.js');
const { AddChildNodesCommandBuilder, CompoundCommandBuilder, DocumentCommand } = require('/commands.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { Document } = require('/document.js');
const { FillDescriptor } = require('/fills.js');
const { Curve, CurveBuilder, PolyCurve, Rectangle, Transform } = require('/geometry.js');
const { LineStyle, LineStyleDescriptor, LineCap, LineJoin } = require('/linestyle.js');
const { ShapeNodeDefinition, PolyCurveNodeDefinition } = require('/nodes.js');
const { ShapeRectangle } = require('/shapes.js');
const { UnitType } = require('/units.js');

function main() {
    const doc = Document.current;
    const titulo = "Imposição de arte e corte";
    let criadas = 0;
    try {
        if (!doc || doc.isMultiPage) throw Error("Abra um documento de design com pranchetas.");
        const selecionados = doc.selection.nodes.toArray();
        if (selecionados.length !== 1 || !selecionados[0].isPolyCurveNode) {
            throw Error("Selecione um único objeto vetorial convertido em curvas.");
        }
        const original = selecionados[0], fonte = original.polyCurve;
        const ddl = Dialog.create(titulo), col = ddl.addColumn();
        const folha = col.addGroup("Prancheta e grade");
        const facaConfig = col.addGroup("Faca");
        const escala = doc.dpi / 25.4;
        const medida = (grupo, rotulo, valor, minimo, maximo) =>
            grupo.addUnitValueEditor(rotulo, UnitType.Pixel, UnitType.Millimetre, valor * escala, minimo * escala, maximo * escala).setPrecision(2);
        const largura = medida(folha, "Largura", 328, 1, 3000);
        const altura = medida(folha, "Altura", 478, 1, 3000);
        const margem = medida(folha, "Margem", 10, 0, 500);
        const intervalo = medida(folha, "Intervalo", 5, 0, 500);
        const quantidade = folha.addUnitValueEditor("Cópias (0 = automático)", UnitType.Number, UnitType.Number, 0, 0, 500).setPrecision(0);
        const cruzes = folha.addSwitch("Quatro cruzes de registro", true);
        const offset = medida(facaConfig, "Deslocamento (+ fora / − dentro)", 0, -100, 100);
        const retangular = facaConfig.addSwitch("Usar o retângulo da seleção", false);
        const r = ddl.runModal();
        if ((r?.value ?? r) !== DialogResult.Ok.value) return;
        const o = imposicaoOpcoes([largura.value/escala, altura.value/escala, margem.value/escala,
            intervalo.value/escala, Math.round(quantidade.value), offset.value/escala,
            Number(cruzes.value), Number(retangular.value)].map(v => v.toFixed(5)).join(";"));

        function caixa(b) { return [b.x, b.y, b.x+b.width, b.y+b.height].map(v=>v/escala); }
        const arte = caixa(original.getSpreadVisibleBox());
        let faca, poligono, curva;
        if (o.retangulo) {
            faca = imposicaoRetangulo(arte, o.offset);
            poligono = imposicaoVertices(faca);
        } else {
            const curvas = fonte.curves.toArray();
            if (curvas.length !== 1 || !curvas[0].isClosed) throw Error("Use uma curva simples fechada ou selecione a faca retangular.");
            curva = curvas[0].clone().transform(original.baseToSpreadTransform);
            faca = caixa(curva.boundingBox);
            if (o.offset) {
                const segmentos = curva.beziers.toArray();
                function distanciaLinha(p, a, b) {
                    const dx = b.x-a.x, dy = b.y-a.y;
                    const comprimento = Math.hypot(dx,dy);
                    if (!comprimento) return Infinity;
                    const t = ((p.x-a.x)*dx + (p.y-a.y)*dy) / (comprimento*comprimento);
                    if (t < -1e-8 || t > 1+1e-8) return Infinity;
                    return Math.abs((p.x-a.x)*dy - (p.y-a.y)*dx)/comprimento;
                }
                const p = segmentos.map(s=>{
                    if (distanciaLinha(s.c1,s.start,s.end)+distanciaLinha(s.c2,s.start,s.end) > escala*1e-6) {
                        throw Error("Use um polígono convexo de lados retos ou deslocamento zero para manter a curva original.");
                    }
                    return [s.start.x/escala, s.start.y/escala];
                });
                poligono = imposicaoPoligono(p, o.offset);
                faca = imposicaoCaixa(poligono);
            }
        }
        const grade = imposicaoGrade(o, arte, faca);
        const pranchetasOriginais = doc.artboards;
        if (!pranchetasOriginais.length) {
            throw Error("Crie uma prancheta para a arte original e execute o script novamente.");
        }
        const x = Math.max(arte[2]*escala, ...pranchetasOriginais.map(b=>b.spreadBaseBox.x+b.spreadBaseBox.width)) + 15*escala;
        const y = Math.min(arte[1]*escala, ...pranchetasOriginais.map(b=>b.spreadBaseBox.y));
        const ladoFaca = x + (o.largura+15)*escala;
        const montar = CompoundCommandBuilder.create();
        for (const [lado,nome] of [[x,"ARTE"],[ladoFaca,"FACA"]]) {
            const def = ShapeNodeDefinition.createDefault();
            def.shape = ShapeRectangle.create();
            def.setBoundingRectangle(new Rectangle(lado,y,o.largura*escala,o.altura*escala));
            def.userDescription = nome + " · Imposição";
            montar.addCommand(DocumentCommand.createAddArtboard(def));
        }
        doc.executeCommand(montar.createCommand());
        criadas++;
        const folhas = doc.artboards.filter(b => !pranchetasOriginais.some(a=>b.isSameObject(a)));
        if (folhas.length !== 2) throw Error("O Affinity não criou as duas pranchetas.");
        folhas.sort((a,b)=>a.spreadBaseBox.x-b.spreadBaseBox.x);
        const montarArte = AddChildNodesCommandBuilder.create(), montarFaca = AddChildNodesCommandBuilder.create();
        montarArte.setInsertionTarget(folhas[0].node);
        montarFaca.setInsertionTarget(folhas[1].node);
        const sem = FillDescriptor.createNone();
        const preto = FillDescriptor.createSolid(SVG11.black, BlendMode.Normal);
        const vermelho = FillDescriptor.createSolid(SVG11.red, BlendMode.Normal);
        const estiloLinha = LineStyle.createDefaultWithWeight(0.25 * doc.dpi/72);
        estiloLinha.join = LineJoin.Round;
        estiloLinha.cap = LineCap.Butt;
        const traco = LineStyleDescriptor.create(estiloLinha);
        function tecnica(builder, curvas, cor, desc) {
            const def = PolyCurveNodeDefinition.create(curvas, sem, cor, traco, sem);
            def.userDescription = desc;
            builder.addNode(def);
        }
        function caminho(pontos, dx, dy, fechado) {
            const [a,...resto] = pontos;
            const r = CurveBuilder.create().beginXY((a[0]+dx)*escala, (a[1]+dy)*escala);
            for (const p of resto) r.lineToXY((p[0]+dx)*escala, (p[1]+dy)*escala);
            if (fechado) r.close();
            return r.createCurve();
        }
        const caixas = folhas.map(f => f.spreadBaseBox);
        const paraPrancheta = folhas.map(f => f.node.spreadToBaseTransform);
        for (const [tx,ty] of grade.posicoes) {
            const item = PolyCurveNodeDefinition.create(fonte.clone(), original.brushFillDescriptor,
                original.penFillDescriptor, original.lineStyleDescriptor, original.transparencyFillDescriptor);
            item.transform = paraPrancheta[0].multiply(Transform.createTranslate(caixas[0].x+tx*escala,caixas[0].y+ty*escala)).multiply(original.baseToSpreadTransform);
            item.userDescription = "Arte";
            montarArte.addNode(item);
            const p = PolyCurve.create();
            const real = poligono ? caminho(poligono,tx,ty,true) : curva.clone().translate(tx*escala,ty*escala);
            p.addCurve(real.translate(caixas[1].x,caixas[1].y).transform(paraPrancheta[1]));
            tecnica(montarFaca,p,vermelho,"Faca");
        }
        if (grade.marcas.length) {
            for (const [i,builder] of [montarArte,montarFaca].entries()) {
                const {x,y} = caixas[i];
                const p = PolyCurve.create();
                for (const [a,b,c,d] of grade.marcas) {
                    p.addCurve(Curve.createLineXY(x+a*escala,y+b*escala,x+c*escala,y+d*escala).transform(paraPrancheta[i]));
                }
                tecnica(builder,p,preto,"Cruzes de registro");
            }
        }
        doc.executeCommand(CompoundCommandBuilder.create()
            .addCommand(montarArte.createCommand(false))
            .addCommand(montarFaca.createCommand(false)).createCommand());
        criadas++;
        alert(imposicaoResumo(grade));
    } catch (e) {
        while (criadas > 0) { doc.undo(); criadas--; }
        alert(titulo + "\n" + e.message);
    }
}
module.exports.main = main;
