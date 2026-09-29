/**
 * @ibd-id photoshop/criar-textos-precos
 * @ibd-titulo Criar textos e preços em série
 * @ibd-descricao Cria PSDs novos a partir dos modelos de um ou dois dígitos, com nome, preços, rótulos, unidades UN ou /KG, imagens incorporadas ou vinculadas e nome do arquivo. Salva e já abre o próximo.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags ofertas, texto, precos, modelos, lote, imagens
 * @ibd-doc docs/textos-e-precos.md
 */
#target photoshop
/*
 * CRIAR TEXTOS E PRECOS EM SERIE - 1.0.0
 * Arquivo > Scripts > Procurar > este JSX. Nao precisa de documento aberto.
 * Cada arquivo nasce de uma copia do modelo original (texto-um-digito.psd ou
 * texto-dois-digitos.psd): mesma tela, guias, camadas, fontes e distancias.
 * O modelo nunca e regravado; o resultado e salvo com o nome escolhido.
 * "Salvar e criar outro" grava o PSD e reabre a janela com os mesmos dados,
 * pronta para o proximo produto.
 * Imagens entram como Objeto Inteligente incorporado ou vinculado, atras dos
 * textos, sem alterar a geometria do modelo.
 * O motor de geometria e o mesmo do editor rapido 2.0 (editar-textos-precos-rapido.jsx).
 * ES3 / ExtendScript. Verificacao local com DOM simulado; prova visual no Photoshop.
 */
(function () {
    var TITLE = "Criar textos e preços — 1.0";
    var FONT = "SFPro-CondensedSemibold";
    var LAYOUTS = [{"digits":1,"width":597,"height":484,"guides":[[25.0,0],[25.0,1],[572.0,0],[459.0,1]],"product":{"box":[27,39,464,164],"sample":"Lorem ipsum\rdolor sit amet"},"de":{"integer":{"box":[64,281,116,371],"sample":"9"},"cents":{"box":[119,281,159,313],"sample":",99"},"label":{"box":[27,281,57,336],"sample":"DE\rR$\r"},"un":{"box":[124,346,159,371],"sample":"UN"},"kg":{"box":[117,339,159,369],"sample":"/KG"},"strike":[24,272,179,368]},"por":{"integer":{"box":[383,282,486,460],"sample":"9"},"cents":{"box":[494,282,573,344],"sample":",99"},"label":{"box":[294,281,377,381],"sample":"POR\rR$\r"},"un":{"box":[505,411,572,460],"sample":"UN"},"kg":{"box":[491,402,574,462],"sample":"/KG"}}},{"digits":2,"width":706,"height":468,"guides":[[25.0,0],[681.0,0],[25.0,1],[443.0,1]],"product":{"box":[25,25,462,150],"sample":"Lorem ipsum\rdolor sit amet"},"de":{"integer":{"box":[62,266,171,356],"sample":"99"},"cents":{"box":[174,265,214,297],"sample":",99"},"label":{"box":[25,265,55,320],"sample":"DE\rR$\r"},"un":{"box":[179,331,214,356],"sample":"UN"},"kg":{"box":[172,328,214,358],"sample":"/KG"},"strike":[32,258,216,355]},"por":{"integer":{"box":[376,266,593,444],"sample":"99"},"cents":{"box":[601,266,680,328],"sample":",99"},"label":{"box":[286,266,369,366],"sample":"POR\rR$\r"},"un":{"box":[612,394,679,443],"sample":"UN"},"kg":{"box":[598,388,681,448],"sample":"/KG"}}}];
    // Nomes aceitos para os modelos: o do repositorio, o do arquivo recebido e a forma curta.
    var TEMPLATE_NAMES = [
        ["texto-um-digito.psd", "02-TEXTO-UM-DIGITO.psd", "TEXTO UM DIGITO.psd"],
        ["texto-dois-digitos.psd", "01-TEXTO-DOIS-DIGITOS.psd", "TEXTO DOIS DIGITOS.psd"]
    ];
    var FITS = ["Conter na tela", "Preencher a tela", "Tamanho original"];
    var PREFS_KEYS = ["templates", "output", "linked", "fit", "keepOpen", "layout"];

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
                if (found) throw new Error("Há duas camadas chamadas " + name + " no mesmo grupo do modelo.");
                found = layer;
            }
        }
        if (!found) throw new Error("O modelo não tem a camada/grupo " + name + ".\nUse os PSDs originais de texto, ou uma cópia com a mesma estrutura.");
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
            if (textLayers[i].kind !== LayerKind.TEXT) throw new Error("A camada " + textLayers[i].name + " do modelo precisa ser texto editável.");
        }
        for (i = 0; i < editable.length; i++) {
            if (editable[i].allLocked || editable[i].positionLocked) {
                throw new Error("Desbloqueie a camada/grupo " + editable[i].name + " no modelo.");
            }
        }
        return refs;
    }
    function ensureFont() {
        try { app.fonts.getByName(FONT); }
        catch (error) { throw new Error("Ative a fonte SF Pro Condensed Semibold para manter a aparência dos modelos."); }
    }

    /* Dados ------------------------------------------------------------- */

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
    function lines(value) {
        return trim(String(value).replace(/\r\n|\n/g, "\r")).replace(/[ \t]*\r[ \t]*/g, "\r");
    }
    // Os rotulos originais terminam com uma quebra ("DE\rR$\r"); ela e mantida.
    function parseLabel(input, label, sample) {
        var value = lines(input);
        if (!value) throw new Error("Preencha o rótulo " + label + ". O original é " + sample.replace(/\r$/, "").replace(/\r/g, " / ") + ".");
        return value + "\r";
    }
    function parseData(layout, fields) {
        var data = {product: lines(fields.product)};
        if (!data.product) throw new Error("Preencha o nome do produto.");
        data.de = parsePrice(fields.de, "DE", true, layout.digits);
        data.por = parsePrice(fields.por, "POR", false, layout.digits);
        data.unitDe = data.de ? parseUnit(fields.unitDe, "DE") : "";
        data.unitPor = parseUnit(fields.unitPor, "POR");
        data.labelDe = parseLabel(fields.labelDe, "DE", layout.de.label.sample);
        data.labelPor = parseLabel(fields.labelPor, "POR", layout.por.label.sample);
        return data;
    }
    function priceText(value) {
        var match = /^(\d{1,2})(?:[,.](\d{1,2}))?$/.exec(trim(value).replace(/^R\$\s*/i, ""));
        if (!match) return "";
        var cents = match[2] || "00";
        return parseInt(match[1], 10) + "," + (cents.length === 1 ? cents + "0" : cents);
    }
    // Nome sugerido: nome do produto em uma linha + preco POR. Ex.: "Arroz Tipo 1 5kg 19,90".
    function autoFileName(product, por) {
        var name = trim(String(product).replace(/[\r\n]+/g, " ").replace(/\s+/g, " "));
        var price = priceText(por);
        return safeFileName(name + (price ? " " + price : "")) || "texto-preco";
    }
    function safeFileName(value) {
        var name = trim(String(value).replace(/\.psd$/i, "").replace(/[\\\/:\*\?"<>\|\r\n\t]+/g, " ").replace(/\s+/g, " "));
        name = name.replace(/^\.+|\.+$/g, "");
        return name.length > 120 ? trim(name.substr(0, 120)) : name;
    }

    /* Geometria (igual ao editor 2.0) ------------------------------------- */

    // Calibra com o texto original: evita acumular reducoes de tamanho.
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
    function placePrice(refs, spec, price, unit, label) {
        refs.group.visible = true;
        fillAnchored(refs.label, spec.label, label, false);
        if (label !== spec.label.sample) fitText(refs.label, spec.label.box, false, false);
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
        placePrice(refs.de, layout.de, data.de, data.unitDe, data.labelDe);
        placePrice(refs.por, layout.por, data.por, data.unitPor, data.labelPor);
        resizeCanvas(document, layout.width, layout.height);
        replaceGuides(document, layout.guides);
    }

    /* Imagens ------------------------------------------------------------ */

    function placeFile(document, file, linked) {
        // A camada colocada entra logo acima da camada ativa: a do fundo, atras dos textos.
        document.activeLayer = document.layers[document.layers.length - 1];
        var descriptor = new ActionDescriptor();
        descriptor.putPath(charIDToTypeID("null"), file);
        if (linked) descriptor.putBoolean(charIDToTypeID("Lnkd"), true);
        descriptor.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));
        executeAction(charIDToTypeID("Plc "), descriptor, DialogModes.NO);
        return document.activeLayer;
    }
    function fitImage(document, layer, fit) {
        var b = bounds(layer), w = b[2] - b[0], h = b[3] - b[1];
        var W = document.width.as("px"), H = document.height.as("px");
        if (w <= 0 || h <= 0) throw new Error("A imagem colocada está vazia: " + layer.name);
        var scale = fit === 0 ? Math.min(W / w, H / h) : fit === 1 ? Math.max(W / w, H / h) : 1;
        if (Math.abs(scale - 1) > 0.0005) {
            layer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
            b = bounds(layer);
        }
        moveBy(layer, (W - (b[2] - b[0])) / 2 - b[0], (H - (b[3] - b[1])) / 2 - b[1]);
    }
    function placeImages(document, images, linked, fit) {
        var i, file, layer;
        for (i = 0; i < images.length; i++) {
            file = images[i];
            if (!file.exists) throw new Error("A imagem não foi encontrada:\n" + file.fsName);
            try { layer = placeFile(document, file, linked); }
            catch (error) { throw new Error("Não foi possível colocar a imagem " + decodeURI(file.name) + ".\n" + message(error)); }
            layer.name = "IMAGEM - " + decodeURI(file.name).replace(/\.[^.]+$/, "");
            fitImage(document, layer, fit);
        }
    }

    /* Arquivos ----------------------------------------------------------- */

    function findTemplate(folder, index) {
        var order = [index, 1 - index], i, j, file;
        if (!folder || !folder.exists) throw new Error("Escolha a pasta com os modelos texto-um-digito.psd e texto-dois-digitos.psd.");
        for (i = 0; i < order.length; i++) {
            for (j = 0; j < TEMPLATE_NAMES[order[i]].length; j++) {
                file = new File(folder.fsName + "/" + TEMPLATE_NAMES[order[i]][j]);
                if (file.exists) return file;
            }
        }
        throw new Error("Nenhum modelo encontrado em:\n" + folder.fsName + "\n\nA pasta precisa ter texto-um-digito.psd ou texto-dois-digitos.psd.");
    }
    function defaultTemplateFolder() {
        try {
            var folder = new Folder(new File($.fileName).parent.parent.fsName + "/templates/textos-precos");
            return folder.exists ? folder : null;
        } catch (ignored) { return null; }
    }
    function outputFile(folder, name) {
        if (!folder || !folder.exists) throw new Error("Escolha a pasta onde os PSDs serão salvos.");
        var clean = safeFileName(name);
        if (!clean) throw new Error("Preencha o nome do arquivo.");
        return new File(folder.fsName + "/" + clean + ".psd");
    }
    function sameFile(a, b) {
        return String(a.fsName).toLowerCase() === String(b.fsName).toLowerCase();
    }

    function prefsFile() {
        return new File(Folder.userData.fsName + "/IBD/criar-textos-precos.txt");
    }
    function readPrefs() {
        var result = {}, file, line, at;
        try {
            file = prefsFile();
            if (!file.exists || !file.open("r")) return result;
            file.encoding = "UTF-8";
            while (!file.eof) {
                line = file.readln(); at = line.indexOf("=");
                if (at > 0) result[line.substr(0, at)] = line.substr(at + 1);
            }
            file.close();
        } catch (ignored) {}
        return result;
    }
    function writePrefs(state) {
        try {
            var file = prefsFile(), i, key;
            if (!file.parent.exists) file.parent.create();
            file.encoding = "UTF-8";
            if (!file.open("w")) return;
            for (i = 0; i < PREFS_KEYS.length; i++) {
                key = PREFS_KEYS[i];
                file.writeln(key + "=" + String(state[key] === undefined || state[key] === null ? "" : state[key]).replace(/[\r\n]/g, ""));
            }
            file.close();
        } catch (ignored) {}
    }

    // app.open devolveria o documento ja aberto: editar e fechar o modelo do usuario perderia o trabalho dele.
    function ensureClosed(template) {
        for (var i = 0; i < app.documents.length; i++) {
            try {
                if (sameFile(app.documents[i].fullName, template)) throw new Error("Feche o modelo " + decodeURI(template.name) + " no Photoshop antes de criar os arquivos.");
            } catch (error) {
                if (/Feche o modelo/.test(message(error))) throw error;
            }
        }
    }
    function create(job) {
        var template = findTemplate(job.templates, job.layoutIndex);
        if (sameFile(template, job.file)) throw new Error("O arquivo de saída não pode substituir o modelo. Escolha outro nome ou pasta.");
        ensureClosed(template);
        var oldUnits = app.preferences.rulerUnits, oldDialogs = app.displayDialogs;
        var document = null, saved = false;
        try {
            app.preferences.rulerUnits = Units.PIXELS;
            app.displayDialogs = DialogModes.NO;
            document = app.open(template);
            applyLayout(document, collect(document), job.layout, job.data);
            placeImages(document, job.images, job.linked, job.fit);
            var options = new PhotoshopSaveOptions();
            options.layers = true;
            options.embedColorProfile = true;
            options.alphaChannels = true;
            options.annotations = true;
            options.spotColors = true;
            document.saveAs(job.file, options, false, Extension.LOWERCASE);
            saved = true;
        } finally {
            if (document && (!saved || !job.keepOpen)) {
                try { document.close(SaveOptions.DONOTSAVECHANGES); } catch (ignored) {}
            }
            app.preferences.rulerUnits = oldUnits;
            app.displayDialogs = oldDialogs;
        }
        return job.file;
    }

    /* Janela ------------------------------------------------------------- */

    function initialState() {
        var prefs = readPrefs(), layout = LAYOUTS[0];
        var templates = prefs.templates ? new Folder(prefs.templates) : null;
        if (!templates || !templates.exists) templates = defaultTemplateFolder();
        var output = prefs.output ? new Folder(prefs.output) : null;
        return {layoutIndex: prefs.layout === "1" ? 1 : 0,
            product: layout.product.sample.replace(/\r/g, "\n"),
            de: "", por: "9,99", unitDe: "UN", unitPor: "UN",
            labelDe: "DE\nR$", labelPor: "POR\nR$",
            fileName: "", manualName: false,
            images: [], linked: prefs.linked === "true", fit: prefs.fit ? Math.max(0, Math.min(2, parseInt(prefs.fit, 10) || 0)) : 0,
            keepOpen: prefs.keepOpen === "true",
            templates: templates, output: output && output.exists ? output : null, status: ""};
    }
    function folderText(folder) { return folder ? folder.fsName : "(escolher)"; }

    // Mostra a janela e devolve {action: "next"|"close", job, state} ou null ao cancelar.
    function dialog(state) {
        var chosen = null;
        var images = state.images.slice(0);
        var manualName = state.manualName;
        var window = new Window("dialog", TITLE);
        window.orientation = "column";
        window.alignChildren = ["fill", "top"];
        window.spacing = 8; window.margins = 14;
        if (state.status) window.add("statictext", undefined, state.status);

        var top = window.add("group");
        top.add("statictext", undefined, "Modelo");
        var selector = top.add("dropdownlist", undefined, ["Um dígito — 597 × 484 px", "Dois dígitos — 706 × 468 px"]);
        selector.selection = state.layoutIndex;

        var productPanel = window.add("panel", undefined, "Nome do produto");
        productPanel.orientation = "column"; productPanel.alignChildren = ["fill", "top"]; productPanel.margins = 10;
        var product = productPanel.add("edittext", undefined, state.product, {multiline: true, wantReturn: true});
        product.preferredSize = [470, 60];
        product.helpTip = "Use Enter para separar as linhas. O texto é ajustado ao espaço do nome.";

        var pricePanel = window.add("panel", undefined, "Preços, rótulos e unidades");
        pricePanel.orientation = "column"; pricePanel.alignChildren = ["left", "top"]; pricePanel.margins = 10;
        function row(caption, price, unit, labelText) {
            var group = pricePanel.add("group");
            var title = group.add("statictext", undefined, caption); title.preferredSize.width = 34;
            var value = group.add("edittext", undefined, price); value.characters = 7;
            group.add("statictext", undefined, "Unidade");
            var unitInput = group.add("edittext", undefined, unit); unitInput.characters = 6;
            unitInput.helpTip = "UN, /KG, /L, CX, PCT ou outra unidade curta.";
            var un = group.add("button", undefined, "UN"); un.preferredSize = [40, 22];
            var kg = group.add("button", undefined, "/KG"); kg.preferredSize = [44, 22];
            un.onClick = function () { unitInput.text = "UN"; };
            kg.onClick = function () { unitInput.text = "/KG"; };
            group.add("statictext", undefined, "Rótulo");
            var label = group.add("edittext", undefined, labelText); label.characters = 8;
            label.helpTip = "Texto do rótulo. Use / para quebrar a linha: POR / R$.";
            return {price: value, unit: unitInput, label: label};
        }
        var de = row("DE", state.de, state.unitDe, state.labelDe.replace(/\n/g, " / "));
        var por = row("POR", state.por, state.unitPor, state.labelPor.replace(/\n/g, " / "));
        pricePanel.add("statictext", undefined, "DE vazio oculta o preço antigo e o risco. KG vira /KG.");

        var imagePanel = window.add("panel", undefined, "Imagens (opcional, atrás dos textos)");
        imagePanel.orientation = "column"; imagePanel.alignChildren = ["fill", "top"]; imagePanel.margins = 10;
        var list = imagePanel.add("listbox", undefined, [], {multiselect: false});
        list.preferredSize = [470, 64];
        function refreshList() {
            if (list.items && list.items.length) list.removeAll();
            for (var i = 0; i < images.length; i++) list.add("item", decodeURI(images[i].name));
        }
        refreshList();
        var imageButtons = imagePanel.add("group");
        var addImage = imageButtons.add("button", undefined, "Adicionar…");
        var removeImage = imageButtons.add("button", undefined, "Remover");
        var clearImages = imageButtons.add("button", undefined, "Limpar");
        var modeGroup = imagePanel.add("group");
        var embedded = modeGroup.add("radiobutton", undefined, "Incorporado");
        var linked = modeGroup.add("radiobutton", undefined, "Vinculado");
        embedded.value = !state.linked; linked.value = state.linked;
        modeGroup.add("statictext", undefined, "Ajuste");
        var fit = modeGroup.add("dropdownlist", undefined, FITS);
        fit.selection = state.fit;
        addImage.onClick = function () {
            var picked = File.openDialog("Escolha as imagens", "Imagens:*.psd;*.psb;*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.webp;*.ai;*.eps;*.pdf;*.svg,Todos:*.*", true);
            if (!picked) return;
            if (!(picked instanceof Array)) picked = [picked];
            for (var i = 0; i < picked.length; i++) images.push(picked[i]);
            refreshList();
        };
        removeImage.onClick = function () {
            if (!list.selection) return;
            images.splice(list.selection.index, 1);
            refreshList();
        };
        clearImages.onClick = function () { images = []; refreshList(); };

        var filePanel = window.add("panel", undefined, "Arquivo");
        filePanel.orientation = "column"; filePanel.alignChildren = ["fill", "top"]; filePanel.margins = 10;
        var nameRow = filePanel.add("group");
        nameRow.add("statictext", undefined, "Nome");
        var fileName = nameRow.add("edittext", undefined, state.fileName || autoFileName(state.product, state.por));
        fileName.characters = 38;
        nameRow.add("statictext", undefined, ".psd");
        var autoName = nameRow.add("button", undefined, "Auto");
        autoName.helpTip = "Volta a gerar o nome a partir do produto e do preço POR.";
        function updateName() { if (!manualName) fileName.text = autoFileName(product.text, por.price.text); }
        product.onChanging = updateName;
        por.price.onChanging = updateName;
        fileName.onChanging = function () { manualName = trim(fileName.text) !== ""; };
        autoName.onClick = function () { manualName = false; updateName(); };

        var templates = state.templates, output = state.output;
        function folderRow(caption, current, prompt, assign) {
            var group = filePanel.add("group");
            var title = group.add("statictext", undefined, caption); title.preferredSize.width = 60;
            var text = group.add("statictext", undefined, folderText(current), {truncate: "middle"});
            text.preferredSize.width = 330;
            var browse = group.add("button", undefined, "Escolher…");
            browse.onClick = function () {
                var folder = Folder.selectDialog(prompt);
                if (folder) { assign(folder); text.text = folderText(folder); }
            };
        }
        folderRow("Salvar em", output, "Pasta onde os PSDs serão salvos", function (f) { output = f; });
        folderRow("Modelos", templates, "Pasta com texto-um-digito.psd e texto-dois-digitos.psd", function (f) { templates = f; });
        var keepOpen = filePanel.add("checkbox", undefined, "Deixar o PSD aberto depois de salvar");
        keepOpen.value = state.keepOpen;

        var buttons = window.add("group"); buttons.alignment = ["right", "top"];
        var cancel = buttons.add("button", undefined, "Fechar", {name: "cancel"});
        var saveClose = buttons.add("button", undefined, "Salvar e fechar");
        var saveNext = buttons.add("button", undefined, "Salvar e criar outro", {name: "ok"});
        window.defaultElement = saveNext; window.cancelElement = cancel;

        function snapshot() {
            return {layoutIndex: selector.selection ? selector.selection.index : 0,
                product: product.text, de: de.price.text, por: por.price.text,
                unitDe: de.unit.text, unitPor: por.unit.text,
                labelDe: de.label.text.replace(/\s*\/\s*/g, "\n"), labelPor: por.label.text.replace(/\s*\/\s*/g, "\n"),
                fileName: fileName.text, manualName: manualName, images: images,
                linked: linked.value, fit: fit.selection ? fit.selection.index : 0, keepOpen: keepOpen.value,
                templates: templates, output: output, status: ""};
        }
        function submit(action) {
            try {
                var current = snapshot(), layout = LAYOUTS[current.layoutIndex];
                var data = parseData(layout, current);
                var file = outputFile(current.output, current.fileName);
                findTemplate(current.templates, current.layoutIndex);
                if (file.exists && !confirm("Já existe " + decodeURI(file.name) + " nesta pasta.\nSubstituir?", true, TITLE)) return;
                chosen = {action: action, state: current, job: {layout: layout, layoutIndex: current.layoutIndex, data: data,
                    file: file, templates: current.templates, images: current.images, linked: current.linked,
                    fit: current.fit, keepOpen: current.keepOpen}};
                window.close(1);
            } catch (error) { alert(message(error), TITLE); }
        }
        saveNext.onClick = function () { submit("next"); };
        saveClose.onClick = function () { submit("close"); };
        cancel.onClick = function () { window.close(0); };
        window.center(); window.show();
        return chosen;
    }
    // Depois de salvar: mesmos dados e pastas, imagens limpas e nome volta a ser automatico.
    function nextState(state, savedFile) {
        var next = {}, key;
        for (key in state) if (state.hasOwnProperty(key)) next[key] = state[key];
        next.images = [];
        next.fileName = "";
        next.manualName = false;
        next.status = "Salvo: " + decodeURI(savedFile.name) + ". Edite os dados do próximo arquivo.";
        return next;
    }
    function prefsOf(state) {
        return {templates: state.templates ? state.templates.fsName : "", output: state.output ? state.output.fsName : "",
            linked: state.linked, fit: state.fit, keepOpen: state.keepOpen, layout: state.layoutIndex};
    }
    function run(state) {
        var count = 0, choice, saved;
        while (true) {
            choice = dialog(state);
            if (!choice) break;
            writePrefs(prefsOf(choice.state));
            try {
                ensureFont();
                saved = create(choice.job);
                count++;
            } catch (error) {
                alert(message(error) + "\n\nNada foi salvo. Corrija e tente de novo.", TITLE);
                state = choice.state;
                state.status = "O último arquivo não foi salvo.";
                continue;
            }
            if (choice.action === "close") break;
            state = nextState(choice.state, saved);
        }
        return count;
    }

    try {
        run(initialState());
    } catch (error) { alert(message(error), TITLE); }
}());
