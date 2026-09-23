/**
 * @ibd-id illustrator/guias-selecao-margem
 * @ibd-titulo Guias da seleção e margem
 * @ibd-descricao Cria guias nos limites do conjunto selecionado e na margem escolhida, em uma camada separada.
 * @ibd-app illustrator
 * @ibd-versao 1.0.1
 * @ibd-tags guias, margem, selecao, arte-final
 * @ibd-doc docs/guias-e-sangria.md
 *
 * Script independente do Kit Guias e Sangria v1.0.
 * Guia: docs/guias-e-sangria.md. Testes locais: npm run test:guias.
 * A execução dentro dos aplicativos Adobe ainda precisa ser validada.
 */

#target illustrator
/* Kit Guias e Sangria | v1.0 | 21/09/2026
 * ExtendScript/JSX independente, ES3. Windows e macOS desktop.
 * Abra pelo menu Arquivo > Scripts. Consulte docs/guias-e-sangria.md.
 * Valida\u00e7\u00e3o local de l\u00f3gica; execu\u00e7\u00e3o no aplicativo Adobe ainda necess\u00e1ria.
 */
(function () {
// Core geom\u00e9trico ES3. Incorporado em cada JSX: n\u00e3o requer arquivos auxiliares.
var G = (function () {
    function number(text) {
        var s = String(text).replace(/^\s+|\s+$/g, "").replace(",", ".");
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) {
            throw new Error("Digite um n\u00famero positivo ou zero, sem separador de milhar.");
        }
        var v = Number(s);
        if (!isFinite(v)) { throw new Error("O valor informado \u00e9 muito grande."); }
        return v;
    }
    function toBase(v, unit, resolution) {
        var f = unit === "mm" ? resolution / 25.4 :
            unit === "cm" ? resolution / 2.54 :
            unit === "pt" ? resolution / 72 : 1;
        var result = v * f;
        if (!isFinite(result)) { throw new Error("A medida ultrapassa o limite num\u00e9rico."); }
        return result;
    }
    function fmt(v, decimals) {
        return Number(v).toFixed(decimals === undefined ? 2 : decimals).replace(".", ",");
    }
    // Todos os ret\u00e2ngulos internos usam [esquerda, topo, direita, base], y para baixo.
    function validRect(b) {
        var i;
        if (!b || b.length !== 4) { throw new Error("N\u00e3o foi poss\u00edvel medir a \u00e1rea."); }
        for (i = 0; i < 4; i++) {
            if (!isFinite(b[i])) { throw new Error("A \u00e1rea cont\u00e9m uma coordenada inv\u00e1lida."); }
        }
        if (b[2] <= b[0] || b[3] <= b[1]) {
            throw new Error("A \u00e1rea precisa ter largura e altura maiores que zero.");
        }
        return b;
    }
    function rectangles(b, m, mode) {
        validRect(b);
        if (!isFinite(m) || m < 0) { throw new Error("A margem precisa ser positiva ou zero."); }
        var rects = [{name: "Limite original", b: b.slice(0)}];
        if (m === 0) { return rects; }
        if (mode === 1 || mode === 2) {
            if (2 * m >= b[2] - b[0] || 2 * m >= b[3] - b[1]) {
                throw new Error("A margem interna deve ser menor que metade da largura e da altura.");
            }
            rects.push({name: "Margem interna", b: [b[0]+m, b[1]+m, b[2]-m, b[3]-m]});
        }
        if (mode === 0 || mode === 2) {
            rects.push({name: "Margem externa", b: [b[0]-m, b[1]-m, b[2]+m, b[3]+m]});
        }
        var i;
        for (i = 0; i < rects.length; i++) { validRect(rects[i].b); }
        return rects;
    }
    function plan(rects) {
        var out = [], i, j, k, b, candidates, match;
        for (i = 0; i < rects.length; i++) {
            b = rects[i].b;
            candidates = [{axis:"V",p:b[0]}, {axis:"V",p:b[2]},
                {axis:"H",p:b[1]}, {axis:"H",p:b[3]}];
            for (j = 0; j < candidates.length; j++) {
                match = false;
                for (k = 0; k < out.length; k++) {
                    if (out[k].axis === candidates[j].axis &&
                        Math.abs(out[k].p - candidates[j].p) < 0.000001) { match = true; break; }
                }
                if (!match) {
                    candidates[j].name = rects[i].name;
                    out.push(candidates[j]);
                }
            }
        }
        return out;
    }
    function bleed(w, h, value, unit, resolution) {
        if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0 ||
            !isFinite(resolution) || resolution <= 0 || !isFinite(value) || value <= 0) {
            throw new Error("Informe uma sangria maior que zero.");
        }
        var raw = toBase(value, unit, resolution);
        // Subtrai apenas ru\u00eddo de ponto flutuante pr\u00f3ximo a um inteiro.
        var px = Math.max(1, Math.ceil(raw - 0.000000001));
        var nw = w + 2 * px, nh = h + 2 * px;
        if (!isFinite(nw) || !isFinite(nh)) { throw new Error("O tamanho final \u00e9 muito grande."); }
        return {px:px, width:nw, height:nh, mm:px * 25.4 / resolution,
            rects:[{name:"Corte", b:[px, px, px+w, px+h]},
                   {name:"Borda da sangria", b:[0, 0, nw, nh]}]};
    }
    function union(a, b) {
        if (!a) { return b.slice(0); }
        return [Math.min(a[0],b[0]), Math.min(a[1],b[1]),
                Math.max(a[2],b[2]), Math.max(a[3],b[3])];
    }
    function message(parent, text, height) {
        var c = parent.add("statictext", undefined, text, {multiline:true});
        c.preferredSize = [460, height || 42];
        return c;
    }
    function marginDialog(title, boundsProvider, resolution, isAI, canvas) {
        var w = new Window("dialog", title);
        w.orientation = "column"; w.alignChildren = "fill"; w.spacing = 12; w.margins = 18;
        message(w, isAI ? "Cria guias nos quatro limites do conjunto selecionado e na margem escolhida." :
            "Cria guias nos quatro limites da sele\u00e7\u00e3o de pixels e na margem escolhida.", 38);
        var row = w.add("group");
        row.add("statictext", undefined, "Margem em cada lado:");
        var value = row.add("edittext", undefined, "3"); value.characters = 9;
        var unit = row.add("dropdownlist", undefined, ["mm", "cm", "px", "pt"]); unit.selection = 0;
        var modes = w.add("dropdownlist", undefined,
            ["Externa \u2014 para fora", "Interna \u2014 para dentro", "Interna e externa"]);
        modes.selection = 0;
        var stroke = null;
        if (isAI) {
            stroke = w.add("checkbox", undefined, "Incluir a espessura dos tra\u00e7os"); stroke.value = true;
            message(w, "Grupos com m\u00e1scara de recorte usam os limites da m\u00e1scara.\nObjetos girados usam o ret\u00e2ngulo horizontal/vertical que os envolve.", 40);
        } else {
            message(w, "Sele\u00e7\u00f5es irregulares usam o ret\u00e2ngulo que as envolve.\nA margem em mm, cm ou pt considera os " + fmt(resolution, 2) + " ppi do documento.", 40);
        }
        var preview = message(w, "", 48);
        var status = message(w, "", 48);
        var buttons = w.add("group"); buttons.alignment = "right";
        buttons.add("button", undefined, "Cancelar", {name:"cancel"});
        var ok = buttons.add("button", undefined, "Criar guias", {name:"ok"});
        var result = null;
        function read() {
            var b = boundsProvider(stroke ? stroke.value : false);
            var m = toBase(number(value.text), unit.selection.text, resolution);
            var rects = rectangles(b, m, modes.selection.index);
            return {b:b, rects:rects, guides:plan(rects), margin:m};
        }
        function update() {
            try {
                var c = read(), outside = false, i, b;
                preview.text = "\u00c1rea: " + fmt(c.b[2]-c.b[0]) + " \u00d7 " + fmt(c.b[3]-c.b[1]) +
                    (isAI ? " pt" : " px") + "\n" + c.guides.length + " posi\u00e7\u00f5es de guia. As guias existentes ser\u00e3o preservadas.";
                if (canvas) {
                    for (i = 0; i < c.rects.length; i++) {
                        b = c.rects[i].b;
                        if (b[0] < 0 || b[1] < 0 || b[2] > canvas[0] || b[3] > canvas[1]) { outside = true; }
                    }
                }
                status.text = outside ? "Algumas guias ficar\u00e3o fora da tela. Este script n\u00e3o aumenta a tela." :
                    "Margem zero cria apenas as guias dos limites originais.";
                ok.enabled = true;
            } catch (e) { preview.text = ""; status.text = e.message; ok.enabled = false; }
        }
        value.onChanging = update; unit.onChange = update; modes.onChange = update;
        if (stroke) { stroke.onClick = update; }
        ok.onClick = function () {
            try { result = read(); w.close(1); } catch (e) { alert(e.message); }
        };
        update(); w.center(); value.active = true;
        return w.show() === 1 ? result : null;
    }
    return {number:number, toBase:toBase, fmt:fmt, validRect:validRect, rectangles:rectangles,
        plan:plan, bleed:bleed, union:union, message:message, marginDialog:marginDialog};
}());


if (!app.documents.length) { alert("Abra um documento e selecione um ou mais objetos."); return; }
var doc = app.activeDocument, rawSelection = doc.selection;
if (!rawSelection || typeof rawSelection.length !== "number" || !rawSelection.length ||
    rawSelection.typename === "TextRange") {
    // Relata o que chegou: dizer s\u00f3 "selecione objetos" deixa sem sa\u00edda
    // quem tem objetos selecionados e mesmo assim cai aqui.
    var recebido;
    if (!rawSelection) { recebido = "nada (a sele\u00e7\u00e3o veio vazia do Illustrator)"; }
    else if (rawSelection.typename === "TextRange") { recebido = "um trecho de texto em edi\u00e7\u00e3o"; }
    else if (typeof rawSelection.length !== "number") { recebido = "um objeto de tipo inesperado: " + rawSelection.typename; }
    else { recebido = "uma lista com " + rawSelection.length + " item(ns)"; }
    alert("N\u00e3o h\u00e1 objetos para medir.\n\n" +
        "O script recebeu: " + recebido + ".\n\n" +
        "Selecione objetos inteiros com a ferramenta Sele\u00e7\u00e3o (V) e rode de novo.\n\n" +
        "Se voc\u00ea TEM objetos selecionados e mesmo assim v\u00ea esta mensagem:\n" +
        "\u2022 pressione Esc para sair do modo de isolamento ou da edi\u00e7\u00e3o de texto;\n" +
        "\u2022 troque a ferramenta Prancheta pela Sele\u00e7\u00e3o (V);\n" +
        "\u2022 confira se a camada dos objetos n\u00e3o est\u00e1 travada ou oculta.");
    return;
}
var savedSelection = [], i;
for (i = 0; i < rawSelection.length; i++) { savedSelection.push(rawSelection[i]); }
var previousCoordinates = app.coordinateSystem, previousLayer = doc.activeLayer, newLayer = null;
try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    function rectFromAI(b) {
        return [Math.min(b[0],b[2]), -Math.max(b[1],b[3]),
                Math.max(b[0],b[2]), -Math.min(b[1],b[3])];
    }
    function clipBounds(item) {
        var j, child, k;
        for (j = 0; j < item.pageItems.length; j++) {
            child = item.pageItems[j];
            if (child.parent !== item) { continue; }
            if (child.typename === "PathItem" && child.clipping) { return rectFromAI(child.geometricBounds); }
            if (child.typename === "CompoundPathItem") {
                for (k = 0; k < child.pathItems.length; k++) {
                    if (child.pathItems[k].clipping) { return rectFromAI(child.geometricBounds); }
                }
            }
        }
        throw new Error("N\u00e3o foi poss\u00edvel identificar a m\u00e1scara de um grupo recortado.\nSelecione a pr\u00f3pria m\u00e1scara para us\u00e1-la como refer\u00eancia.");
    }
    function itemBounds(item, withStroke) {
        if (item.hidden || (item.typename === "PathItem" && item.guides)) { return null; }
        var b = null, j, child;
        if (item.typename === "GroupItem") {
            if (item.clipped) { return clipBounds(item); }
            for (j = 0; j < item.pageItems.length; j++) {
                child = item.pageItems[j];
                if (child.parent !== item) { continue; }
                var cb = itemBounds(child, withStroke);
                if (cb) { b = G.union(b, cb); }
            }
            return b;
        }
        try {
            b = withStroke ? item.visibleBounds : item.geometricBounds;
            if (!b || b.length !== 4) { throw new Error("Sem limites."); }
            return rectFromAI(b);
        } catch (e) {
            throw new Error("Um item selecionado n\u00e3o pode ser medido.\nSelecione objetos inteiros com a ferramenta Sele\u00e7\u00e3o (V).");
        }
    }
    function selectionBounds(withStroke) {
        var result = null, j, b;
        for (j = 0; j < savedSelection.length; j++) {
            b = itemBounds(savedSelection[j], withStroke);
            if (b) { result = G.union(result,b); }
        }
        if (!result) { throw new Error("A sele\u00e7\u00e3o cont\u00e9m apenas guias ou itens ocultos."); }
        return G.validRect(result);
    }
    // Detecta sele\u00e7\u00e3o inv\u00e1lida antes de abrir o di\u00e1logo.
    selectionBounds(true);
    var config = G.marginDialog("Guias da sele\u00e7\u00e3o + margem | Illustrator", selectionBounds, 72, true, null);
    if (!config) { return; }
    var span = null;
    for (i = 0; i < doc.artboards.length; i++) { span = G.union(span, rectFromAI(doc.artboards[i].artboardRect)); }
    for (i = 0; i < config.rects.length; i++) { span = G.union(span, config.rects[i].b); }
    span = [span[0]-36, span[1]-36, span[2]+36, span[3]+36];
    newLayer = doc.layers.add();
    newLayer.name = "Guias \u2014 sele\u00e7\u00e3o + margem";
    newLayer.locked = false; newLayer.visible = true;
    for (i = 0; i < config.guides.length; i++) {
        var guide = config.guides[i], path = newLayer.pathItems.add();
        path.filled = false; path.stroked = false;
        if (guide.axis === "V") { path.setEntirePath([[guide.p,-span[1]], [guide.p,-span[3]]]); }
        else { path.setEntirePath([[span[0],-guide.p], [span[2],-guide.p]]); }
        path.name = guide.name + " / " + guide.axis;
        path.guides = true; path.selected = false;
    }
    newLayer.locked = true;
    doc.selection = savedSelection;
    doc.activeLayer = previousLayer;
    app.redraw();
    alert(config.guides.length + " guias criadas em uma nova camada bloqueada.\n\n" +
        "Se estiverem ocultas: Exibir > Guias > Mostrar guias.\n" +
        "Para remover este conjunto, desbloqueie e exclua a camada de guias.");
} catch (e) {
    var recovery = "";
    if (newLayer) {
        try { newLayer.locked = false; newLayer.remove(); }
        catch (removeError) { recovery = "\nConfira e remova a camada de guias incompleta."; }
    }
    alert("N\u00e3o foi poss\u00edvel concluir.\n\n" + e.message + recovery +
        (e.line ? "\nLinha: " + e.line : "") + "\n\nAplicativo: Illustrator " + app.version);
} finally {
    try { doc.activeLayer = previousLayer; doc.selection = savedSelection; }
    finally { app.coordinateSystem = previousCoordinates; }
}

}());
