/**
 * @ibd-id photoshop/gerar-ofertas-preto-dourado
 * @ibd-titulo Ofertas preto e dourado
 * @ibd-descricao Cria ofertas em story 1080×1920 ou horizontal 1920×1080 com textos, formas vetoriais, guias e cinco imagens. No layout aberto, edita só os elementos alterados, em um passo de histórico.
 * @ibd-app photoshop
 * @ibd-versao 2.0.0
 * @ibd-tags ofertas, layout, textos, imagens, varejo, guias
 * @ibd-doc apps/photoshop/docs/ofertas-preto-dourado.md
 */
#target photoshop
/*
 * Modelos medidos dos PDFs ADS (1080x1920) e VT (1920x1080) do cliente.
 * ES3 / ScriptUI. Sem includes, rede, gravacao de preferencias ou saveAs.
 * Nada vira pixel: textos editaveis, formas vetoriais (camadas de forma),
 * degrade como camada de preenchimento e imagens como objetos inteligentes.
 * Nomes seguem docs/padrao-nomenclatura-camadas.md.
 */
(function () {
    var TITLE = "DESIGNPROD — Ofertas preto e dourado";
    var ROOT = "DP_OFERTAS_V2";
    var GOLD = "F5BE2E", WHITE = "FFFFFF", BLACK = "000000", AREA_COLOR = "00B4FF";
    var SECTIONS = ["02_OFERTA_01", "03_OFERTA_02", "04_OFERTA_03"];
    var PARTS = [["IMAGEM", "image"], ["NOME", "title"], ["COMPLEMENTO", "note"], ["PRECO_DE", "de"], ["PRECO_POR", "por"], ["SELO", "tag"]];
    // Degradê comum aos dois modelos: preto até "start", dourado em "end".
    var GRADIENT = [[0, "171717"], [0.25, "1D1C19"], [0.49, "393020"], [0.75, "73582F"], [1, "AD8140"]];
    var FORMATS = {
        STORY: {
            id:"STORY", label:"Story 1080 × 1920 (ADS)", width:1080, height:1920, gradient:[0.57, 0.875],
            logo:[830,140,190,160], campaign:[110,1625,340,280],
            footer:{box:[486,1748,470,70], align:"left", sizes:[17,25,17,17], lead:24},
            frame:null,
            main:{divider:[241.5,701,2.5,372], image:[290,255,500,420], title:[263,725,577,100], titleSize:56,
                  note:[263,828,577,24], noteSize:22, de:[263,858,190,90], por:[506,856,336,192], tag:[852,705,23,190]},
            card:{boxes:[[250,1114,580,238],[250,1385,580,238]], radius:18, stroke:2.5, divider:null,
                  image:[28,20,200,198], title:[265,36,240,52], titleSize:25, note:[265,90,240,14], noteSize:13,
                  de:[265,110,66,50], por:[372,106,130,98], tag:[588,36,23,166]},
            guides:{v:[110,242,250,263,515,830,1020], h:[140,701,1073,1114,1352,1385,1623,1748,1905]}
        },
        VT: {
            id:"VT", label:"Horizontal 1920 × 1080 (VT)", width:1920, height:1080, gradient:[0.27, 1],
            logo:[1610,120,200,170], campaign:[1445,700,405,340],
            footer:{box:[191,1005,1215,28], align:"center", sizes:[17,24,17,17], lead:24},
            frame:{box:[95,107,1730,745], radius:70, stroke:2.5, gap:[191,1406]},
            main:{divider:[846,185,4,457], image:[340,195,440,440], title:[966,195,560,145], titleSize:80,
                  note:[966,345,560,34], noteSize:28, de:[966,443,152,97], por:[1235,443,280,187], tag:[1540,443,23,190]},
            card:{boxes:[[191,734,579,241],[828,734,578,241]], radius:14, stroke:2.5, divider:[250,31,2,182],
                  image:[15,30,225,185], title:[280,35,285,60], titleSize:29, note:[280,97,285,18], noteSize:15,
                  de:[280,133,72,45], por:[390,128,165,82], tag:[587,38,23,166]},
            guides:{v:[95,191,340,846,966,1406,1825], h:[107,185,443,642,734,852,975,1005]}
        }
    };
    var DEFAULTS = {
        STORY: {
            before:"OFERTAS VÁLIDAS EM TODAS AS UNIDADES DO +B SUPERMERCADOS\rDE", dates:"22 A 24.09.2026",
            after:"OU ENQUANTO DURAR O ESTOQUE.", last:"IMAGENS MERAMENTE ILUSTRATIVAS.",
            offers:[
                {name:"CARNE BOVINA TRASEIRA\rPATINHO KG", note:"", de:"49,85", por:"42,99", unitDe:"/KG", unitPor:"/KG", alcohol:false},
                {name:"CERVEJA SKOL\rLT 350 ML", note:"", de:"3,55", por:"3,19", unitDe:"UN", unitPor:"UN", alcohol:true},
                {name:"ENERGÉTICO RED BULL\rTRADICIONAL 250 ML", note:"", de:"8,59", por:"7,99", unitDe:"UN", unitPor:"UN", alcohol:false}
            ]
        },
        VT: {
            before:"OFERTAS VÁLIDAS EM TODAS AS UNIDADES DO +B SUPERMERCADOS DE", dates:"25 A 28.09.2026",
            after:"OU ENQUANTO DURAR O ESTOQUE. IMAGENS MERAMENTE ILUSTRATIVAS.", last:"",
            offers:[
                {name:"AÇÚCAR TRITURADO\rCAUAXÍ 1 KG", note:"", de:"3,15", por:"2,89", unitDe:"UN", unitPor:"UN", alcohol:false},
                {name:"ÁGUA SANITÁRIA\rQ-BOA 1 L", note:"", de:"3,97", por:"3,59", unitDe:"UN", unitPor:"UN", alcohol:false},
                {name:"AMACIANTE DOWNY\r500 ML", note:"(FRAGRÂNCIAS)", de:"13,45", por:"10,49", unitDe:"UN", unitPor:"UN", alcohol:false}
            ]
        }
    };

    function trim(v) { return String(v).replace(/^\s+|\s+$/g, ""); }
    function nl(v) { return String(v).replace(/\r\n|\n/g, "\r"); }
    function px(v) { return new UnitValue(v, "px"); }
    function cTID(s) { return charIDToTypeID(s); }
    function sTID(s) { return stringIDToTypeID(s); }
    function color(hex) { var c = new SolidColor(); c.rgb.hexValue = hex; return c; }
    function errorText(e) { return e && e.message ? e.message : String(e); }
    function bounds(layer) {
        var b = layer.bounds;
        return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")];
    }
    function rectOf(layer) { var b = bounds(layer); return [b[0], b[1], b[2]-b[0], b[3]-b[1]]; }
    function direct(parent, name, optional) {
        var hit = null, i;
        for (i = 0; i < parent.layers.length; i++) {
            if (parent.layers[i].name === name) {
                if (hit) throw new Error("Nome duplicado: " + name + ". Corrija a estrutura antes de carregar os dados.");
                hit = parent.layers[i];
            }
        }
        if (!hit && !optional) throw new Error("Camada ausente: " + name + ". Use um layout gerado por este script.");
        return hit;
    }
    function txt(parent, name) {
        var l = direct(parent, name);
        if (l.kind !== LayerKind.TEXT) throw new Error(name + " precisa continuar sendo texto editável.");
        return l.textItem.contents;
    }
    function parsePrice(input, optional, label) {
        input = trim(input).replace(/^R\$\s*/i, "");
        if (!input && optional) return null;
        var m = /^(\d{1,4})(?:[,.](\d{1,2}))?$/.exec(input);
        if (!m) throw new Error(label + ": informe de 0,00 a 9999,99, sem separador de milhar.");
        var cents = m[2] || "00";
        if (cents.length === 1) cents += "0";
        return {integer:String(parseInt(m[1], 10)), cents:"," + cents};
    }
    function priceKey(p) { return p ? p.integer + p.cents : ""; }
    function sourcePriceKey(v) { try { return priceKey(parsePrice(v, true, "")); } catch (e) { return "?" + v; } }
    function unit(v, label) {
        v = trim(v).toUpperCase();
        if (!v || v.length > 8 || /[\r\n\t]/.test(v)) throw new Error(label + ": unidade de 1 a 8 caracteres.");
        return v === "KG" || v === "L" ? "/" + v : v;
    }
    function dimension(v, label) {
        if (!/^\d+$/.test(trim(v))) throw new Error(label + " deve ser um número inteiro em pixels.");
        v = Number(v);
        if (v < 640 || v > 7680) throw new Error(label + " deve ficar entre 640 e 7680 px.");
        return v;
    }
    // Lê em Units.PIXELS: com réguas em cm, doc.width.as("px") pode converter
    // pela base de 72 ppi e, num PSD de 300 ppi, devolver 4,17 vezes menos.
    function pixelSize(doc) {
        var old = app.preferences.rulerUnits;
        try {
            app.preferences.rulerUnits = Units.PIXELS;
            return [Math.round(doc.width.as("px")), Math.round(doc.height.as("px"))];
        } finally { app.preferences.rulerUnits = old; }
    }
    function formatFor(width, height) { return height > width ? FORMATS.STORY : FORMATS.VT; }
    function defaults(fmt) {
        var d = DEFAULTS[fmt.id], out = {format:fmt.id, width:fmt.width, height:fmt.height, font:"", fontSupport:"",
            before:d.before, dates:d.dates, after:d.after, last:d.last, offers:[]}, i, o;
        for (i = 0; i < 3; i++) {
            o = d.offers[i];
            out.offers.push({name:o.name, note:o.note, de:o.de, por:o.por, unitDe:o.unitDe, unitPor:o.unitPor,
                labelDe:"DE\rR$", labelPor:"POR\rR$", alcohol:o.alcohol});
        }
        return out;
    }

    function readSource(doc) {
        var root = direct(doc, ROOT, true);
        if (!root) return null;
        var size = pixelSize(doc), fmt = formatFor(size[0], size[1]);
        var data = defaults(fmt), images = [], i, o, g, old, cur, selo;
        data.width = size[0]; data.height = size[1];
        for (i = 0; i < 3; i++) {
            g = direct(root, SECTIONS[i]); old = direct(g, "PRECO_DE"); cur = direct(g, "PRECO_POR");
            o = data.offers[i];
            o.name = txt(g, "TXT_NOME"); o.note = trim(txt(g, "TXT_COMPLEMENTO"));
            o.de = old.visible ? txt(old, "TXT_REAIS") + txt(old, "TXT_CENTAVOS") : "";
            o.por = txt(cur, "TXT_REAIS") + txt(cur, "TXT_CENTAVOS");
            o.unitDe = txt(old, "TXT_UNIDADE"); o.unitPor = txt(cur, "TXT_UNIDADE");
            o.labelDe = txt(old, "TXT_ROTULO"); o.labelPor = txt(cur, "TXT_ROTULO");
            selo = direct(g, "SELO_MODERACAO", true);
            o.alcohol = !!(selo && selo.visible);
            images[i] = direct(g, "IMG_PRODUTO", true);
        }
        data.font = direct(direct(root, SECTIONS[0]), "TXT_NOME").textItem.font;
        g = direct(root, "06_RODAPE");
        data.fontSupport = direct(g, "TXT_AVISO_ANTES").textItem.font;
        data.before = trim(txt(g, "TXT_AVISO_ANTES")); data.dates = trim(txt(g, "TXT_VALIDADE"));
        data.after = trim(txt(g, "TXT_AVISO_DEPOIS")); data.last = trim(txt(g, "TXT_AVISO_FINAL"));
        images[3] = direct(direct(root, "01_MARCA"), "IMG_LOGO", true);
        images[4] = direct(direct(root, "05_CAMPANHA"), "IMG_CAMPANHA", true);
        return {doc:doc, root:root, fmt:fmt, data:data, images:images};
    }

    function fonts() {
        var list = [], i;
        if (app.fonts) for (i = 0; i < app.fonts.length; i++) list.push({name:app.fonts[i].name, id:app.fonts[i].postScriptName});
        list.sort(function (a,b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        return list;
    }
    function preferredFont(list, choices) {
        var i, j;
        for (i = 0; i < choices.length; i++) for (j = 0; j < list.length; j++) if (choices[i] === list[j].id) return j;
        return 0;
    }
    function form(source) {
        var fmt = source ? source.fmt : FORMATS.STORY, data = source ? source.data : defaults(fmt);
        var list = fonts(), labels = [], i, controls = [], imageControls = [];
        var w = new Window("dialog", TITLE);
        w.orientation = "column"; w.alignChildren = ["fill","top"]; w.spacing = 10; w.margins = 16;
        var modeRow = w.add("group"); modeRow.add("statictext", undefined, "Resultado");
        var mode = modeRow.add("dropdownlist", undefined, source ?
            ["Editar no documento aberto — só o que mudar", "Nova cópia reconstruída", "Novo layout"] : ["Novo layout"]);
        mode.selection = 0;
        var explanation = w.add("statictext", undefined, "", {multiline:true});
        explanation.preferredSize = [660, 34];
        var tabs = w.add("tabbedpanel"); tabs.preferredSize = [680,500];
        function tab(title) {
            var t = tabs.add("tab", undefined, title); t.orientation = "column"; t.alignChildren = ["fill","top"]; t.margins = 16; t.spacing = 8; return t;
        }
        function field(parent, label, value, multi) {
            var r = parent.add("group"); r.alignChildren = ["left","top"];
            var l = r.add("statictext", undefined, label); l.preferredSize.width = 150;
            var e = r.add("edittext", undefined, String(value).replace(/\r/g,"\n"), {multiline:!!multi});
            e.preferredSize = [460, multi ? 48 : 25]; return e;
        }
        function imageField(parent, label, index) {
            var p = parent.add("panel", undefined, label); p.alignChildren = ["fill","top"]; p.margins = 12;
            var r = p.add("group"), existing = !!(source && source.images[index]);
            var status = r.add("statictext", undefined, existing ? "Imagem atual será mantida" : "Nenhuma imagem escolhida");
            status.preferredSize.width = 385;
            var pick = r.add("button", undefined, "Escolher…");
            var remove = r.add("button", undefined, "Limpar");
            var c = {file:null, remove:false, existing:existing, status:status}; imageControls[index] = c;
            pick.onClick = function () {
                var f = File.openDialog("Escolha PNG, PSD, PSB, JPG, TIFF ou WebP");
                if (!f) return;
                if (!/\.(png|psd|psb|jpe?g|tiff?|webp)$/i.test(f.name)) { alert("Escolha uma imagem PNG, PSD, PSB, JPG, TIFF ou WebP."); return; }
                c.file = f; c.remove = false; status.text = f.name;
            };
            remove.onClick = function () { c.file = null; c.remove = true; status.text = "Espaço ficará sem imagem"; };
        }
        var general = tab("Geral");
        var formatRow = general.add("group"); formatRow.add("statictext", undefined, "Formato");
        var formatList = formatRow.add("dropdownlist", undefined, [FORMATS.STORY.label, FORMATS.VT.label]);
        formatList.selection = fmt.id === "STORY" ? 0 : 1;
        var size = general.add("group"); size.add("statictext", undefined, "Largura");
        var width = size.add("edittext", undefined, String(data.width)); width.characters = 7;
        size.add("statictext", undefined, "Altura");
        var height = size.add("edittext", undefined, String(data.height)); height.characters = 7;
        size.add("statictext", undefined, "px · RGB, 72 ppi");
        for (i = 0; i < list.length; i++) labels.push(list[i].name + " [" + list[i].id + "]");
        general.add("statictext", undefined, "Fonte principal — nomes, preços, validade e selo");
        var font = general.add("dropdownlist", undefined, labels.length ? labels : ["Nenhuma fonte disponível"]);
        font.selection = preferredFont(list, [data.font, "Oswald-SemiBold", "Oswald-Bold", "BebasNeue-Regular", "RobotoCondensed-Bold", "ArialNarrow-Bold", "Arial-BoldMT"]);
        general.add("statictext", undefined, "Fonte de apoio — textos do rodapé");
        var fontSupport = general.add("dropdownlist", undefined, labels.length ? labels : ["Nenhuma fonte disponível"]);
        fontSupport.selection = preferredFont(list, [data.fontSupport, "RobotoCondensed-Medium", "RobotoCondensed-Regular", "Oswald-Regular", "ArialNarrow", "ArialMT"]);
        var before = field(general, "Rodapé — antes da data", data.before, true);
        var dates = field(general, "Validade (destaque)", data.dates, false);
        var after = field(general, "Depois da data", data.after, false);
        var last = field(general, "Linhas finais", data.last, true);
        general.add("statictext", undefined, "A última linha de \"antes da data\" continua na mesma linha da validade.");
        for (i = 0; i < 3; i++) {
            var t = tab(i === 0 ? "Oferta principal" : "Oferta " + (i+1)), d = data.offers[i], c = {};
            c.name = field(t, "Produto", d.name, true);
            c.note = field(t, "Complemento", d.note, false);
            var prices = t.add("panel", undefined, "Preços — anterior vazio oculta o bloco DE"); prices.alignChildren = ["fill","top"];
            function priceLine(label, value, un, caption) {
                var row = prices.add("group"); row.add("statictext", undefined, label);
                var p = row.add("edittext", undefined, value); p.characters = 9;
                row.add("statictext", undefined, "Unidade"); var u = row.add("edittext", undefined, un); u.characters = 7;
                row.add("statictext", undefined, "Rótulo"); var l = row.add("edittext", undefined, caption.replace(/\r/g,"|")); l.characters = 12;
                return {price:p, unit:u, label:l};
            }
            c.de = priceLine("DE ", d.de, d.unitDe, d.labelDe);
            c.por = priceLine("POR", d.por, d.unitPor, d.labelPor);
            t.add("statictext", undefined, "Rótulos: use | para quebrar linha. Ex.: POR|R$");
            c.alcohol = t.add("checkbox", undefined, "Bebida alcoólica — mostrar o selo BEBA COM MODERAÇÃO");
            c.alcohol.value = !!d.alcohol;
            imageField(t, "Imagem do produto — encaixe proporcional", i);
            controls.push(c);
        }
        var artwork = tab("Marca e campanha");
        imageField(artwork, "Logotipo", 3);
        imageField(artwork, "Campanha / selo promocional", 4);
        artwork.add("statictext", undefined, "Textos que fazem parte dessas imagens continuam incorporados à imagem.");
        function textValues() {
            var v = [before.text, dates.text, after.text, last.text], j;
            for (j = 0; j < 3; j++) v.push(controls[j].name.text, controls[j].note.text, controls[j].de.price.text, controls[j].por.price.text,
                controls[j].de.unit.text, controls[j].por.unit.text, String(controls[j].alcohol.value));
            return nl(v.join("\u0001"));
        }
        function defaultValues(f) {
            var d = DEFAULTS[f.id], v = [d.before, d.dates, d.after, d.last], j;
            for (j = 0; j < 3; j++) v.push(d.offers[j].name, d.offers[j].note, d.offers[j].de, d.offers[j].por,
                d.offers[j].unitDe, d.offers[j].unitPor, String(d.offers[j].alcohol));
            return nl(v.join("\u0001"));
        }
        function currentFormat() { return formatList.selection.index === 0 ? FORMATS.STORY : FORMATS.VT; }
        var shownFormat = currentFormat();
        function modeIndex() { return mode.selection ? mode.selection.index : 0; }
        function isNew() { return !source || modeIndex() === 2; }
        var syncing = false;
        function sync() {
            if (syncing) return;
            syncing = true;
            try { syncFields(); } finally { syncing = false; }
        }
        function syncFields() {
            var creating = isNew(), next = currentFormat(), d, j;
            formatList.enabled = width.enabled = height.enabled = creating;
            if (!creating) {
                formatList.selection = source.fmt.id === "STORY" ? 0 : 1;
                width.text = String(source.data.width); height.text = String(source.data.height);
            } else if (next !== shownFormat) {
                width.text = String(next.width); height.text = String(next.height);
                // Textos ainda iguais ao exemplo do formato anterior trocam pelo exemplo do novo.
                if (textValues() === defaultValues(shownFormat)) {
                    d = DEFAULTS[next.id];
                    before.text = d.before.replace(/\r/g,"\n"); dates.text = d.dates; after.text = d.after; last.text = d.last.replace(/\r/g,"\n");
                    for (j = 0; j < 3; j++) {
                        controls[j].name.text = d.offers[j].name.replace(/\r/g,"\n"); controls[j].note.text = d.offers[j].note;
                        controls[j].de.price.text = d.offers[j].de; controls[j].por.price.text = d.offers[j].por;
                        controls[j].de.unit.text = d.offers[j].unitDe; controls[j].por.unit.text = d.offers[j].unitPor;
                        controls[j].alcohol.value = d.offers[j].alcohol;
                    }
                }
            }
            shownFormat = currentFormat();
            explanation.text = !source ? "Cria um documento novo, sem salvar, com guias, áreas e textos editáveis." :
                modeIndex() === 0 ? "Altera só os elementos cujo valor mudar. O resto do documento, inclusive ajustes manuais, fica como está. Ctrl+Z desfaz tudo de uma vez." :
                modeIndex() === 1 ? "Duplica o documento e reconstrói o grupo " + ROOT + " inteiro. O original não é alterado." :
                "Cria um documento novo com os dados abaixo. Permite trocar formato e tamanho.";
        }
        mode.onChange = sync; formatList.onChange = sync; sync();
        tabs.selection = general;
        var actions = w.add("group"); actions.alignment = "right";
        actions.add("button", undefined, "Cancelar", {name:"cancel"});
        var apply = actions.add("button", undefined, "Aplicar", {name:"ok"}), result = null;
        apply.onClick = function () {
            try {
                var out = {mode:!source ? "new" : ["edit","copy","new"][modeIndex()], format:currentFormat().id,
                    width:dimension(width.text,"Largura"), height:dimension(height.text,"Altura"), offers:[],
                    before:trim(nl(before.text)), dates:trim(nl(dates.text)).replace(/\r/g," "), after:trim(nl(after.text)).replace(/\r/g," "),
                    last:trim(nl(last.text)), images:[]};
                if (!list.length || !font.selection || !fontSupport.selection) throw new Error("Nenhuma fonte disponível. Ative uma fonte no Photoshop.");
                out.font = list[font.selection.index].id; out.fontSupport = list[fontSupport.selection.index].id;
                for (var f = 0; f < 2; f++) {
                    var name = f ? out.fontSupport : out.font;
                    try { app.fonts.getByName(name); }
                    catch (fontError) { throw new Error("Fonte indisponível: " + name + ". Escolha outra fonte instalada."); }
                }
                for (var j = 0; j < 3; j++) {
                    var x = controls[j], label = "Oferta " + (j+1);
                    var de = parsePrice(x.de.price.text,true,label+" / DE");
                    var unitDe = x.de.unit.text, labelDe = nl(x.de.label.text.replace(/\|/g,"\r"));
                    // Sem preço anterior o bloco DE fica oculto: unidade e rótulo
                    // vazios recebem o padrão só para a estrutura continuar recarregável.
                    if (!de && !trim(unitDe)) unitDe = "UN";
                    if (!de && !trim(labelDe)) labelDe = "DE\rR$";
                    var o = {
                        name:nl(trim(x.name.text)), note:nl(trim(x.note.text)),
                        de:de, por:parsePrice(x.por.price.text,false,label+" / POR"),
                        unitDe:unit(unitDe,label+" / DE"), unitPor:unit(x.por.unit.text,label+" / POR"),
                        labelDe:labelDe, labelPor:nl(x.por.label.text.replace(/\|/g,"\r")), alcohol:!!x.alcohol.value
                    };
                    if (!o.name) throw new Error(label + ": preencha o nome do produto.");
                    if (!trim(o.labelDe) || !trim(o.labelPor)) throw new Error(label + ": preencha os rótulos DE e POR.");
                    out.offers.push(o);
                }
                for (j = 0; j < imageControls.length; j++) {
                    var ic = imageControls[j];
                    if (ic.file && !ic.file.exists) throw new Error("Imagem não encontrada: " + ic.file.name);
                    out.images.push({file:ic.file, remove:ic.remove, keep:!!(source && !ic.file && !ic.remove && source.images[j])});
                }
                result = out; w.close(1);
            } catch (e) { alert(errorText(e), TITLE); }
        };
        w.center(); if (w.show() !== 1) return null; return result;
    }

    /* Camadas ------------------------------------------------------------ */

    function sameLayer(a, b) { return !!a && !!b && a.id === b.id; }
    // Coloca a camada no topo do grupo. Formas e objetos nascem acima da
    // camada ativa, que pode estar em outro grupo.
    function adopt(l, parent) {
        if (!parent.layers.length) l.move(parent, ElementPlacement.INSIDE);
        else if (!sameLayer(parent.layers[0], l)) l.move(parent.layers[0], ElementPlacement.PLACEBEFORE);
        return l;
    }
    // Troca uma camada gerenciada mantendo a posição dela na pilha.
    function replace(fresh, old) {
        if (!old) return fresh;
        fresh.move(old, ElementPlacement.PLACEBEFORE);
        old.allLocked = false; old.remove();
        return fresh;
    }
    function group(parent, name) { var g = parent.layerSets.add(); g.name = name; return adopt(g, parent); }
    function rgb(hex) {
        var c = new ActionDescriptor();
        c.putDouble(cTID("Rd  "), parseInt(hex.substr(0,2),16)); c.putDouble(cTID("Grn "), parseInt(hex.substr(2,2),16)); c.putDouble(cTID("Bl  "), parseInt(hex.substr(4,2),16));
        return c;
    }
    function strokeStyle(hex, width, fillEnabled) {
        var s = new ActionDescriptor(), content = new ActionDescriptor();
        s.putInteger(sTID("strokeStyleVersion"), 2);
        s.putBoolean(sTID("strokeEnabled"), true);
        s.putBoolean(sTID("fillEnabled"), fillEnabled);
        s.putUnitDouble(sTID("strokeStyleLineWidth"), cTID("#Pxl"), width);
        s.putEnumerated(sTID("strokeStyleLineAlignment"), sTID("strokeStyleLineAlignment"), sTID("strokeStyleAlignInside"));
        s.putDouble(sTID("strokeStyleOpacity"), 100);
        content.putObject(cTID("Clr "), cTID("RGBC"), rgb(hex));
        s.putObject(sTID("strokeStyleContent"), sTID("solidColorLayer"), content);
        return s;
    }
    // Camada de forma (vetor) retangular, com cantos arredondados opcionais.
    // fill: cor ou null; stroke: {hex, width} ou null. Tudo em px a 72 ppi.
    function shape(doc, parent, name, box, radius, fill, stroke) {
        var d = new ActionDescriptor(), ref = new ActionReference(), l = new ActionDescriptor();
        var solid = new ActionDescriptor(), rect = new ActionDescriptor();
        ref.putClass(sTID("contentLayer")); d.putReference(cTID("null"), ref);
        solid.putObject(cTID("Clr "), cTID("RGBC"), rgb(fill || (stroke ? stroke.hex : BLACK)));
        l.putObject(cTID("Type"), sTID("solidColorLayer"), solid);
        rect.putInteger(sTID("unitValueQuadVersion"), 1);
        rect.putUnitDouble(cTID("Top "), cTID("#Pxl"), box[1]); rect.putUnitDouble(cTID("Left"), cTID("#Pxl"), box[0]);
        rect.putUnitDouble(cTID("Btom"), cTID("#Pxl"), box[1]+box[3]); rect.putUnitDouble(cTID("Rght"), cTID("#Pxl"), box[0]+box[2]);
        if (radius > 0) {
            radius = Math.min(radius, box[2]/2, box[3]/2);
            rect.putUnitDouble(sTID("topRight"), cTID("#Pxl"), radius); rect.putUnitDouble(sTID("topLeft"), cTID("#Pxl"), radius);
            rect.putUnitDouble(sTID("bottomLeft"), cTID("#Pxl"), radius); rect.putUnitDouble(sTID("bottomRight"), cTID("#Pxl"), radius);
        }
        l.putObject(cTID("Shp "), cTID("Rctn"), rect);
        if (stroke) l.putObject(sTID("strokeStyle"), sTID("strokeStyle"), strokeStyle(stroke.hex, stroke.width, !!fill));
        d.putObject(cTID("Usng"), sTID("contentLayer"), l);
        doc.selection.deselect();
        executeAction(cTID("Mk  "), d, DialogModes.NO);
        var layer = doc.activeLayer; layer.name = name;
        return adopt(layer, parent);
    }
    // Traço como retângulo vetorial girado: continua forma editável.
    function segment(doc, parent, name, x1, y1, x2, y2, thickness, hex) {
        var dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy), cx = (x1+x2)/2, cy = (y1+y2)/2;
        var l = shape(doc, parent, name, [cx-len/2, cy-thickness/2, len, thickness], 0, hex, null);
        l.rotate(Math.atan2(dy, dx)*180/Math.PI, AnchorPosition.MIDDLECENTER);
        return l;
    }
    // Máscara de camada que esconde um retângulo (a forma continua inteira).
    function hideRect(doc, layer, r) {
        doc.activeLayer = layer;
        doc.selection.select([[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]]);
        var d = new ActionDescriptor(), ref = new ActionReference();
        d.putClass(cTID("Nw  "), cTID("Chnl"));
        ref.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk ")); d.putReference(cTID("At  "), ref);
        d.putEnumerated(cTID("Usng"), cTID("UsrM"), cTID("HdSl"));
        executeAction(cTID("Mk  "), d, DialogModes.NO);
        doc.selection.deselect();
    }
    // Degradê como camada de preenchimento: editável com duplo clique.
    function gradientLayer(doc, parent, name, range) {
        var d = new ActionDescriptor(), ref = new ActionReference(), l = new ActionDescriptor(), g = new ActionDescriptor();
        var grad = new ActionDescriptor(), stops = new ActionList(), trans = new ActionList(), i, s, t, loc, prev = -1;
        ref.putClass(sTID("contentLayer")); d.putReference(cTID("null"), ref);
        grad.putString(cTID("Nm  "), "Preto para dourado"); grad.putEnumerated(cTID("GrdF"), cTID("GrdF"), cTID("CstS")); grad.putDouble(cTID("Intr"), 4096);
        for (i = 0; i < GRADIENT.length; i++) {
            loc = Math.min(4096, Math.round(4096*(range[0] + GRADIENT[i][0]*(range[1]-range[0]))));
            if (loc <= prev) loc = prev + 1; prev = loc;
            s = new ActionDescriptor(); s.putObject(cTID("Clr "), cTID("RGBC"), rgb(GRADIENT[i][1]));
            s.putEnumerated(cTID("Type"), cTID("Clry"), cTID("UsrS")); s.putInteger(cTID("Lctn"), loc); s.putInteger(cTID("Mdpn"), 50);
            stops.putObject(cTID("Clrt"), s);
        }
        grad.putList(cTID("Clrs"), stops);
        for (i = 0; i < 2; i++) {
            t = new ActionDescriptor(); t.putUnitDouble(cTID("Opct"), cTID("#Prc"), 100);
            t.putInteger(cTID("Lctn"), i*4096); t.putInteger(cTID("Mdpn"), 50); trans.putObject(cTID("TrnS"), t);
        }
        grad.putList(cTID("Trns"), trans);
        g.putUnitDouble(cTID("Angl"), cTID("#Ang"), -90);
        g.putEnumerated(cTID("Type"), cTID("GrdT"), cTID("Lnr "));
        g.putObject(cTID("Grad"), cTID("Grdn"), grad);
        l.putObject(cTID("Type"), sTID("gradientLayer"), g);
        d.putObject(cTID("Usng"), sTID("contentLayer"), l);
        doc.selection.deselect();
        executeAction(cTID("Mk  "), d, DialogModes.NO);
        var layer = doc.activeLayer; layer.name = name;
        return adopt(layer, parent);
    }
    function putText(parent, name, value, font, size, hex, leading) {
        var l = parent.artLayers.add(); l.kind = LayerKind.TEXT;
        var t = l.textItem; t.kind = TextType.POINTTEXT; t.font = font; t.size = new UnitValue(size,"pt");
        t.color = color(hex); t.justification = Justification.LEFT; t.antiAliasMethod = AntiAlias.SHARP;
        t.useAutoLeading = false; t.leading = new UnitValue(leading || size*1.02,"pt"); t.position = [px(0),px(size)];
        t.contents = value || " "; l.name = name; l.visible = !!trim(value); return l;
    }
    function fit(layer, box, center, cap) {
        var b = bounds(layer), w = b[2]-b[0], h = b[3]-b[1];
        if (w <= 0 || h <= 0) throw new Error("Conteúdo sem dimensões: " + layer.name);
        var scale = Math.min(box[2]/w, box[3]/h);
        if (cap) scale = Math.min(1, scale);
        layer.resize(scale*100, scale*100, AnchorPosition.TOPLEFT); b = bounds(layer);
        layer.translate(px(box[0]+(center?(box[2]-b[2]+b[0])/2:0)-b[0]), px(box[1]+(center?(box[3]-b[3]+b[1])/2:0)-b[1]));
    }
    function label(parent, name, value, font, size, hex, box) {
        var l = putText(parent, name, value, font, size, hex);
        if (trim(value)) fit(l, box, false, true); return l;
    }
    // Largura da última linha de um texto de várias linhas, medida com a
    // fonte e a transformação reais numa cópia temporária.
    function lastLineRight(layer, value) {
        var lines = value.split("\r"), sample = null;
        if (lines.length < 2) return bounds(layer)[2];
        try { sample = layer.duplicate(); sample.textItem.contents = lines[lines.length-1]; return bounds(sample)[2]; }
        finally { if (sample) sample.remove(); }
    }
    function progress() {
        var w = new Window("palette", TITLE), canceled = false;
        w.orientation = "column"; w.alignChildren = ["fill","top"];
        var text = w.add("statictext", undefined, "Preparando…"); text.preferredSize.width = 360;
        var bar = w.add("progressbar", undefined, 0, 10); bar.preferredSize = [360,16];
        var cancel = w.add("button", undefined, "Cancelar");
        cancel.onClick = function () { canceled = true; }; w.onClose = function () { canceled = true; }; w.show();
        return {
            step:function (n, message) { text.text = message; bar.value = n; w.update(); if (canceled) throw new Error("Operação cancelada."); },
            close:function () { w.close(); }
        };
    }

    /* Montagem ----------------------------------------------------------- */

    // Contexto de montagem: documento, formato, escala e áreas.
    function context(doc, fmt, data, root) {
        var c = {doc:doc, fmt:fmt, data:data, root:root, sx:data.width/fmt.width, sy:data.height/fmt.height};
        c.s = Math.min(c.sx, c.sy);
        c.box = function (b) { return [b[0]*c.sx, b[1]*c.sy, b[2]*c.sx, b[3]*c.sy]; };
        return c;
    }
    function offerSpec(fmt, i) {
        var m = fmt.main, k = fmt.card, o, key, out = {};
        if (i === 0) {
            for (key in m) if (m.hasOwnProperty(key)) out[key] = m[key];
            out.card = null; out.inline = false; return out;
        }
        o = k.boxes[i-1];
        function rel(r) { return r ? [o[0]+r[0], o[1]+r[1], r[2], r[3]] : null; }
        return {card:o, divider:rel(k.divider), image:rel(k.image), title:rel(k.title), note:rel(k.note), de:rel(k.de),
            por:rel(k.por), tag:rel(k.tag), titleSize:k.titleSize, noteSize:k.noteSize, inline:true};
    }
    function areaName(i, part) { return i === null ? "AREA_" + part : "AREA_OFERTA_0" + (i+1) + "_" + part; }
    // Retângulo onde o elemento encaixa: a área em 98_AREAS, se existir
    // (o usuário pode movê-la), senão a medida do modelo.
    function area(c, i, part, fallback) {
        var areas = direct(c.root, "98_AREAS", true), l = areas && direct(areas, areaName(i, part), true);
        return l ? rectOf(l) : c.box(fallback);
    }
    function buildAreas(c, g) {
        var i, j, spec, list = [[null, "LOGO", c.fmt.logo], [null, "CAMPANHA", c.fmt.campaign], [null, "RODAPE", c.fmt.footer.box]];
        for (i = 0; i < 3; i++) { spec = offerSpec(c.fmt, i); for (j = 0; j < PARTS.length; j++) list.push([i, PARTS[j][0], spec[PARTS[j][1]]]); }
        for (i = list.length-1; i >= 0; i--) shape(c.doc, g, areaName(list[i][0], list[i][1]), c.box(list[i][2]), 0, null, {hex:AREA_COLOR, width:1});
        g.visible = false;
    }
    function buildGuides(c) {
        var g = c.fmt.guides, existing = c.doc.guides, i, j, want = [], found, cur;
        for (i = 0; i < g.v.length; i++) want.push([Direction.VERTICAL, g.v[i]*c.sx]);
        for (i = 0; i < g.h.length; i++) want.push([Direction.HORIZONTAL, g.h[i]*c.sy]);
        for (i = 0; i < want.length; i++) {
            found = false;
            for (j = 0; j < existing.length && !found; j++) {
                cur = existing[j];
                found = cur.direction === want[i][0] && Math.abs(cur.coordinate.as("px") - want[i][1]) < 0.5;
            }
            if (!found) existing.add(want[i][0], px(want[i][1]));
        }
    }
    function placeImage(c, parent, name, slot, existing, rect, source) {
        var l = null, doc = c.doc;
        if (slot.file) {
            app.activeDocument = doc;
            // Place Embedded: sem vínculo, sem alterar o arquivo de origem.
            var d = new ActionDescriptor(); d.putPath(cTID("null"), slot.file);
            d.putEnumerated(cTID("FTcs"), cTID("QCSt"), cTID("Qcsa"));
            executeAction(cTID("Plc "), d, DialogModes.NO);
            l = doc.activeLayer;
        } else if (slot.keep && existing && source.doc !== doc) {
            app.activeDocument = source.doc;
            try { l = existing.duplicate(doc, ElementPlacement.PLACEATBEGINNING); }
            finally { app.activeDocument = doc; }
        }
        if (l) { adopt(l, parent); l.name = name; l.allLocked = false; l.visible = true; fit(l, rect, true, false); }
        return l;
    }
    function makePrice(c, parent, name, i, part, price, unitText, caption, hex, strike) {
        var g = group(parent, name), value = price || {integer:"0", cents:",00"}, font = c.data.font, b;
        // Monta em medidas canônicas e escala o bloco inteiro; a largura
        // medida do inteiro posiciona centavos e unidade para 1 a 4 dígitos.
        var integer = putText(g, "TXT_REAIS", value.integer, font, 220, hex); fit(integer, [0,0,900,210], false, false);
        b = bounds(integer); var iw = b[2]-b[0], ih = b[3]-b[1];
        var cap = putText(g, "TXT_ROTULO", caption, font, 64, hex); fit(cap, [0,0,86,100], false, true);
        b = bounds(cap); var left = b[2]-b[0]+8;
        integer.translate(px(left), px(0));
        var cents = putText(g, "TXT_CENTAVOS", value.cents, font, 80, hex); fit(cents, [left+iw+5,0,95,63], false, true);
        var un = putText(g, "TXT_UNIDADE", unitText, font, 66, hex); fit(un, [left+iw+5,ih-55,95,55], false, true);
        // Unidade reduzida para caber continua apoiada na base do inteiro.
        b = bounds(un); un.translate(px(0), px(ih-b[3]));
        fit(g, area(c, i, part, offerSpec(c.fmt, i)[part === "PRECO_DE" ? "de" : "por"]), false, false);
        if (strike) {
            // Risco desenhado já no tamanho final, com espessura legível.
            b = bounds(g); var h = b[3]-b[1];
            segment(c.doc, g, "SHP_RISCO", b[0], b[3]-0.07*h, b[2]+0.12*h, b[1]+0.02*h, Math.max(2*c.s, 0.033*h), WHITE);
        }
        g.visible = !!price;
        return g;
    }
    function makeTexts(c, g, i, o) {
        var spec = offerSpec(c.fmt, i), title = label(g, "TXT_NOME", o.name, c.data.font, spec.titleSize*c.s, WHITE, area(c, i, "NOME", spec.title));
        var noteBox = area(c, i, "COMPLEMENTO", spec.note), inline = false, titleBox = area(c, i, "NOME", spec.title);
        if (spec.inline && trim(o.note) && o.name.indexOf("\r") >= 0) {
            // Complemento na mesma linha do fim do nome, quando couber.
            var right = titleBox[0]+titleBox[2], x = lastLineRight(title, o.name) + 8*c.s;
            if (right-x >= 60*c.s) { noteBox = [x, bounds(title)[3]-noteBox[3], right-x, noteBox[3]]; inline = true; }
        }
        var note = label(g, "TXT_COMPLEMENTO", o.note, c.data.font, spec.noteSize*c.s, WHITE, noteBox);
        if (inline) { var nb = bounds(note); note.translate(px(0), px(bounds(title)[3]-nb[3])); }
        return [title, note];
    }
    function makeSelo(c, g, i, visible) {
        var spec = offerSpec(c.fmt, i), r = area(c, i, "SELO", spec.tag), inset = Math.min(r[2], r[3])*0.14;
        var selo = group(g, "SELO_MODERACAO");
        shape(c.doc, selo, "SHP_SELO", r, 4*c.s, WHITE, null);
        var t = putText(selo, "TXT_SELO", "BEBA COM MODERAÇÃO", c.data.font, 30, BLACK);
        t.rotate(-90, AnchorPosition.MIDDLECENTER);
        fit(t, [r[0]+inset, r[1]+inset, r[2]-2*inset, r[3]-2*inset], true, true);
        selo.visible = !!visible;
        return selo;
    }
    function makeOffer(c, parent, i, o, slot, existing, source) {
        var spec = offerSpec(c.fmt, i), g = group(parent, SECTIONS[i]), stroke = {hex:GOLD, width:c.fmt.card.stroke*c.s};
        if (spec.card) shape(c.doc, g, "SHP_CARD", c.box(spec.card), c.fmt.card.radius*c.s, null, stroke);
        if (spec.divider) shape(c.doc, g, "SHP_DIVISORIA", c.box(spec.divider), 0, GOLD, null);
        var im = placeImage(c, g, "IMG_PRODUTO", slot, existing, area(c, i, "IMAGEM", spec.image), source);
        makeTexts(c, g, i, o);
        makePrice(c, g, "PRECO_DE", i, "PRECO_DE", o.de, o.unitDe, o.labelDe, GOLD, true);
        makePrice(c, g, "PRECO_POR", i, "PRECO_POR", o.por, o.unitPor, o.labelPor, WHITE, false);
        makeSelo(c, g, i, o.alcohol);
        return im;
    }
    function makeFooter(c, g) {
        var d = c.data, f = c.fmt.footer, s = c.s, lead = f.lead*s, x = 0, y = 100*s, gap = 7*s, started = false, l, i;
        var runs = [["TXT_AVISO_ANTES", d.before, d.fontSupport], ["TXT_VALIDADE", d.dates, d.font], ["TXT_AVISO_DEPOIS", d.after, d.fontSupport]];
        // Trechos em sequência pela linha de base: a última linha de cada um
        // continua na mesma linha do próximo (Q, Ç e vírgulas não desnivelam).
        for (i = 0; i < runs.length; i++) {
            l = putText(g, runs[i][0], runs[i][1], runs[i][2], f.sizes[i]*s, WHITE, lead);
            if (!trim(runs[i][1])) continue;
            l.textItem.position = [px(x), px(y)];
            y += lead*(runs[i][1].split("\r").length-1);
            x = lastLineRight(l, runs[i][1]) + gap; started = true;
        }
        // "Linhas finais" começam na margem, uma linha abaixo.
        l = putText(g, "TXT_AVISO_FINAL", d.last, d.fontSupport, f.sizes[3]*s, WHITE, lead);
        if (trim(d.last)) { l.textItem.position = [px(0), px(started ? y+lead : y)]; started = true; }
        if (!started) return;
        var r = area(c, null, "RODAPE", f.box);
        fit(g, r, false, true);
        if (f.align === "center") { var b = bounds(g); g.translate(px(r[0]+(r[2]-(b[2]-b[0]))/2-b[0]), px(0)); }
    }
    function makeFrame(c, g) {
        var f = c.fmt.frame; if (!f) return;
        var box = c.box(f.box), l = shape(c.doc, g, "SHP_MOLDURA", box, f.radius*c.s, null, {hex:GOLD, width:f.stroke*c.s});
        // A base da moldura some atrás da fileira de cards, como no modelo.
        var bottom = box[1]+box[3];
        hideRect(c.doc, l, [f.gap[0]*c.sx, bottom-40*c.sy, (f.gap[1]-f.gap[0])*c.sx, 80*c.sy]);
    }

    function applySettings() {
        var old = {units:app.preferences.rulerUnits, type:app.preferences.typeUnits, dialogs:app.displayDialogs};
        app.preferences.rulerUnits = Units.PIXELS; app.preferences.typeUnits = TypeUnits.POINTS; app.displayDialogs = DialogModes.NO;
        return function () { app.preferences.rulerUnits = old.units; app.preferences.typeUnits = old.type; app.displayDialogs = old.dialogs; };
    }
    function atResolution(doc, ppi) {
        if (Math.abs(doc.resolution-ppi) > 0.001) doc.resizeImage(undefined, undefined, ppi, ResampleMethod.NONE);
    }

    function render(data, source) {
        var restore = null, previous = app.documents.length ? app.activeDocument : null, doc = null, bar = null, success = false;
        var starter = null, resolution = 72, missing = [], fmt = FORMATS[data.format], i;
        try {
            restore = applySettings();
            bar = progress(); bar.step(0, "Criando documento");
            if (data.mode === "copy") {
                doc = source.doc.duplicate("DESIGNPROD — Ofertas — cópia", false);
                app.activeDocument = doc;
                // Monta a 72 ppi sem reamostrar (pixels intactos): 1 pt = 1 px.
                resolution = doc.resolution; atResolution(doc, 72);
                // artLayers.add() do documento pode criar dentro do grupo antigo;
                // a temporária sobe para o topo antes de apagá-lo.
                starter = doc.artLayers.add(); starter.name = "__DP_TEMP";
                starter.move(doc, ElementPlacement.PLACEATBEGINNING); doc.activeLayer = starter;
                var old = direct(doc, ROOT); old.allLocked = false; old.remove();
            } else {
                doc = app.documents.add(px(data.width), px(data.height), 72, "DESIGNPROD — Ofertas " + fmt.id, NewDocumentMode.RGB,
                    DocumentFill.TRANSPARENT, 1, BitsPerChannelType.EIGHT, "sRGB IEC61966-2.1");
                starter = doc.activeLayer;
            }
            data.width = Math.round(doc.width.as("px")); data.height = Math.round(doc.height.as("px"));
            doc.selection.deselect();
            var root = doc.layerSets.add(); root.name = ROOT; root.move(doc, ElementPlacement.PLACEATBEGINNING);
            var c = context(doc, fmt, data, root);
            buildGuides(c);
            bar.step(1, "Fundo e áreas");
            gradientLayer(doc, group(root, "99_FUNDO"), "BG_DEGRADE", fmt.gradient);
            starter.remove(); starter = null;
            buildAreas(c, group(root, "98_AREAS"));
            makeFrame(c, group(root, "90_GRAFISMOS"));
            bar.step(2, "Rodapé");
            makeFooter(c, group(root, "06_RODAPE"));
            bar.step(3, "Campanha");
            if (!placeImage(c, group(root, "05_CAMPANHA"), "IMG_CAMPANHA", data.images[4], source ? source.images[4] : null, area(c, null, "CAMPANHA", fmt.campaign), source)) missing.push("campanha");
            for (i = 2; i >= 0; i--) {
                bar.step(6-i, "Montando oferta " + (i+1));
                if (!makeOffer(c, root, i, data.offers[i], data.images[i], source ? source.images[i] : null, source)) missing.push("produto " + (i+1));
            }
            bar.step(7, "Marca");
            if (!placeImage(c, group(root, "01_MARCA"), "IMG_LOGO", data.images[3], source ? source.images[3] : null, area(c, null, "LOGO", fmt.logo), source)) missing.push("logotipo");
            bar.step(9, "Finalizando");
            atResolution(doc, resolution);
            app.activeDocument = doc; doc.activeLayer = root; success = true;
            return {doc:doc, missing:missing};
        } finally {
            if (bar) try { bar.close(); } catch (ignore) {}
            if (!success && doc) try { app.activeDocument = doc; doc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
            if (restore) restore();
            if (!success && previous) try { app.activeDocument = previous; } catch (restoreError) {}
        }
    }

    /* Edição parcial ----------------------------------------------------- */

    // Compara o formulário com o documento e devolve só o que mudou.
    function changesFor(data, source) {
        var s = source.data, list = [], i, o, p, fontChanged = data.font !== s.font, supportChanged = data.fontSupport !== s.fontSupport;
        for (i = 0; i < 3; i++) {
            o = data.offers[i]; p = s.offers[i];
            if (fontChanged || o.name !== nl(p.name) || o.note !== nl(p.note)) list.push([i, "texts"]);
            if (fontChanged || priceKey(o.de) !== sourcePriceKey(p.de) || o.unitDe !== p.unitDe || o.labelDe !== p.labelDe) list.push([i, "de"]);
            if (fontChanged || priceKey(o.por) !== sourcePriceKey(p.por) || o.unitPor !== p.unitPor || o.labelPor !== p.labelPor) list.push([i, "por"]);
            if (fontChanged || o.alcohol !== p.alcohol) list.push([i, "selo"]);
            if (data.images[i].file || data.images[i].remove) list.push([i, "image"]);
        }
        if (fontChanged || supportChanged || data.before !== nl(s.before) || data.dates !== s.dates || data.after !== s.after || data.last !== nl(s.last)) list.push([null, "footer"]);
        if (data.images[3].file || data.images[3].remove) list.push([null, "logo"]);
        if (data.images[4].file || data.images[4].remove) list.push([null, "campaign"]);
        return list;
    }
    function describe(change) {
        var names = {texts:"nome e complemento", de:"preço DE", por:"preço POR", selo:"selo", image:"imagem"};
        if (change[0] === null) return {footer:"rodapé", logo:"logotipo", campaign:"campanha"}[change[1]];
        return (change[0] === 0 ? "oferta principal" : "oferta " + (change[0]+1)) + " — " + names[change[1]];
    }
    function applyChange(c, change) {
        var root = c.root, i = change[0], kind = change[1], g, old, fresh, slot, o;
        if (i !== null) {
            g = direct(root, SECTIONS[i]); o = c.data.offers[i];
            // Localiza a camada antiga antes de criar a nova com o mesmo nome.
            if (kind === "texts") {
                var oldName = direct(g, "TXT_NOME", true), oldNote = direct(g, "TXT_COMPLEMENTO", true), made = makeTexts(c, g, i, o);
                replace(made[1], oldNote); replace(made[0], oldName);
            } else if (kind === "de") {
                old = direct(g, "PRECO_DE", true);
                replace(makePrice(c, g, "PRECO_DE", i, "PRECO_DE", o.de, o.unitDe, o.labelDe, GOLD, true), old);
            } else if (kind === "por") {
                old = direct(g, "PRECO_POR", true);
                replace(makePrice(c, g, "PRECO_POR", i, "PRECO_POR", o.por, o.unitPor, o.labelPor, WHITE, false), old);
            } else if (kind === "selo") {
                old = direct(g, "SELO_MODERACAO", true);
                if (old && c.data.font === c.source.data.font) old.visible = o.alcohol;
                else replace(makeSelo(c, g, i, o.alcohol), old);
            } else if (kind === "image") {
                old = direct(g, "IMG_PRODUTO", true); slot = c.data.images[i];
                if (slot.remove) { if (old) { old.allLocked = false; old.remove(); } return; }
                fresh = placeImage(c, g, "IMG_PRODUTO", slot, null, area(c, i, "IMAGEM", offerSpec(c.fmt, i).image), null);
                if (old) replace(fresh, old);
                else {
                    // Sem imagem anterior: logo acima da divisória ou do card.
                    var ref = direct(g, "SHP_DIVISORIA", true) || direct(g, "SHP_CARD", true);
                    if (ref) fresh.move(ref, ElementPlacement.PLACEBEFORE);
                }
            }
            return;
        }
        if (kind === "footer") {
            g = direct(root, "06_RODAPE");
            var parent = g.parent, footer = parent.layerSets.add(); footer.name = "06_RODAPE";
            footer.move(g, ElementPlacement.PLACEBEFORE);
            makeFooter(c, footer); g.allLocked = false; g.remove();
            return;
        }
        var section = kind === "logo" ? "01_MARCA" : "05_CAMPANHA", layerName = kind === "logo" ? "IMG_LOGO" : "IMG_CAMPANHA";
        g = direct(root, section); old = direct(g, layerName, true); slot = c.data.images[kind === "logo" ? 3 : 4];
        if (slot.remove) { if (old) { old.allLocked = false; old.remove(); } return; }
        replace(placeImage(c, g, layerName, slot, null, area(c, null, kind === "logo" ? "LOGO" : "CAMPANHA", kind === "logo" ? c.fmt.logo : c.fmt.campaign), null), old);
    }
    function edit(data, source) {
        var doc = source.doc, changes = changesFor(data, source), restore = null, bar = null, failure = null, i;
        if (!changes.length) return {doc:doc, changed:[]};
        var before = doc.activeHistoryState, G = $.global;
        G.__DP_OFERTAS_EDITAR = function () {
            var resolution = doc.resolution;
            try {
                atResolution(doc, 72);
                data.width = Math.round(doc.width.as("px")); data.height = Math.round(doc.height.as("px"));
                var c = context(doc, source.fmt, data, source.root); c.source = source;
                for (i = 0; i < changes.length; i++) {
                    bar.step(Math.round(10*i/changes.length), "Alterando " + describe(changes[i]));
                    applyChange(c, changes[i]);
                }
                atResolution(doc, resolution);
            } catch (e) { failure = e; }
        };
        try {
            restore = applySettings();
            bar = progress();
            app.activeDocument = doc;
            doc.suspendHistory("Ofertas — editar elementos", "__DP_OFERTAS_EDITAR()");
        } finally {
            try { delete G.__DP_OFERTAS_EDITAR; } catch (ignore) {}
            if (bar) try { bar.close(); } catch (closeError) {}
            // Falha ou cancelamento: volta ao estado anterior do histórico.
            if (failure) try { doc.activeHistoryState = before; } catch (historyError) {}
            if (restore) restore();
        }
        if (failure) throw failure;
        var names = [];
        for (i = 0; i < changes.length; i++) names.push(describe(changes[i]));
        return {doc:doc, changed:names};
    }

    try {
        var source = null;
        if (app.documents.length) source = readSource(app.activeDocument);
        var data = form(source); if (!data) return;
        if (data.mode === "edit") {
            var edited = edit(data, source);
            alert(edited.changed.length ? "Alterado no documento aberto:\n- " + edited.changed.join("\n- ") +
                "\n\nUm único passo no histórico: Ctrl+Z desfaz tudo." : "Nenhum valor mudou. O documento não foi alterado.", TITLE);
            return;
        }
        var result = render(data, source);
        var msg = "Arte criada em um novo documento, com guias, áreas, textos e formas editáveis.\nConfira o resultado e use Salvar como quando desejar.";
        if (result.missing.length) msg += "\n\nEspaços sem imagem: " + result.missing.join(", ") + ".\nExecute o script novamente para preencher esses espaços.";
        alert(msg, TITLE);
    } catch (e) { alert(errorText(e), TITLE); }
})();
