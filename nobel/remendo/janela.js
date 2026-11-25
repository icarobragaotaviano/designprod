// Geometria em milímetros, com origem no canto superior esquerdo da arte.
function janelaRemendo(largura, altura, x, y, w, h, margem) {
    var medidas = [largura, altura, x, y, w, h, margem];
    for (var i = 0; i < medidas.length; i++) {
        if (typeof medidas[i] !== "number" || !isFinite(medidas[i])) {
            throw new Error("Informe medidas numéricas finitas.");
        }
    }
    if (largura <= 0 || altura <= 0 || x < 0 || y < 0 || w <= 0 || h <= 0 || margem < 0) {
        throw new Error("Informe medidas positivas, com origem e margem a partir de zero.");
    }
    if (x + w > largura + 0.000001 || y + h > altura + 0.000001) {
        throw new Error("A área avariada precisa caber na arte original.");
    }
    var esquerda = Math.max(0, x - margem);
    var topo = Math.max(0, y - margem);
    var direita = Math.min(largura, x + w + margem);
    var base = Math.min(altura, y + h + margem);
    return [esquerda, topo, direita - esquerda, base - topo];
}

function medidasRemendo(texto) {
    var partes = texto.split(";");
    if (partes.length !== 5) throw new Error("Use X; Y; largura; altura; margem, em milímetros.");
    for (var i = 0; i < partes.length; i++) {
        var campo = partes[i].replace(/^\s+|\s+$/g, "").replace(",", ".");
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(campo)) throw new Error("Revise o valor " + (i + 1) + ".");
        partes[i] = Number(campo);
    }
    return partes;
}

function resumoRemendo(janela) {
    function mm(n) { return String(Number(n.toFixed(3))).replace(".", ","); }
    return "Aplicação a partir do topo esquerdo: X " + mm(janela[0]) + ", Y " + mm(janela[1]) +
        " mm.\nFormato final: " + mm(janela[2]) + " × " + mm(janela[3]) + " mm.";
}
