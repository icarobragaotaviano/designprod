/* @ibd-remendo-janela */
const TraceDrawPlugin = {
    name: "IBD · Remendo de adesivo",
    description: "Cria uma página de remendo em escala real com a arte selecionada.",
    version: "1.0",
    commands: [{
        name: "Criar remendo da seleção",
        run() {
            const doc = ActiveDocument;
            const fonte = ActivePage;
            const selecao = ActiveSelectionRange;
            if (!selecao.Count) throw new Error("Selecione a arte da página que deve aparecer no remendo.");
            const entrada = prompt("X; Y; largura; altura; margem em mm\nX/Y partem do canto superior esquerdo da página.", "10;10;50;30;3");
            if (entrada === null) return;
            const m = medidasRemendo(entrada);
            const unidade = doc.Unit;
            let pagina, copia;
            try {
                doc.Unit = cdrMillimeter;
                const janela = janelaRemendo(fonte.SizeWidth, fonte.SizeHeight, m[0], m[1], m[2], m[3], m[4]);
                const dy = janela[1] + janela[3] - fonte.SizeHeight;
                pagina = doc.AddPages(1);
                pagina.SetSize(janela[2], janela[3]);
                pagina.Name = "Remendo";
                const camada = pagina.CreateLayer("Arte do remendo");
                fonte.Activate();
                copia = selecao.Duplicate(0, 0);
                copia.Move(-janela[0], dy);
                copia.MoveToLayer(camada);
                pagina.Activate();
                const recorte = camada.CreateRectangle2(0, 0, janela[2], janela[3]);
                recorte.Fill.NoFill();
                recorte.Outline.NoOutline();
                copia.AddToClipFrame(recorte, false);
                alert(resumoRemendo(janela) + "\nExporte somente a página Remendo.");
            } catch (e) {
                try { if (copia) copia.Delete(); } catch (_) {}
                if (pagina) pagina.Delete();
                fonte.Activate();
                throw e;
            } finally {
                doc.Unit = unidade;
            }
        }
    }]
};
