/**
 * @ibd-id photoshop/gerar-ofertas-preto-dourado
 * @ibd-titulo Ofertas preto e dourado
 * @ibd-descricao Cria uma arte com três ofertas, textos editáveis e cinco imagens escolhidas na interface. Reabre os dados de layouts gerados e aplica as alterações em uma nova cópia.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags ofertas, layout, textos, imagens, varejo
 * @ibd-doc apps/photoshop/docs/ofertas-preto-dourado.md
 */
#target photoshop
/*
 * Reconstrucao por print, sem PSD ou imagens embutidas.
 * ES3 / ScriptUI. Sem includes, rede, gravacao de preferencias ou saveAs.
 * Gera somente um documento em memoria; salvar fica a cargo do usuario.
 * Imagens sao incorporadas como objetos inteligentes, nunca vinculadas.
 */
(function () {
    var TITLE = "DESIGNPROD — Ofertas preto e dourado";
    var ROOT = "DESIGNPROD_OFERTAS_V1";
    var GOLD = "F6BC13", WHITE = "FFFFFF";
    var OFFER_NAMES = ["02_OFERTA_DESTAQUE", "03_OFERTA_02", "04_OFERTA_03"];
    var SPECS = [
        {image:[245,115,440,460], title:[900,112,640,148], note:[900,270,610,42],
         de:[900,382,172,112], por:[1184,382,320,216], titleSize:76},
        {image:[138,757,180,182], title:[390,755,288,70], note:[390,825,284,22],
         de:[390,862,79,67], por:[506,862,135,82], titleSize:34},
        {image:[792,750,220,190], title:[1052,755,298,70], note:[1052,825,296,22],
         de:[1052,862,79,67], por:[1165,862,171,82], titleSize:34}
    ];

    function trim(v) { return String(v).replace(/^\s+|\s+$/g, ""); }
    function nl(v) { return String(v).replace(/\r\n|\n/g, "\r"); }
    function px(v) { return new UnitValue(v, "px"); }
    function color(hex) { var c = new SolidColor(); c.rgb.hexValue = hex; return c; }
    function errorText(e) { return e && e.message ? e.message : String(e); }
    function bounds(layer) {
        var b = layer.bounds;
        return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")];
    }
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
    function defaults() {
        return {
            width:1920, height:1080, font:"",
            before:"OFERTAS VÁLIDAS EM TODAS AS UNIDADES DO +B SUPERMERCADOS DE",
            dates:"25 A 28.09.2026",
            after:"OU ENQUANTO DURAR O ESTOQUE. IMAGENS MERAMENTE ILUSTRATIVAS.",
            offers:[
                {name:"AÇÚCAR TRITURADO\rCAUAXÍ 1 KG", note:"", de:"3,15", por:"2,89", unitDe:"UN", unitPor:"UN", labelDe:"DE\rR$", labelPor:"POR\rR$"},
                {name:"ÁGUA SANITÁRIA\rQ-BOA 1 L", note:"", de:"", por:"3,59", unitDe:"UN", unitPor:"UN", labelDe:"DE\rR$", labelPor:"POR\rR$"},
                {name:"AMACIANTE DOWNY\r500 ML", note:"(FRAGRÂNCIAS)", de:"", por:"10,49", unitDe:"UN", unitPor:"UN", labelDe:"DE\rR$", labelPor:"POR\rR$"}
            ]
        };
    }
    function readSource(doc) {
        var root = direct(doc, ROOT, true);
        if (!root) return null;
        var data = defaults(), images = [], i, o, g, old, cur;
        data.width = Math.round(doc.width.as("px")); data.height = Math.round(doc.height.as("px"));
        for (i = 0; i < 3; i++) {
            g = direct(root, OFFER_NAMES[i]); old = direct(g, "PRECO_ANTERIOR"); cur = direct(g, "PRECO_ATUAL");
            o = data.offers[i];
            o.name = txt(g, "TXT_NOME"); o.note = txt(g, "TXT_COMPLEMENTO");
            o.de = old.visible ? txt(old, "TXT_REAIS") + txt(old, "TXT_CENTAVOS") : "";
            o.por = txt(cur, "TXT_REAIS") + txt(cur, "TXT_CENTAVOS");
            o.unitDe = txt(old, "TXT_UNIDADE"); o.unitPor = txt(cur, "TXT_UNIDADE");
            o.labelDe = txt(old, "TXT_ROTULO"); o.labelPor = txt(cur, "TXT_ROTULO");
            images[i] = direct(g, "IMG_PRODUTO", true);
        }
        data.font = direct(direct(root, OFFER_NAMES[0]), "TXT_NOME").textItem.font;
        g = direct(root, "06_RODAPE");
        data.before = txt(g, "TXT_AVISO_ANTES"); data.dates = txt(g, "TXT_VALIDADE"); data.after = txt(g, "TXT_AVISO_DEPOIS");
        images[3] = direct(direct(root, "01_MARCA"), "IMG_LOGO", true);
        images[4] = direct(direct(root, "05_CAMPANHA"), "IMG_CAMPANHA", true);
        return {doc:doc, root:root, data:data, images:images};
    }
    function fonts() {
        var list = [], i;
        if (app.fonts) for (i = 0; i < app.fonts.length; i++) {
            list.push({name:app.fonts[i].name, id:app.fonts[i].postScriptName});
        }
        list.sort(function (a,b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        return list;
    }
    function preferredFont(list, saved) {
        var choices = [saved, "Oswald-SemiBold", "RobotoCondensed-Bold", "BebasNeue-Regular", "ArialNarrow-Bold", "Arial-BoldMT"], i, j;
        for (i = 0; i < choices.length; i++) for (j = 0; j < list.length; j++) if (choices[i] === list[j].id) return j;
        return 0;
    }
    function form(source) {
        var data = source ? source.data : defaults(), list = fonts(), labels = [], i, controls = [], imageControls = [];
        var w = new Window("dialog", TITLE);
        w.orientation = "column"; w.alignChildren = ["fill","top"]; w.spacing = 10; w.margins = 16;
        var modeRow = w.add("group"); modeRow.add("statictext", undefined, "Resultado");
        var mode = modeRow.add("dropdownlist", undefined, source ?
            ["Nova cópia do layout aberto", "Novo layout com os dados abaixo"] : ["Novo layout"]);
        mode.selection = 0;
        var explanation = w.add("statictext", undefined,
            "Cria um documento sem salvar. A nova cópia reorganiza a composição nos espaços do modelo.");
        explanation.preferredSize.width = 660;
        var tabs = w.add("tabbedpanel"); tabs.preferredSize = [680,470];
        function tab(title) {
            var t = tabs.add("tab", undefined, title); t.orientation = "column"; t.alignChildren = ["fill","top"]; t.margins = 16; t.spacing = 8; return t;
        }
        function field(parent, label, value, multi) {
            var r = parent.add("group"); r.alignChildren = ["left","top"];
            var l = r.add("statictext", undefined, label); l.preferredSize.width = 120;
            var e = r.add("edittext", undefined, String(value).replace(/\r/g,"\n"), {multiline:!!multi});
            e.preferredSize = [480, multi ? 48 : 25]; return e;
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
        var size = general.add("group"); size.add("statictext", undefined, "Largura");
        var width = size.add("edittext", undefined, String(data.width)); width.characters = 7;
        size.add("statictext", undefined, "Altura");
        var height = size.add("edittext", undefined, String(data.height)); height.characters = 7;
        size.add("statictext", undefined, "px · RGB · 72 ppi");
        for (i = 0; i < list.length; i++) labels.push(list[i].name + " [" + list[i].id + "]");
        general.add("statictext", undefined, "Fonte instalada — o print não identifica a fonte original");
        var font = general.add("dropdownlist", undefined, labels.length ? labels : ["Nenhuma fonte disponível"]);
        font.selection = preferredFont(list, data.font);
        var before = field(general, "Rodapé — início", data.before, true);
        var dates = field(general, "Validade", data.dates, false);
        var after = field(general, "Rodapé — final", data.after, true);
        general.add("statictext", undefined, "A fonte selecionada será aplicada a todos os textos criados pelo script.");
        general.add("statictext", undefined, "Preços anteriores dos cards menores: preencha os centavos, ilegíveis no print.");
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
            imageField(t, "Imagem do produto — encaixe proporcional", i);
            t.add("statictext", undefined, "Use PNG ou PSD recortado. A montagem com várias embalagens deve vir na imagem.");
            controls.push(c);
        }
        var artwork = tab("Marca e campanha");
        imageField(artwork, "Logotipo superior direito", 3);
        imageField(artwork, "Campanha / selo inferior direito", 4);
        artwork.add("statictext", undefined, "Textos que fazem parte dessas imagens continuam incorporados à imagem.");
        artwork.add("statictext", undefined, "Sem imagem, o espaço fica vazio e recebe uma guia oculta no grupo 98_GUIAS.");
        function sizeState() {
            var copy = source && mode.selection && mode.selection.index === 0;
            width.enabled = height.enabled = !copy;
            if (copy) { width.text = String(source.data.width); height.text = String(source.data.height); }
        }
        mode.onChange = sizeState; sizeState();
        tabs.selection = general;
        var actions = w.add("group"); actions.alignment = "right";
        actions.add("button", undefined, "Cancelar", {name:"cancel"});
        var apply = actions.add("button", undefined, "Gerar arte", {name:"ok"}), result = null;
        apply.onClick = function () {
            try {
                var out = {width:dimension(width.text,"Largura"), height:dimension(height.text,"Altura"), offers:[],
                    before:nl(before.text), dates:nl(dates.text), after:nl(after.text), images:[],
                    copy:!!(source && mode.selection.index === 0)};
                if (!list.length || !font.selection) throw new Error("Nenhuma fonte disponível. Ative uma fonte no Photoshop.");
                out.font = list[font.selection.index].id;
                app.fonts.getByName(out.font);
                for (var j = 0; j < 3; j++) {
                    var x = controls[j], label = "Oferta " + (j+1), o = {
                        name:nl(trim(x.name.text)), note:nl(trim(x.note.text)),
                        de:parsePrice(x.de.price.text,true,label+" / DE"), por:parsePrice(x.por.price.text,false,label+" / POR"),
                        unitDe:unit(x.de.unit.text,label+" / DE"), unitPor:unit(x.por.unit.text,label+" / POR"),
                        labelDe:nl(x.de.label.text.replace(/\|/g,"\r")), labelPor:nl(x.por.label.text.replace(/\|/g,"\r"))
                    };
                    if (!o.name) throw new Error(label + ": preencha o nome do produto.");
                    if (!trim(o.labelDe) || !trim(o.labelPor)) throw new Error(label + ": preencha os rótulos DE e POR.");
                    out.offers.push(o);
                }
                for (j = 0; j < imageControls.length; j++) {
                    var ic = imageControls[j];
                    if (ic.file && !ic.file.exists) throw new Error("Imagem não encontrada: " + ic.file.name);
                    out.images.push({file:ic.file, keep:!!(source && !ic.file && !ic.remove && source.images[j])});
                }
                result = out; w.close(1);
            } catch (e) { alert(errorText(e), TITLE); }
        };
        w.center(); if (w.show() !== 1) return null; return result;
    }

    function group(parent,name) { var g = parent.layerSets.add(); g.name = name; return g; }
    function layer(parent,name) { var l = parent.artLayers.add(); l.name = name; return l; }
    function rectangle(doc,parent,name,box,hex) {
        var l = layer(parent,name); doc.activeLayer = l;
        doc.selection.select([[box[0],box[1]],[box[0]+box[2],box[1]],[box[0]+box[2],box[1]+box[3]],[box[0],box[1]+box[3]]]);
        doc.selection.fill(color(hex)); doc.selection.deselect(); return l;
    }
    function rounded(doc,parent,name,box,r,hex,lineWidth,fill) {
        var x=box[0], y=box[1], w=box[2], h=box[3], k=0.5522847498, pts=[], path=null;
        function point(a,b,lx,ly,rx,ry) {
            var unitScale=72/doc.resolution;
            var p=new PathPointInfo(); p.kind=PointKind.CORNERPOINT; p.anchor=[a*unitScale,b*unitScale];
            p.leftDirection=[lx*unitScale,ly*unitScale]; p.rightDirection=[rx*unitScale,ry*unitScale]; pts.push(p);
        }
        point(x+r,y,x+r-k*r,y,x+r,y);
        point(x+w-r,y,x+w-r,y,x+w-r+k*r,y);
        point(x+w,y+r,x+w,y+r-k*r,x+w,y+r);
        point(x+w,y+h-r,x+w,y+h-r,x+w,y+h-r+k*r);
        point(x+w-r,y+h,x+w-r+k*r,y+h,x+w-r,y+h);
        point(x+r,y+h,x+r,y+h,x+r-k*r,y+h);
        point(x,y+h-r,x,y+h-r+k*r,x,y+h-r);
        point(x,y+r,x,y+r,x,y+r-k*r);
        var sp=new SubPathInfo(); sp.closed=true; sp.operation=ShapeOperation.SHAPEADD; sp.entireSubPath=pts;
        var l=layer(parent,name); doc.activeLayer=l;
        try {
            path=doc.pathItems.add("__DP_FORMA_TEMP",[sp]); path.makeSelection(0,true,SelectionType.REPLACE);
            if(fill) doc.selection.fill(color(hex));
            else doc.selection.stroke(color(hex),Math.max(1,Math.round(lineWidth)),StrokeLocation.INSIDE,ColorBlendMode.NORMAL,100,false);
        } finally { doc.selection.deselect(); if(path) path.remove(); }
        return l;
    }
    function line(doc,parent,name,x1,y1,x2,y2,thickness,hex) {
        var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),ox=-dy/len*thickness/2,oy=dx/len*thickness/2;
        var l=layer(parent,name); doc.activeLayer=l;
        doc.selection.select([[x1+ox,y1+oy],[x2+ox,y2+oy],[x2-ox,y2-oy],[x1-ox,y1-oy]],SelectionType.REPLACE,0,true);
        doc.selection.fill(color(hex)); doc.selection.deselect(); return l;
    }
    function gradient(doc,parent,width,height) {
        var l=layer(parent,"BG_DEGRADE_PRETO_DOURADO"); doc.activeLayer=l;
        var c=charIDToTypeID, d=new ActionDescriptor(), from=new ActionDescriptor(), to=new ActionDescriptor();
        from.putUnitDouble(c("Hrzn"),c("#Pxl"),0); from.putUnitDouble(c("Vrtc"),c("#Pxl"),height*0.32);
        to.putUnitDouble(c("Hrzn"),c("#Pxl"),0); to.putUnitDouble(c("Vrtc"),c("#Pxl"),height);
        d.putObject(c("From"),c("Pnt "),from); d.putObject(c("T   "),c("Pnt "),to);
        d.putEnumerated(c("Type"),c("GrdT"),c("Lnr ")); d.putBoolean(c("Dthr"),true); d.putBoolean(c("UsMs"),true);
        d.putEnumerated(c("Md  "),c("BlnM"),c("Nrml")); d.putUnitDouble(c("Opct"),c("#Prc"),100); d.putBoolean(c("Rvrs"),false);
        var g=new ActionDescriptor(); g.putString(c("Nm  "),"Preto para dourado");
        g.putEnumerated(c("GrdF"),c("GrdF"),c("CstS")); g.putDouble(c("Intr"),4096);
        var stops=new ActionList();
        function stop(location,r,green,b) {
            var s=new ActionDescriptor(), rgb=new ActionDescriptor();
            rgb.putDouble(c("Rd  "),r); rgb.putDouble(c("Grn "),green); rgb.putDouble(c("Bl  "),b);
            s.putObject(c("Clr "),c("RGBC"),rgb); s.putEnumerated(c("Type"),c("Clry"),c("UsrS"));
            s.putInteger(c("Lctn"),location); s.putInteger(c("Mdpn"),50); stops.putObject(c("Clrt"),s);
        }
        stop(0,23,23,23); stop(2048,69,56,34); stop(4096,169,130,57);
        g.putList(c("Clrs"),stops);
        var trans=new ActionList();
        for(var i=0;i<2;i++) {
            var t=new ActionDescriptor(); t.putUnitDouble(c("Opct"),c("#Prc"),100);
            t.putInteger(c("Lctn"),i*4096); t.putInteger(c("Mdpn"),50); trans.putObject(c("TrnS"),t);
        }
        g.putList(c("Trns"),trans); d.putObject(c("Grad"),c("Grdn"),g);
        executeAction(c("Grdn"),d,DialogModes.NO);
    }
    function putText(parent,name,value,font,size,hex) {
        var l=layer(parent,name); l.kind=LayerKind.TEXT;
        var t=l.textItem; t.kind=TextType.POINTTEXT; t.font=font; t.size=new UnitValue(size,"pt");
        t.color=color(hex); t.justification=Justification.LEFT; t.antiAliasMethod=AntiAlias.SHARP;
        t.useAutoLeading=false; t.leading=new UnitValue(size*1.02,"pt"); t.position=[px(0),px(size)];
        t.contents=value || " "; l.name=name; l.visible=!!trim(value); return l;
    }
    function fit(layer,box,center,cap) {
        var b=bounds(layer), w=b[2]-b[0], h=b[3]-b[1];
        if(w<=0 || h<=0) throw new Error("Conteúdo sem dimensões: "+layer.name);
        var scale=Math.min(box[2]/w,box[3]/h);
        if(cap) scale=Math.min(1,scale);
        layer.resize(scale*100,scale*100,AnchorPosition.TOPLEFT); b=bounds(layer);
        layer.translate(px(box[0]+(center?(box[2]-b[2]+b[0])/2:0)-b[0]),
                        px(box[1]+(center?(box[3]-b[3]+b[1])/2:0)-b[1]));
    }
    function label(parent,name,value,font,size,hex,box) {
        var l=putText(parent,name,value,font,size,hex);
        if(trim(value)) fit(l,box,false,true); return l;
    }
    function makePrice(doc,parent,name,price,unitText,caption,box,font,hex,strike) {
        var g=group(parent,name), value=price || {integer:"0",cents:",00"};
        // Build at canonical dimensions, then scale the entire block uniformly.
        // The integer's measured width controls cents placement for 1–4 digits.
        var integer=putText(g,"TXT_REAIS",value.integer,font,220,hex); fit(integer,[0,0,900,210],false,false);
        var b=bounds(integer), iw=b[2]-b[0], ih=b[3]-b[1];
        var cap=putText(g,"TXT_ROTULO",caption,font,64,hex); fit(cap,[0,0,104,115],false,true);
        b=bounds(cap); var cw=b[2]-b[0], left=cw+12;
        integer.translate(px(left),px(0));
        var cents=putText(g,"TXT_CENTAVOS",value.cents,font,80,hex); fit(cents,[left+iw+5,0,160,76],false,true);
        var un=putText(g,"TXT_UNIDADE",unitText,font,66,hex); fit(un,[left+iw+5,ih-62,160,62],false,true);
        if(strike) {
            b=bounds(g); line(doc,g,"FORMA_RISCO",b[0],b[3]-6,b[2]+5,b[1]+5,4,WHITE);
        }
        fit(g,box,false,false); g.visible=!!price;
        return g;
    }
    function placeImage(doc,parent,name,slot,existing,box,source) {
        var l=null;
        if(slot.file) {
            app.activeDocument=doc;
            // Place Embedded: no linked=true flag, no source file modifications.
            var d=new ActionDescriptor(); d.putPath(charIDToTypeID("null"),slot.file);
            d.putEnumerated(charIDToTypeID("FTcs"),charIDToTypeID("QCSt"),charIDToTypeID("Qcsa"));
            executeAction(charIDToTypeID("Plc "),d,DialogModes.NO);
            l=doc.activeLayer; l.move(parent,ElementPlacement.INSIDE);
        } else if(slot.keep && existing) {
            app.activeDocument=source.doc;
            try { l=existing.duplicate(doc,ElementPlacement.PLACEATBEGINNING); }
            finally { app.activeDocument=doc; }
            l.move(parent,ElementPlacement.INSIDE);
        }
        if(l) {
            l.name=name; l.allLocked=false; l.visible=true; fit(l,box,true,false);
        }
        return l;
    }
    function progress() {
        var w=new Window("palette","Gerando arte"), canceled=false;
        w.orientation="column"; w.alignChildren=["fill","top"];
        var text=w.add("statictext",undefined,"Preparando…"); text.preferredSize.width=360;
        var bar=w.add("progressbar",undefined,0,8); bar.preferredSize=[360,16];
        var cancel=w.add("button",undefined,"Cancelar");
        cancel.onClick=function(){canceled=true;}; w.onClose=function(){canceled=true;}; w.show();
        return {
            step:function(n,message) { text.text=message; bar.value=n; w.update(); if(canceled) throw new Error("Geração cancelada. Nenhum resultado foi salvo."); },
            close:function(){w.close();}
        };
    }
    function render(data,source) {
        var oldUnits=app.preferences.rulerUnits, oldType=app.preferences.typeUnits, oldDialogs=app.displayDialogs;
        var previous=app.documents.length ? app.activeDocument : null, doc=null, bar=null, success=false, starter=null;
        var sx=data.width/1920, sy=data.height/1080, s=Math.min(sx,sy), missing=[];
        function box(b) { return [b[0]*sx,b[1]*sy,b[2]*sx,b[3]*sy]; }
        try {
            app.preferences.rulerUnits=Units.PIXELS; app.preferences.typeUnits=TypeUnits.POINTS; app.displayDialogs=DialogModes.NO;
            bar=progress(); bar.step(0,"Criando documento");
            if(data.copy) {
                doc=source.doc.duplicate("DESIGNPROD — Ofertas — cópia",false);
                app.activeDocument=doc;
                starter=layer(doc,"__DP_TEMP");
                var old=direct(doc,ROOT); old.allLocked=false; old.remove();
            } else {
                doc=app.documents.add(px(data.width),px(data.height),72,"DESIGNPROD — Ofertas",NewDocumentMode.RGB,DocumentFill.TRANSPARENT,1,BitsPerChannelType.EIGHT,"sRGB IEC61966-2.1");
                starter=doc.activeLayer;
            }
            doc.selection.deselect();
            // Text sizes below are in points. Existing copies may have another ppi:
            // compensate at the text creation boundary, without resampling the PSD.
            var pointScale=72/doc.resolution;
            var root=group(doc,ROOT);
            var bg=group(root,"99_FUNDO");
            gradient(doc,bg,data.width,data.height);
            if(starter) starter.remove();
            var graph=group(root,"90_GRAFISMOS");
            var outline=rounded(doc,graph,"FORMA_MOLDURA",box([-36,10,1855,835]),65*s,GOLD,2.5*s,false);
            // The bottom border passes behind the cards. Erase its covered spans
            // so it cannot shine through the translucent card backgrounds.
            var masks=[[75,712,617,256],[755,712,617,256]], mi, mb;
            doc.activeLayer=outline;
            for(mi=0;mi<masks.length;mi++) {
                mb=box(masks[mi]);
                doc.selection.select([[mb[0],mb[1]],[mb[0]+mb[2],mb[1]],[mb[0]+mb[2],mb[1]+mb[3]],[mb[0],mb[1]+mb[3]]]);
                doc.selection.clear(); doc.selection.deselect();
            }
            var guides=group(root,"98_GUIAS");
            var slots=[SPECS[0].image,SPECS[1].image,SPECS[2].image,[1595,36,194,172],[1407,687,418,346]];
            var guideNames=["AREA_PRODUTO_01","AREA_PRODUTO_02","AREA_PRODUTO_03","AREA_LOGO","AREA_CAMPANHA"], i;
            for(i=0;i<slots.length;i++) rounded(doc,guides,guideNames[i],box(slots[i]),8*s,"999999",1*s,false);
            guides.visible=false;
            for(i=2;i>=0;i--) {
                bar.step(3-i,"Montando oferta "+(i+1));
                var g=group(root,OFFER_NAMES[i]), spec=SPECS[i], o=data.offers[i];
                if(i>0) {
                    var card=i===1?[75,712,617,256]:[755,712,617,256];
                    rounded(doc,g,"BG_CARTAO",box(card),16*s,"171717",0,true).opacity=22;
                    rounded(doc,g,"FORMA_CARTAO",box(card),16*s,GOLD,2.5*s,false);
                }
                var div=i===0?[776,95,3,515]:i===1?[342,745,2.5,195]:[1027,745,2.5,195];
                rectangle(doc,g,"FORMA_DIVISORIA",box(div),GOLD);
                var im=placeImage(doc,g,"IMG_PRODUTO",data.images[i],source?source.images[i]:null,box(spec.image),source);
                if(!im) missing.push("produto "+(i+1));
                var titleLayer=label(g,"TXT_NOME",o.name,data.font,spec.titleSize*s*pointScale,WHITE,box(spec.title));
                var noteBox=box(spec.note), sample=null;
                if(i===2 && trim(o.note) && o.name.indexOf("\r")>=0) {
                    // Measure the last title line using the actual font and
                    // transform; place FRAGRANCIAS on the same line if it fits.
                    try {
                        var titleBounds=bounds(titleLayer);
                        sample=titleLayer.duplicate();
                        sample.textItem.contents=o.name.split("\r").pop();
                        var lastBounds=bounds(sample), inlineX=titleBounds[0]+lastBounds[2]-lastBounds[0]+10*s;
                        var right=(spec.title[0]+spec.title[2])*sx;
                        if(right-inlineX>=100*s) noteBox=[inlineX,titleBounds[3]-20*s,right-inlineX,20*s];
                    } finally { if(sample) sample.remove(); }
                }
                label(g,"TXT_COMPLEMENTO",o.note,data.font,(i===0?32:19)*s*pointScale,WHITE,noteBox);
                makePrice(doc,g,"PRECO_ANTERIOR",o.de,o.unitDe,o.labelDe,box(spec.de),data.font,GOLD,true);
                makePrice(doc,g,"PRECO_ATUAL",o.por,o.unitPor,o.labelPor,box(spec.por),data.font,WHITE,false);
            }
            bar.step(4,"Inserindo marca e campanha");
            var campaign=group(root,"05_CAMPANHA");
            if(!placeImage(doc,campaign,"IMG_CAMPANHA",data.images[4],source?source.images[4]:null,box(slots[4]),source)) missing.push("campanha");
            var brand=group(root,"01_MARCA");
            if(!placeImage(doc,brand,"IMG_LOGO",data.images[3],source?source.images[3]:null,box(slots[3]),source)) missing.push("logotipo");
            bar.step(6,"Compondo o rodapé");
            var footer=group(root,"06_RODAPE"), rowX=0, fields=[["TXT_AVISO_ANTES",data.before,20],["TXT_VALIDADE",data.dates,25],["TXT_AVISO_DEPOIS",data.after,20]];
            for(i=0;i<fields.length;i++) {
                var f=fields[i], tl=putText(footer,f[0],f[1],data.font,f[2]*s*pointScale,WHITE);
                if(trim(f[1])) {
                    var tb=bounds(tl); tl.translate(px(rowX-tb[0]),px(28*s-tb[3]));
                    tb=bounds(tl); rowX=tb[2]+7*s;
                }
            }
            if(rowX>0) fit(footer,box([119,1040,1560,30]),false,true);
            bar.step(8,"Finalizando");
            app.activeDocument=doc; doc.activeLayer=root; success=true;
            return {doc:doc, missing:missing};
        } finally {
            if(bar) try { bar.close(); } catch(ignore) {}
            if(!success && doc) try { app.activeDocument=doc; doc.close(SaveOptions.DONOTSAVECHANGES); } catch(closeError) {}
            app.preferences.rulerUnits=oldUnits; app.preferences.typeUnits=oldType; app.displayDialogs=oldDialogs;
            if(!success && previous) try { app.activeDocument=previous; } catch(restoreError) {}
        }
    }
    try {
        var source=null;
        if(app.documents.length) source=readSource(app.activeDocument);
        var data=form(source); if(!data) return;
        var result=render(data,source);
        var msg="Arte criada em um novo documento, com textos editáveis e camadas nomeadas.\nConfira o resultado e use Salvar como quando desejar.";
        if(result.missing.length) msg+="\n\nEspaços sem imagem: "+result.missing.join(", ")+".\nExecute o script novamente para preencher esses espaços.";
        msg+="\n\nA composição foi reconstruída a partir do print. Fonte, recortes e selo original não estão incluídos.";
        alert(msg,TITLE);
    } catch(e) { alert(errorText(e),TITLE); }
})();
