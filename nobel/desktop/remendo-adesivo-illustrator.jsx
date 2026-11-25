#target illustrator
/* @ibd-remendo-janela */
(function () {
    if (!app.documents.length) { alert("Abra a arte original."); return; }
    var fonte = app.activeDocument;
    if (!fonte.saved || !/\.ai$/i.test(fonte.name)) { alert("Salve a arte original em AI antes de criar o remendo."); return; }
    var arquivo;
    try { arquivo = fonte.fullName; } catch (e) { alert("Salve a arte original em AI."); return; }
    var indice = fonte.artboards.getActiveArtboardIndex();
    var bordas = fonte.artboards[indice].artboardRect;
    var pt = 72 / 25.4;
    var entrada = prompt("Prancheta ativa · X; Y; largura; altura; margem (mm)\nX/Y partem do canto superior esquerdo.", "10;10;50;30;3", "IBD · Remendo de adesivo");
    if (entrada === null) return;
    var parte;
    try {
        var m = medidasRemendo(entrada);
        parte = janelaRemendo((bordas[2] - bordas[0]) / pt, (bordas[1] - bordas[3]) / pt, m[0], m[1], m[2], m[3], m[4]);
    } catch (e) { alert(e.message); return; }

    var alvo = File.saveDialog("Salvar cópia editável do remendo (.ai)");
    if (!alvo) return;
    if (!/\.ai$/i.test(alvo.name)) alvo = new File(alvo.fsName + ".ai");
    if (alvo.exists || alvo.fsName === arquivo.fsName) { alert("Escolha um novo arquivo."); return; }
    // Abrir ao lado do mestre mantém a referência dos vínculos relativos.
    var temp = new File(arquivo.parent.fsName + "/ibd-remendo-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000) + ".ai");
    var copia, criado = false, salvo = false;
    try {
        if (temp.exists || !arquivo.copy(temp)) throw new Error("Não foi possível copiar o mestre.");
        criado = true;
        copia = app.open(temp);
        var aba = copia.artboards[indice];
        var left = bordas[0] + parte[0] * pt;
        var top = bordas[1] - parte[1] * pt;
        aba.artboardRect = [left, top, left + parte[2] * pt, top - parte[3] * pt];
        aba.name = "Remendo";
        for (var i = copia.artboards.length - 1; i >= 0; i--) if (i !== indice) copia.artboards[i].remove();
        var opcoes = new IllustratorSaveOptions();
        opcoes.pdfCompatible = true;
        copia.saveAs(alvo, opcoes);
        salvo = true;
        alert(resumoRemendo(parte) + "\nPara impressão, exporte a prancheta Remendo em escala 1:1.");
    } catch (e) {
        alert(e.message);
    } finally {
        try { if (copia && !salvo) copia.close(SaveOptions.DONOTSAVECHANGES); }
        finally { if (criado && temp.exists) temp.remove(); }
    }
}());
