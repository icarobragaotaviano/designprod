/* @ibd-imposicao-grade */
(function () {
    const titulo = "Imposição de arte e corte";
    const info = vc.run("document.inspect", {depth: 0});
    if (!info.selection || info.selection.length !== 1) throw Error("Selecione um objeto ou grupo.");
    const id = info.selection[0], pt = imposicaoPt;
    const texto = prompt(imposicaoPergunta, imposicaoPadrao, titulo);
    if (texto === null) return;
    const o = imposicaoOpcoes(texto);
    function no(id) {
        const dados = vc.run("document.inspect", {ids: [id], depth: 0});
        if (!dados.nodes || dados.nodes.length !== 1) throw Error("A seleção não é um objeto editável.");
        return dados.nodes[0];
    }
    function caixa(b, extra) {
        if (!b) throw Error("A seleção não possui dimensões válidas.");
        return [(b.x-extra)/pt, (b.y-extra)/pt, (b.x+b.width+extra)/pt, (b.y+b.height+extra)/pt];
    }
    function subcaminho(id) {
        const resposta = vc.run("document.json", {});
        const doc = resposta.document || resposta;
        function achar(lista) {
            for (const n of lista) {
                if (n.id === id) return n;
                const achado = achar(n.kind.children || n.kind.members || []);
                if (achado) return achado;
            }
        }
        const n = achar(doc.layers);
        const subs = n && n.kind.path && n.kind.path.subpaths;
        if (!subs || subs.length !== 1 || !subs[0].closed || subs[0].anchors.length < 2 ||
            !subs[0].anchors.every(a => Array.isArray(a.p))) {
            throw Error("Use uma curva fechada simples, convertida em traçado, ou selecione a faca retangular.");
        }
        return subs[0].anchors;
    }

    const original = no(id), limitesArte = original.bounds;
    const arte = caixa(limitesArte, (original.strokeWidth || 0) / 2);
    let faca, pontos;
    if (o.retangulo) {
        faca = imposicaoRetangulo(arte, o.offset);
        pontos = imposicaoVertices(faca).map(([x,y]) => ({p: [x * pt, y * pt]}));
    } else {
        pontos = subcaminho(id);
        faca = caixa(limitesArte, 0);
        if (o.offset) {
            vc.run("select.set", {ids: [id]});
            const resultado = vc.run("object.path.offsetPath", {offset: o.offset * pt, joins: "round"});
            if (resultado.ids.length !== 1) throw Error("O deslocamento precisa produzir uma única faca.");
            const temporario = resultado.ids[0];
            pontos = subcaminho(temporario);
            faca = caixa(no(temporario).bounds, 0);
            vc.run("select.set", {ids: [temporario]});
            vc.run("edit.clear", {});
        }
    }
    const grade = imposicaoGrade(o, arte, faca);
    const x = Math.max(arte[2]*pt, ...info.artboards.map(b => b.x + b.width)) + 15*pt;
    const y = Math.min(arte[1]*pt, ...info.artboards.map(b => b.y));
    const x2 = x + (o.largura+15)*pt;
    const folha = {y, width:o.largura*pt, height:o.altura*pt};
    vc.run("artboard.new", {...folha, x, name:"ARTE " + (info.artboards.length + 1)});
    vc.run("artboard.new", {...folha, x:x2, name:"FACA " + (info.artboards.length + 2)});

    const idsFaca = [], idsMarcas = [];
    function desenhar(anchors, dx, dy, closed) {
        const mover = ([a,b]) => [a+dx, b+dy];
        return vc.run("path.create", {
            anchors: anchors.map(a => {
                const [x,y] = mover(a.p);
                return {x,y,...(a.in ? {in:mover(a.in)} : {}), ...(a.out ? {out:mover(a.out)} : {})};
            }), closed
        }).id;
    }
    for (const [dx,dy] of grade.posicoes) {
        const copia = vc.run("object.move", {ids:[id], dx:x+dx*pt, dy:y+dy*pt, copy:true, patterns:true});
        if (!copia.ids || copia.ids.length !== 1 || copia.ids[0] === id) throw Error("O editor não conseguiu duplicar a peça.");
        idsFaca.push(desenhar(pontos, x2+dx*pt, y+dy*pt, true));
    }
    for (const lado of [x,x2]) for (const [x1,y1,x2,y2] of grade.marcas) {
        idsMarcas.push(desenhar([{p:[x1*pt,y1*pt]}, {p:[x2*pt,y2*pt]}], lado, y, false));
    }
    function estilo(ids, color) {
        if (!ids.length) return;
        vc.run("paint.setFill", {ids, none:true});
        vc.run("paint.setStroke", {ids, color});
        vc.run("stroke.set", {ids, weight:0.25, cap:"butt", join:"round", align:"center", dash:null});
    }
    estilo(idsFaca, "#ff0000");
    estilo(idsMarcas, {c:0,m:0,y:0,k:100});
    vc.run("select.set", {ids:[id]});
    alert(imposicaoResumo(grade), titulo);
}());
