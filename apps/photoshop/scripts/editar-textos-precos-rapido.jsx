/**
 * @ibd-id photoshop/editar-textos-precos-rapido
 * @ibd-titulo Editar textos e preços
 * @ibd-descricao Edita o PSD aberto com modelos de um ou dois dígitos, nome, preços DE/POR e unidades. Ajusta tela, elementos e guias sem recriar o arquivo.
 * @ibd-app photoshop
 * @ibd-versao 2.0.0
 * @ibd-tags ofertas, texto, precos, modelos, guias
 * @ibd-doc docs/textos-e-precos.md
 */
#target photoshop
/*
 * EDITAR TEXTOS E PRECOS - 2.0.0
 * Abra TEXTO UM DIGITO.psd ou TEXTO DOIS DIGITOS.psd (ou uma copia deles).
 * Arquivo > Scripts > Procurar > este JSX. Informe os dados e clique em Aplicar.
 * Edita o documento aberto. Nao le/escreve PSDs e nao salva automaticamente.
 * Layouts, guias e medidas extraidos dos dois modelos originais do usuario.
 * Uma etapa no Historico; Cmd+Z / Ctrl+Z desfaz a aplicacao.
 * A fonte original SF Pro Condensed Semibold precisa estar ativa.
 * ES3 / ExtendScript. Sem modelos binarios, miniaturas ou dependencias externas.
 * Verificacao local: logica e DOM simulado. A prova visual depende do Photoshop.
 */
(function () {
    var TITLE = "Editar textos e preços — 2.0";
    var FONT = "SFPro-CondensedSemibold";
    var LAYOUTS = [{"digits":1,"width":597,"height":484,"guides":[[25.0,0],[25.0,1],[572.0,0],[459.0,1]],"product":{"box":[27,39,464,164],"sample":"Lorem ipsum\rdolor sit amet"},"de":{"integer":{"box":[64,281,116,371],"sample":"9"},"cents":{"box":[119,281,159,313],"sample":",99"},"label":{"box":[27,281,57,336],"sample":"DE\rR$\r"},"un":{"box":[124,346,159,371],"sample":"UN"},"kg":{"box":[117,339,159,369],"sample":"/KG"},"strike":[24,272,179,368]},"por":{"integer":{"box":[383,282,486,460],"sample":"9"},"cents":{"box":[494,282,573,344],"sample":",99"},"label":{"box":[294,281,377,381],"sample":"POR\rR$\r"},"un":{"box":[505,411,572,460],"sample":"UN"},"kg":{"box":[491,402,574,462],"sample":"/KG"}}},{"digits":2,"width":706,"height":468,"guides":[[25.0,0],[681.0,0],[25.0,1],[443.0,1]],"product":{"box":[25,25,462,150],"sample":"Lorem ipsum\rdolor sit amet"},"de":{"integer":{"box":[62,266,171,356],"sample":"99"},"cents":{"box":[174,265,214,297],"sample":",99"},"label":{"box":[25,265,55,320],"sample":"DE\rR$\r"},"un":{"box":[179,331,214,356],"sample":"UN"},"kg":{"box":[172,328,214,358],"sample":"/KG"},"strike":[32,258,216,355]},"por":{"integer":{"box":[376,266,593,444],"sample":"99"},"cents":{"box":[601,266,680,328],"sample":",99"},"label":{"box":[286,266,369,366],"sample":"POR\rR$\r"},"un":{"box":[612,394,679,443],"sample":"UN"},"kg":{"box":[598,388,681,448],"sample":"/KG"}}}];

    function trim(value) { return String(value).replace(/^\s+|\s+$/g, ""); }
    function px(value) { return new UnitValue(value, "px"); }
    function message(error) {
        return error && error.message ? error.message : String(error);
    }
    function bounds(layer) {
        var b = layer.bounds;
        return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")];
    }
    function moveBy(layer, dx, dy) {
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) layer.translate(px(dx), px(dy));
    }
    function setText(layer, value) {
        if (layer.textItem.contents === value) return;
        var name = layer.name;
        layer.textItem.contents = value;
        if (layer.name !== name) layer.name = name;
    }
    function direct(parent, name, group) {
        var i, layer, found = null;
        for (i = 0; i < parent.layers.length; i++) {
            layer = parent.layers[i];
            if (trim(layer.name) === trim(name) && (layer.typename === "LayerSet") === group) {
                if (found) throw new Error("Há duas camadas chamadas " + name + " no mesmo grupo.");
                found = layer;
            }
        }
        if (!found) throw new Error("Não encontrei a camada/grupo " + name + ".\nAbra um dos dois PSDs de texto originais, ou uma cópia com a mesma estrutura.");
        return found;
    }
    function collect(document) {
        function priceBlock(name, label, hasStrike) {
            var group = direct(document, name, true);
            var block = {group: group,
                integer: direct(group, "VALOR PROM", false),
                cents: direct(group, "VALOR PROM CENT", false),
                label: direct(group, label, false),
                un: direct(group, "UN", false),
                kg: direct(group, "/KG", false)};
            if (hasStrike) block.strike = direct(group, "Forma 1", false);
            return block;
        }
        var refs = {product: direct(document, "PRODUTO", false),
            de: priceBlock("VALOR NORM", "DE R$", true),
            por: priceBlock("VALOR PROM", "POR R$", false)};
        var textLayers = [refs.product, refs.de.integer, refs.de.cents, refs.de.label, refs.de.un, refs.de.kg,
            refs.por.integer, refs.por.cents, refs.por.label, refs.por.un, refs.por.kg];
        var editable = textLayers.concat([refs.de.group, refs.por.group, refs.de.strike]);
        var i;
        for (i = 0; i < textLayers.length; i++) {
            if (textLayers[i].kind !== LayerKind.TEXT) throw new Error("A camada " + textLayers[i].name + " precisa ser texto editável.");
        }
        for (i = 0; i < editable.length; i++) {
            if (editable[i].allLocked || editable[i].positionLocked) {
                throw new Error("Desbloqueie a camada/grupo " + editable[i].name + " antes de aplicar.");
            }
        }
        return refs;
    }
    function ensureFont() {
        try { app.fonts.getByName(FONT); }
        catch (error) { throw new Error("Ative a fonte SF Pro Condensed Semibold para manter a aparência dos modelos ao editar."); }
    }

    function parsePrice(input, label, optional, digits) {
        input = trim(input).replace(/^R\$\s*/i, "");
        if (!input && optional) return null;
        var match = /^(\d{1,2})(?:[,.](\d{1,2}))?$/.exec(input);
        if (!match) throw new Error("Informe um preço " + label + " entre 0,00 e 99,99. Exemplo: 8,90.");
        var integer = String(parseInt(match[1], 10)), cents = match[2] || "00";
        if (integer.length > digits) throw new Error("O preço " + label + " tem dois dígitos. Selecione o modelo Dois dígitos.");
        if (cents.length === 1) cents += "0";
        return {integer: integer, cents: "," + cents};
    }
    function parseUnit(input, label) {
        var unit = trim(input).toUpperCase();
        if (!unit || unit.length > 8 || /[\r\n\t]/.test(unit)) {
            throw new Error("Informe uma unidade " + label + " com até 8 caracteres. Exemplos: UN, /KG, CX.");
        }
        if (unit === "KG") unit = "/KG";
        if (unit === "L") unit = "/L";
        return unit;
    }
    function parseData(layout, product, de, por, unitDe, unitPor, guides) {
        var data = {product: trim(product).replace(/\r\n|\n/g, "\r"), guides: guides};
        if (!data.product) throw new Error("Preencha o nome do produto.");
        data.de = parsePrice(de, "DE", true, layout.digits);
        data.por = parsePrice(por, "POR", false, layout.digits);
        data.unitDe = data.de ? parseUnit(unitDe, "DE") : "";
        data.unitPor = parseUnit(unitPor, "POR");
        return data;
    }
    function currentUnit(block) {
        if (block.un.visible) return block.un.textItem.contents;
        if (block.kg.visible) return block.kg.textItem.contents;
        return "UN";
    }
    function currentPrice(block) {
        return trim(block.integer.textItem.contents) + trim(block.cents.textItem.contents);
    }
    function inferLayout(document, refs) {
        if (Math.abs(document.width.as("px") - 706) < 1) return 1;
        if (Math.abs(document.width.as("px") - 597) < 1) return 0;
        return trim(refs.por.integer.textItem.contents).length > 1 ? 1 : 0;
    }

    // Calibra com o texto original: evita acumular reducoes de tamanho quando
    // uma unidade longa ou um nome longo volta a ser curto na proxima execucao.
    function normalizeText(layer, spec) {
        layer.visible = true;
        setText(layer, spec.sample);
        var b = bounds(layer), width = b[2] - b[0], height = b[3] - b[1];
        var expectedW = spec.box[2] - spec.box[0], expectedH = spec.box[3] - spec.box[1];
        if (width <= 0 || height <= 0) throw new Error("A camada não tem conteúdo visível: " + layer.name);
        if (Math.abs(width - expectedW) > 1 || Math.abs(height - expectedH) > 1) {
            layer.resize(expectedW / width * 100, expectedH / height * 100, AnchorPosition.TOPLEFT);
            b = bounds(layer);
        }
        moveBy(layer, spec.box[0] - b[0], spec.box[1] - b[1]);
    }
    function fillAnchored(layer, spec, value, right) {
        normalizeText(layer, spec);
        if (value === spec.sample && !right) return;
        setText(layer, value);
        var b = bounds(layer);
        moveBy(layer, right ? spec.box[2] - b[2] : spec.box[0] - b[0], 0);
    }
    function fitText(layer, box, anchorRight, anchorBottom) {
        var b = bounds(layer), width = b[2] - b[0], height = b[3] - b[1];
        if (width <= 0 || height <= 0) throw new Error("Texto sem conteúdo visível: " + layer.name);
        var scale = Math.min(1, (box[2] - box[0]) / width, (box[3] - box[1]) / height);
        if (scale < 0.999) {
            layer.resize(scale * 100, scale * 100, AnchorPosition.TOPLEFT);
            b = bounds(layer);
        }
        moveBy(layer, anchorRight ? box[2] - b[2] : box[0] - b[0], anchorBottom ? box[3] - b[3] : box[1] - b[1]);
    }
    function placeStrike(layer, box) {
        layer.visible = true;
        var b = bounds(layer), w = b[2] - b[0], h = b[3] - b[1];
        if (w <= 0 || h <= 0) throw new Error("O risco do preço DE está vazio.");
        if (Math.abs(w - (box[2] - box[0])) > 1 || Math.abs(h - (box[3] - box[1])) > 1) {
            layer.resize((box[2] - box[0]) / w * 100, (box[3] - box[1]) / h * 100, AnchorPosition.TOPLEFT);
            b = bounds(layer);
        }
        moveBy(layer, box[0] - b[0], box[1] - b[1]);
    }
    function placePrice(refs, spec, price, unit) {
        refs.group.visible = true;
        fillAnchored(refs.label, spec.label, spec.label.sample, false);
        fillAnchored(refs.integer, spec.integer, price ? price.integer : spec.integer.sample, true);
        fillAnchored(refs.cents, spec.cents, price ? price.cents : spec.cents.sample, false);
        normalizeText(refs.un, spec.un);
        normalizeText(refs.kg, spec.kg);
        var useKg = unit.charAt(0) === "/", selected = useKg ? refs.kg : refs.un;
        var selectedSpec = useKg ? spec.kg : spec.un;
        if (price) {
            setText(selected, unit);
            fitText(selected, selectedSpec.box, true, true);
        }
        refs.un.visible = !useKg;
        refs.kg.visible = useKg;
        if (refs.strike) placeStrike(refs.strike, spec.strike);
        refs.group.visible = !!price;
    }
    function readGuides(document) {
        var result = [], i, guide;
        for (i = 0; i < document.guides.length; i++) {
            guide = document.guides[i];
            result.push([guide.coordinate.as("px"), guide.direction === Direction.VERTICAL ? 0 : 1]);
        }
        return result;
    }
    function sameGuides(a, b) {
        if (a.length !== b.length) return false;
        var i, j, used = [], found;
        for (i = 0; i < a.length; i++) {
            found = false;
            for (j = 0; j < b.length; j++) {
                if (!used[j] && a[i][1] === b[j][1] && Math.abs(a[i][0] - b[j][0]) < 0.1) {
                    used[j] = true; found = true; break;
                }
            }
            if (!found) return false;
        }
        return true;
    }
    function replaceGuides(document, guides) {
        if (sameGuides(readGuides(document), guides)) return;
        var i;
        for (i = document.guides.length - 1; i >= 0; i--) document.guides[i].remove();
        for (i = 0; i < guides.length; i++) document.guides.add(guides[i][1] === 0 ? Direction.VERTICAL : Direction.HORIZONTAL, px(guides[i][0]));
    }
    function resizeCanvas(document, width, height) {
        if (Math.abs(document.width.as("px") - width) > 0.1 || Math.abs(document.height.as("px") - height) > 0.1) {
            document.resizeCanvas(px(width), px(height), AnchorPosition.TOPLEFT);
        }
    }
    function applyLayout(document, refs, layout, data) {
        // Primeiro amplia; so recorta depois de trazer os elementos para dentro.
        resizeCanvas(document, Math.max(document.width.as("px"), layout.width), Math.max(document.height.as("px"), layout.height));
        normalizeText(refs.product, layout.product);
        setText(refs.product, data.product);
        fitText(refs.product, [layout.product.box[0], layout.product.box[1], layout.width - 25, layout.product.box[3]], false, false);
        placePrice(refs.de, layout.de, data.de, data.unitDe);
        placePrice(refs.por, layout.por, data.por, data.unitPor);
        resizeCanvas(document, layout.width, layout.height);
        if (data.guides) replaceGuides(document, layout.guides);
    }
    function transaction(document, refs, layout, data) {
        var originalHistory = document.activeHistoryState;
        var originalLayer = document.activeLayer;
        var oldUnits = app.preferences.rulerUnits, oldDialogs = app.displayDialogs;
        var key = "__IBD_EditarTextos_2", hadGlobal = typeof $.global[key] !== "undefined", oldGlobal = $.global[key];
        var capturedError = null, originalGuides;
        try {
            app.preferences.rulerUnits = Units.PIXELS;
            app.displayDialogs = DialogModes.NO;
            originalGuides = readGuides(document);
            $.global[key] = function () {
                try { applyLayout(document, refs, layout, data); }
                catch (error) { capturedError = error; }
            };
            document.suspendHistory("Textos e preços — " + layout.digits + " dígito(s)", '$.global["' + key + '"]()');
            if (capturedError) throw capturedError;
        } catch (error) {
            try {
                document.activeHistoryState = originalHistory;
                if (originalGuides) replaceGuides(document, originalGuides);
            } catch (restoreError) {
                throw new Error(message(error) + "\n\nNão foi possível restaurar tudo automaticamente. Use o painel Histórico antes de salvar.");
            }
            throw new Error(message(error) + "\n\nAs alterações desta execução foram desfeitas.");
        } finally {
            if (hadGlobal) $.global[key] = oldGlobal;
            else delete $.global[key];
            app.preferences.rulerUnits = oldUnits;
            app.displayDialogs = oldDialogs;
            try { document.activeLayer = originalLayer; } catch (ignored) {}
        }
    }

    function dialog(document, refs) {
        var chosen = null;
        var window = new Window("dialog", TITLE);
        window.orientation = "column";
        window.alignChildren = ["fill", "top"];
        window.spacing = 10; window.margins = 16;
        window.add("statictext", undefined, "Documento: " + document.name);
        var selector = window.add("dropdownlist", undefined, ["Um dígito — 597 × 484 px", "Dois dígitos — 706 × 468 px"]);
        selector.selection = inferLayout(document, refs);

        var productPanel = window.add("panel", undefined, "Nome do produto");
        productPanel.orientation = "column"; productPanel.alignChildren = ["fill", "top"]; productPanel.margins = 12;
        var product = productPanel.add("edittext", undefined, refs.product.textItem.contents.replace(/\r/g, "\n"), {multiline: true, wantReturn: true});
        product.preferredSize = [430, 66];
        product.helpTip = "Use Enter para separar as linhas. O texto será ajustado ao espaço do nome.";

        var pricePanel = window.add("panel", undefined, "Preços e unidades");
        pricePanel.orientation = "column"; pricePanel.alignChildren = ["left", "top"]; pricePanel.margins = 12;
        function row(label, price, unit) {
            var group = pricePanel.add("group");
            var caption = group.add("statictext", undefined, label); caption.preferredSize.width = 55;
            var value = group.add("edittext", undefined, price); value.characters = 12;
            group.add("statictext", undefined, "Unidade");
            var unitInput = group.add("edittext", undefined, unit); unitInput.characters = 8;
            unitInput.helpTip = "UN, /KG, /L, CX, PCT ou outra unidade curta.";
            return {price: value, unit: unitInput};
        }
        var de = row("DE R$", refs.de.group.visible ? currentPrice(refs.de) : "", currentUnit(refs.de));
        var por = row("POR R$", currentPrice(refs.por), currentUnit(refs.por));
        pricePanel.add("statictext", undefined, "Deixe DE vazio para ocultar o preço antigo e o risco.");
        var guides = window.add("checkbox", undefined, "Ajustar as guias para o modelo escolhido (margem de 25 px)");
        guides.value = true;
        var note = window.add("statictext", undefined, "Edita o PSD aberto. Uma etapa de desfazer. Salve depois com Cmd+S / Ctrl+S.", {multiline: true});
        note.preferredSize = [450, 34];
        var buttons = window.add("group"); buttons.alignment = ["right", "top"];
        var cancel = buttons.add("button", undefined, "Cancelar", {name: "cancel"});
        var apply = buttons.add("button", undefined, "Aplicar no PSD aberto", {name: "ok"});
        window.defaultElement = apply; window.cancelElement = cancel;
        apply.onClick = function () {
            try {
                var layout = LAYOUTS[selector.selection ? selector.selection.index : 0];
                var data = parseData(layout, product.text, de.price.text, por.price.text, de.unit.text, por.unit.text, guides.value);
                chosen = {layout: layout, data: data};
                window.close(1);
            } catch (error) { alert(message(error), TITLE); }
        };
        cancel.onClick = function () { window.close(0); };
        window.center(); window.show();
        return chosen;
    }

    try {
        if (!app.documents.length) throw new Error("Abra TEXTO UM DIGITO.psd ou TEXTO DOIS DIGITOS.psd antes de executar este script.");
        var document = app.activeDocument;
        var refs = collect(document);
        var choice = dialog(document, refs);
        if (!choice) return;
        ensureFont();
        transaction(document, refs, choice.layout, choice.data);
    } catch (error) { alert(message(error), TITLE); }
}());
