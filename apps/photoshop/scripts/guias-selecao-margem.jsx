/**
 * @ibd-id photoshop/guias-selecao-margem
 * @ibd-titulo Remendo de adesivo — seleção e margem
 * @ibd-descricao Cria guias, seleciona a área total com margem e gera um novo documento mesclado na escala e nas cores do original.
 * @ibd-app photoshop
 * @ibd-versao 1.1.0
 * @ibd-tags remendo, adesivo, guias, margem, arte-final
 *
 * Remendos v1.1.0: duplicata mesclada e recorte sem reamostragem.
 * Guia: docs/guias-e-sangria.md. Testes locais: npm run test:guias.
 * A execução dentro dos aplicativos Adobe ainda precisa ser validada.
 */

#target photoshop
/* Remendos, Guias e Sangria | v1.1.0 | 21/09/2026
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
    function patch(bounds, value, unit, resolution, canvas) {
        validRect(bounds);
        var raw = toBase(value, unit, resolution);
        if (raw < 0 || !isFinite(raw)) { throw new Error("A margem precisa ser positiva ou zero."); }
        // Recorte em pixels inteiros: n\u00e3o reamostrar nem cortar parte de um pixel.
        var margin = raw === 0 ? 0 : Math.max(1, Math.ceil(raw - 0.000000001));
        var base = [Math.floor(bounds[0]), Math.floor(bounds[1]), Math.ceil(bounds[2]), Math.ceil(bounds[3])];
        var total = [base[0]-margin, base[1]-margin, base[2]+margin, base[3]+margin];
        if (total[0] < 0 || total[1] < 0 || total[2] > canvas[0] || total[3] > canvas[1]) {
            throw new Error("A margem ultrapassa a imagem existente.\nReduza a margem ou ajuste a sele\u00e7\u00e3o para incluir apenas conte\u00fado da arte.");
        }
        var rects = [{name:"\u00c1rea a cobrir", b:base}, {name:"Borda do remendo", b:total}];
        var local = [], i, b;
        for (i = 0; i < rects.length; i++) {
            b = rects[i].b;
            local.push({name:rects[i].name, b:[b[0]-total[0], b[1]-total[1], b[2]-total[0], b[3]-total[1]]});
        }
        return {b:base, total:total, width:total[2]-total[0], height:total[3]-total[1],
            margin:margin, marginMM:margin*25.4/resolution, guides:plan(rects), localGuides:plan(local)};
    }
    function patchDialog(bounds, resolution, canvas) {
        var w = new Window("dialog", "Remendo de adesivo | Photoshop");
        w.orientation = "column"; w.alignChildren = "fill"; w.spacing = 12; w.margins = 18;
        message(w, "A sele\u00e7\u00e3o marca a \u00e1rea a cobrir. A margem amplia o remendo igualmente nos quatro lados.", 38);
        var row = w.add("group");
        row.add("statictext", undefined, "Margem de sobreposi\u00e7\u00e3o:");
        var value = row.add("edittext", undefined, "3"); value.characters = 9;
        var unit = row.add("dropdownlist", undefined, ["mm", "cm", "px", "pt"]); unit.selection = 0;
        message(w, "Cria as guias, seleciona toda a \u00e1rea at\u00e9 as guias externas e abre um novo documento com essa regi\u00e3o mesclada.", 42);
        message(w, "Mant\u00e9m a escala, a resolu\u00e7\u00e3o e as cores do original.\nSele\u00e7\u00f5es irregulares usam o ret\u00e2ngulo que as envolve.", 40);
        var preview = message(w, "", 66);
        var status = message(w, "", 42);
        var buttons = w.add("group"); buttons.alignment = "right";
        buttons.add("button", undefined, "Cancelar", {name:"cancel"});
        var ok = buttons.add("button", undefined, "Criar remendo", {name:"ok"});
        var result = null;
        function read() { return patch(bounds, number(value.text), unit.selection.text, resolution, canvas); }
        function update() {
            try {
                var c = read();
                preview.text = "Novo documento: " + c.width + " \u00d7 " + c.height + " px\n" +
                    "Tamanho de impress\u00e3o: " + fmt(c.width*25.4/resolution, 3) + " \u00d7 " +
                    fmt(c.height*25.4/resolution, 3) + " mm | " + fmt(resolution) + " ppi\n" +
                    "Margem aplicada: " + c.margin + " px = " + fmt(c.marginMM, 4) + " mm por lado.";
                status.text = "Medidas arredondadas para fora at\u00e9 pixels inteiros.\nO original recebe as guias e a sele\u00e7\u00e3o total; a imagem n\u00e3o \u00e9 alterada.";
                ok.enabled = true;
            } catch (e) { preview.text = ""; status.text = e.message; ok.enabled = false; }
        }
        value.onChanging = update; unit.onChange = update;
        ok.onClick = function () {
            try { result = read(); w.close(1); } catch (e) { alert(e.message); }
        };
        update(); w.center(); value.active = true;
        return w.show() === 1 ? result : null;
    }
    return {number:number, toBase:toBase, fmt:fmt, validRect:validRect, rectangles:rectangles,
        plan:plan, bleed:bleed, union:union, message:message, patch:patch, patchDialog:patchDialog};
}());

var PS = (function () {
    function pixels(doc, fn) {
        var oldUnits = app.preferences.rulerUnits;
        try {
            app.preferences.rulerUnits = Units.PIXELS;
            // O DOM do Photoshop usa coordenadas da imagem. Document.rulerOrigin
            // pertence ao Illustrator e n\u00e3o \u00e9 uma propriedade do DOM legado do PS.
            return fn();
        } finally { app.preferences.rulerUnits = oldUnits; }
    }
    function history(doc, label, fn) {
        var before = doc.activeHistoryState, failure = null;
        var key = "__ICARO_GUIAS_" + new Date().getTime();
        $.global[key] = function () { try { fn(); } catch (e) { failure = e; } };
        try {
            doc.suspendHistory(label, "$.global." + key + "();");
            if (failure) { throw failure; }
        } catch (e) {
            try { doc.activeHistoryState = before; }
            catch (rollbackError) {
                throw new Error(e.message + "\nN\u00e3o foi poss\u00edvel reverter automaticamente. Verifique o painel Hist\u00f3rico.");
            }
            throw e;
        } finally { delete $.global[key]; }
    }
    function addGuides(doc, guides) {
        var i, j, axis, existing, count = 0;
        for (i = 0; i < guides.length; i++) {
            axis = guides[i].axis === "V" ? Direction.VERTICAL : Direction.HORIZONTAL;
            existing = false;
            for (j = 0; j < doc.guides.length; j++) {
                if (doc.guides[j].direction === axis &&
                    Math.abs(doc.guides[j].coordinate.as("px") - guides[i].p) < 0.000001) {
                    existing = true; break;
                }
            }
            if (!existing) { doc.guides.add(axis, UnitValue(guides[i].p, "px")); count++; }
        }
        return count;
    }
    function hasArtboards(doc) {
        if (parseFloat(app.version) < 16) { return false; }
        function scan(sets) {
            var i, ref, desc, key = stringIDToTypeID("artboardEnabled");
            for (i = 0; i < sets.length; i++) {
                ref = new ActionReference();
                ref.putIdentifier(stringIDToTypeID("layer"), sets[i].id);
                desc = executeActionGet(ref);
                if (desc.hasKey(key) && desc.getBoolean(key)) { return true; }
                if (scan(sets[i].layerSets)) { return true; }
            }
            return false;
        }
        return scan(doc.layerSets);
    }
    function characteristics(doc) {
        var type = String(doc.colorProfileType), name = null, channels = [], i;
        if (type === "undefined") { throw new Error("N\u00e3o foi poss\u00edvel verificar o perfil de cor do documento."); }
        // Um original sem perfil deve continuar sem perfil: n\u00e3o atribuir o espa\u00e7o de trabalho.
        if (!/NONE/i.test(type)) { name = doc.colorProfileName; }
        for (i = 0; i < doc.channels.length; i++) {
            channels.push({name:doc.channels[i].name, kind:String(doc.channels[i].kind)});
        }
        return {resolution:doc.resolution, mode:String(doc.mode), bits:String(doc.bitsPerChannel),
            aspect:doc.pixelAspectRatio, profileType:type, profileName:name, channels:channels};
    }
    function checkCharacteristics(expected, doc) {
        var actual = characteristics(doc), different = [], i;
        if (actual.resolution !== expected.resolution) { different.push("resolu\u00e7\u00e3o"); }
        if (actual.mode !== expected.mode) { different.push("modo de cor"); }
        if (actual.bits !== expected.bits) { different.push("profundidade de bits"); }
        if (actual.aspect !== expected.aspect) { different.push("propor\u00e7\u00e3o dos pixels"); }
        if (actual.profileType !== expected.profileType || actual.profileName !== expected.profileName) {
            different.push("perfil de cor");
        }
        if (actual.channels.length !== expected.channels.length) { different.push("canais"); }
        else {
            for (i = 0; i < actual.channels.length; i++) {
                if (actual.channels[i].name !== expected.channels[i].name || actual.channels[i].kind !== expected.channels[i].kind) {
                    different.push("canais"); break;
                }
            }
        }
        if (different.length) {
            throw new Error("O Photoshop alterou " + different.join(", ") + " ao gerar a c\u00f3pia.\nO remendo foi interrompido para preservar as caracter\u00edsticas do original.");
        }
    }
    function patchName(doc) {
        var base = doc.name.replace(/\.[^\.]+$/, "") + "_remendo", name = base, counter = 1, i, used;
        do {
            used = false;
            for (i = 0; i < app.documents.length; i++) {
                if (app.documents[i].name.toLowerCase() === name.toLowerCase()) { used = true; break; }
            }
            if (used) { counter++; name = base + "_" + counter; }
        } while (used);
        return name;
    }
    function error(e) {
        alert("N\u00e3o foi poss\u00edvel concluir.\n\n" + e.message +
            (e.line ? "\nLinha: " + e.line : "") + "\n\nAplicativo: Photoshop " + app.version);
    }
    return {pixels:pixels, history:history, addGuides:addGuides, hasArtboards:hasArtboards, characteristics:characteristics, checkCharacteristics:checkCharacteristics, patchName:patchName, error:error};
}());

if (!app.documents.length) { alert("Abra a arte existente e selecione a \u00e1rea que o adesivo deve cobrir."); return; }
var source = app.activeDocument, target = null, before = null, changed = false;
try {
    if (PS.hasArtboards(source)) {
        throw new Error("Esta vers\u00e3o de remendos trabalha com uma tela \u00fanica.\nAbra a arte sem pranchetas para manter o recorte na escala original.");
    }
    var bounds, canvas;
    PS.pixels(source, function () {
        var raw;
        try { raw = source.selection.bounds; }
        catch (e) { throw new Error("Fa\u00e7a uma sele\u00e7\u00e3o da \u00e1rea a cobrir com a ferramenta Letreiro (M)."); }
        bounds = G.validRect([raw[0].as("px"), raw[1].as("px"), raw[2].as("px"), raw[3].as("px")]);
        canvas = [source.width.as("px"), source.height.as("px")];
    });
    var expected = PS.characteristics(source);
    var config = G.patchDialog(bounds, source.resolution, canvas);
    if (!config) { return; }
    var count = 0, area = config.total;
    before = source.activeHistoryState;
    PS.history(source, "Remendo: guias e sele\u00e7\u00e3o total", function () {
        PS.pixels(source, function () {
            count = PS.addGuides(source, config.guides);
            // Substitui a sele\u00e7\u00e3o pela \u00e1rea TOTAL do remendo, incluindo a margem.
            source.selection.select([
                [area[0],area[1]], [area[2],area[1]], [area[2],area[3]], [area[0],area[3]]
            ], SelectionType.REPLACE, 0, false);
        });
    });
    changed = true;
    // Mescla a composi\u00e7\u00e3o inteira ANTES do recorte: efeitos/ajustes n\u00e3o s\u00e3o
    // recalculados sobre uma tela menor. A duplicata herda os atributos do arquivo.
    target = source.duplicate(PS.patchName(source), true);
    app.activeDocument = target;
    PS.pixels(target, function () {
        PS.checkCharacteristics(expected, target);
        target.selection.deselect();
        // Sem largura/altura/resolu\u00e7\u00e3o de sa\u00edda: apenas recorte, sem reamostragem.
        target.crop([UnitValue(area[0],"px"), UnitValue(area[1],"px"),
            UnitValue(area[2],"px"), UnitValue(area[3],"px")]);
        if (target.width.as("px") !== config.width || target.height.as("px") !== config.height) {
            throw new Error("O Photoshop n\u00e3o produziu as dimens\u00f5es exatas do remendo.");
        }
        PS.checkCharacteristics(expected, target);
        if (target.layers.length !== 1) { throw new Error("A c\u00f3pia n\u00e3o resultou em uma \u00fanica camada mesclada."); }
        // Mostrar a composi\u00e7\u00e3o, mesmo se um canal auxiliar estiver ativo no original.
        target.activeChannels = target.componentChannels;
        // Guias do remendo nas coordenadas locais; n\u00e3o transportar guias alheias ao recorte.
        while (target.guides.length) { target.guides[0].remove(); }
        PS.addGuides(target, config.localGuides);
    });
    alert("Remendo criado: " + config.width + " \u00d7 " + config.height + " px.\n" +
        "Escala original | " + G.fmt(expected.resolution) + " ppi.\n" +
        "Margem: " + config.margin + " px por lado.\n\n" +
        "O original ficou com as guias e a sele\u00e7\u00e3o total.\n" +
        "O novo documento cont\u00e9m a composi\u00e7\u00e3o mesclada dessa \u00e1rea. Salve o remendo em PSD.");
} catch (e) {
    var recovery = "";
    if (target) {
        try { target.close(SaveOptions.DONOTSAVECHANGES); }
        catch (closeError) { recovery += "\nA c\u00f3pia incompleta ficou aberta; verifique-a antes de salvar."; }
    }
    try {
        app.activeDocument = source;
        if (changed && before) { source.activeHistoryState = before; }
    } catch (restoreError) { recovery += "\nVerifique as guias e a sele\u00e7\u00e3o no Hist\u00f3rico do original."; }
    if (recovery) { e = new Error(e.message + recovery); }
    PS.error(e);
}

}());
