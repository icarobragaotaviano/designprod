/* @ibd-remendo-janela */
(function () {
    try {
        const payload = vc.run("document.json", {});
        const doc = payload.document || payload;
        const numero = prompt("Número da prancheta original", "1");
        if (numero === null) return;
        const i = Number(numero) - 1;
        if (!Number.isInteger(i) || i < 0 || !doc.artboards || !doc.artboards[i]) throw new Error("Prancheta original inexistente.");
        const entrada = prompt("X; Y; largura; altura; margem em mm\nX/Y partem do canto superior esquerdo.", "10;10;50;30;3");
        if (entrada === null) return;
        const mm = medidasRemendo(entrada);
        const r = doc.artboards[i].rect;
        const pt = 72 / 25.4;
        const janela = janelaRemendo((r.x1 - r.x0) / pt, (r.y1 - r.y0) / pt, mm[0], mm[1], mm[2], mm[3], mm[4]);
        const nome = "Remendo · prancheta " + (doc.artboards.length + 1);
        vc.run("artboard.new", {
            x: r.x0 + janela[0] * pt,
            y: r.y0 + janela[1] * pt,
            width: janela[2] * pt,
            height: janela[3] * pt,
            name: nome
        });
        const mensagem = resumoRemendo(janela) + "\nExporte somente a prancheta " + nome + " em tamanho real.";
        vc.log(mensagem);
        alert(mensagem);
    } catch (e) { alert(e.message); }
}());
