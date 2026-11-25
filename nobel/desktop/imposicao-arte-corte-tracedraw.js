/* @ibd-imposicao-grade */
const TraceDrawPlugin = {
    name: "Imposição de arte e corte",
    version: "1.0",
    description: "Gera páginas pareadas para impressão e corte.",
    commands: [{
        name: "Montar arte e faca",
        run() {
            const doc = ActiveDocument, origem = ActivePage, selecionados = ActiveSelectionRange;
            if (selecionados.Count !== 1) throw Error("Selecione um objeto ou grupo.");
            const original = selecionados.Item(1);
            const texto = prompt(imposicaoPergunta, imposicaoPadrao);
            if (texto === null) return;
            const o = imposicaoOpcoes(texto), unidade = doc.Unit, paginas = [];
            let mestre;
            const caixa = s => [s.LeftX, -s.TopY, s.RightX, -s.BottomY];
            try {
                doc.Unit = cdrMillimeter;
                const arte = caixa(original);
                let faca = o.retangulo ? imposicaoRetangulo(arte, o.offset) : arte;
                if (!o.retangulo) {
                    if (original.Type !== cdrCurveShape || original.Curve.SubPaths.Count !== 1 || !original.Curve.Closed) {
                        throw Error("Converta o contorno externo em uma curva fechada simples ou escolha a faca retangular.");
                    }
                    mestre = original.Duplicate(0, 0);
                    mestre.Fill.ApplyUniformFill(Application.CreateCMYKColor(0, 100, 100, 0));
                    mestre.Outline.SetNoOutline();
                    mestre.Transparency.ApplyNoTransparency();
                    if (o.offset) {
                        const efeito = mestre.CreateContour(o.offset > 0 ? cdrContourOutside : cdrContourInside, Math.abs(o.offset), 1);
                        const resultado = efeito.Separate();
                        if (resultado.Count !== 1) {
                            resultado.Delete();
                            throw Error("O deslocamento precisa produzir uma única faca independente.");
                        }
                        const contorno = resultado.Item(1);
                        if (contorno.id === mestre.id) throw Error("A faca precisa ser independente da arte.");
                        mestre.Delete();
                        mestre = contorno;
                    }
                    if (mestre.Type !== cdrCurveShape || mestre.Curve.SubPaths.Count !== 1 || !mestre.Curve.Closed) {
                        throw Error("O deslocamento dividiu ou eliminou a curva de corte.");
                    }
                    faca = caixa(mestre);
                }
                const grade = imposicaoGrade(o, arte, faca);
                const vermelho = Application.CreateCMYKColor(0, 100, 100, 0), preto = Application.CreateCMYKColor(0, 0, 0, 100);
                function estilo(shape, cor) {
                    shape.Fill.ApplyNoFill();
                    shape.Outline.SetNoOutline();
                    shape.Outline.SetProperties(imposicaoTraco, undefined, cor, undefined, undefined, false, false, 0, 1);
                }
                function pagina(nome) {
                    const p = doc.AddPages(1);
                    paginas.push(p);
                    p.SetSize(o.largura, o.altura);
                    p.Name = nome;
                    return p;
                }
                const artePagina = pagina("ARTE"), facaPagina = pagina("FACA");
                const impressao = artePagina.CreateLayer("Arte"), cortes = facaPagina.CreateLayer("Faca");
                function copiar(s, camada, x, topo) {
                    const r = s.CopyToLayer(camada);
                    if (r.Count !== 1) throw Error("O editor não conseguiu duplicar a peça.");
                    const c = r.Item(1);
                    c.Move(x - c.LeftX, topo - c.TopY);
                    return c;
                }
                for (const [tx, ty] of grade.posicoes) {
                    copiar(original, impressao, arte[0]+tx, o.altura-arte[1]-ty);
                    const x = faca[0]+tx, topo = o.altura-faca[1]-ty;
                    const c = mestre ? copiar(mestre, cortes, x, topo)
                        : cortes.CreateRectangle2(x, o.altura-faca[3]-ty, faca[2]-faca[0], faca[3]-faca[1]);
                    estilo(c, vermelho);
                }
                if (grade.marcas.length) for (const p of paginas) {
                    const camada = p.CreateLayer("Cruzes de registro");
                    for (const [x1,y1,x2,y2] of grade.marcas) {
                        estilo(camada.CreateLineSegment(x1, o.altura-y1, x2, o.altura-y2), preto);
                    }
                }
                artePagina.Activate();
                alert(imposicaoResumo(grade));
            } catch (e) {
                for (let i = paginas.length - 1; i >= 0; i--) try { paginas[i].Delete(); } catch (_) {}
                origem.Activate();
                throw e;
            } finally {
                try { if (mestre) mestre.Delete(); } finally { doc.Unit = unidade; }
            }
        }
    }]
};
