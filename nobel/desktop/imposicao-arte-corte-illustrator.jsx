#target illustrator
/* @ibd-imposicao-grade */

(function () {
    var doc, abas = [], camadas = [], original, sistema = app.coordinateSystem;
    try {
        if (!app.documents.length) throw Error("Abra um documento no Illustrator.");
        doc = app.activeDocument;
        if (!doc.selection || doc.selection.length !== 1 || typeof doc.selection[0].duplicate !== "function") {
            throw Error("Selecione um objeto ou grupo com a ferramenta Seleção.");
        }
        original = doc.selection[0];
        var texto = prompt(imposicaoPergunta, imposicaoPadrao, "Imposição de arte e corte");
        if (texto === null) return;
        var o = imposicaoOpcoes(texto), pt = imposicaoPt;
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        function caixa(r) { return [r[0]/pt, -r[1]/pt, r[2]/pt, -r[3]/pt]; }
        var arte = caixa(original.visibleBounds), faca, vertices;
        if (o.retangulo) {
            faca = imposicaoRetangulo(arte, o.offset);
            vertices = imposicaoVertices(faca);
        } else {
            if (original.typename !== "PathItem" || !original.closed || original.clipping || original.guides) {
                throw Error("Selecione um traçado simples fechado ou escolha a faca retangular.");
            }
            faca = caixa(original.geometricBounds);
            if (o.offset) {
                var p = [];
                for (var i = 0; i < original.pathPoints.length; i++) {
                    var no = original.pathPoints[i], a = no.anchor;
                    var d = no.leftDirection, e = no.rightDirection;
                    if (Math.abs(a[0]-d[0])+Math.abs(a[1]-d[1])+Math.abs(a[0]-e[0])+Math.abs(a[1]-e[1]) > 1e-5) {
                        throw Error("Use um polígono convexo sem segmentos Bézier, ou use deslocamento zero para preservar o traçado.");
                    }
                    p.push([a[0]/pt, -a[1]/pt]);
                }
                vertices = imposicaoPoligono(p, o.offset);
                faca = imposicaoCaixa(vertices);
            }
        }
        var grade = imposicaoGrade(o, arte, faca);
        var x = arte[2], y = -arte[1];
        camadas.push(doc.layers.add());
        camadas.push(doc.layers.add());
        camadas[0].name = "ARTE · Imposição";
        camadas[1].name = "FACA · Imposição";
        var corFaca = new CMYKColor(); corFaca.magenta = 100; corFaca.yellow = 100;
        var preto = new CMYKColor(); preto.black = 100;
        var todos = doc.visibleBounds;
        x = Math.max(x, todos[2]/pt);
        for (var b = 0; b < doc.artboards.length; b++) {
            var limite = doc.artboards[b].artboardRect;
            x = Math.max(x, limite[2]/pt);
            y = Math.max(y, limite[1]/pt);
        }
        x += 15;
        var ladoFaca = x + o.largura + 15;
        function adicionarPrancheta(esquerda, nome) {
            var board = doc.artboards.add([esquerda*pt, y*pt, (esquerda+o.largura)*pt, (y-o.altura)*pt]);
            abas.push(board);
            board.name = nome + " " + doc.artboards.length;
        }
        adicionarPrancheta(x, "ARTE");
        adicionarPrancheta(ladoFaca, "FACA");
        function deslocar(obj, dx, dy) { obj.translate(dx*pt, -dy*pt, true, true, true, true); }
        function estilo(item, cor) {
            item.filled = false; item.stroked = true; item.strokeWidth = 0.25;
            item.strokeColor = cor; item.strokeDashes = [];
            item.strokeJoin = StrokeJoin.ROUNDENDJOIN; item.strokeCap = StrokeCap.BUTTENDCAP;
            item.strokeOverprint = false; item.opacity = 100;
        }
        function desenhar(destino, p, dx, dy, fechar, cor) {
            var item = destino.pathItems.add(), pontos = [];
            for (var i = 0; i < p.length; i++) pontos.push([(p[i][0]+dx)*pt, -(p[i][1]+dy)*pt]);
            item.setEntirePath(pontos);
            item.closed = fechar;
            estilo(item, cor);
        }
        var i, ponto;
        for (i = 0; i < grade.posicoes.length; i++) {
            ponto = grade.posicoes[i];
            deslocar(original.duplicate(camadas[0], ElementPlacement.PLACEATEND), x+ponto[0], ponto[1]-y);
            if (vertices) desenhar(camadas[1], vertices, ladoFaca+ponto[0], ponto[1]-y, true, corFaca);
            else {
                // Recria só a geometria. O novo traçado não herda efeitos da aparência.
                var corte = camadas[1].pathItems.add();
                for (var j = 0; j < original.pathPoints.length; j++) {
                    var fonte = original.pathPoints[j], noNovo = corte.pathPoints.add();
                    noNovo.anchor = fonte.anchor;
                    noNovo.leftDirection = fonte.leftDirection;
                    noNovo.rightDirection = fonte.rightDirection;
                }
                corte.closed = true; estilo(corte, corFaca);
                deslocar(corte, ladoFaca+ponto[0], ponto[1]-y);
            }
        }
        for (var k = 0; k < 2; k++) {
            var grupo = camadas[k].groupItems.add();
            grupo.name = "CRUZES DE REGISTRO";
            for (i = 0; i < grade.marcas.length; i++) {
                var m = grade.marcas[i];
                desenhar(grupo, [[m[0],m[1]],[m[2],m[3]]], k ? ladoFaca : x, -y, false, preto);
            }
            if (!grade.marcas.length) grupo.remove();
        }
        alert(imposicaoResumo(grade));
    } catch (e) {
        for (var c = camadas.length-1; c >= 0; c--) try { camadas[c].remove(); } catch (_) {}
        for (var b = abas.length-1; b >= 0; b--) try { abas[b].remove(); } catch (_) {}
        alert("Imposição de arte e corte\n" + e.message);
    } finally {
        app.coordinateSystem = sistema;
    }
}());
