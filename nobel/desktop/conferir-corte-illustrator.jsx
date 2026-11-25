#target illustrator
(function () {
    if (!app.documents.length || !app.activeDocument.selection.length) { alert("Selecione os caminhos de corte."); return; }
    var encontrados = {}, caminhos = [], mensagens = [];
    function recolher(o) {
        var i;
        if (o.typename === "PathItem" && !o.guides && !o.clipping && !o.hidden && !o.locked) caminhos.push(o);
        if (o.typename === "GroupItem") for(i=0;i<o.pageItems.length;i++) recolher(o.pageItems[i]);
        if (o.typename === "CompoundPathItem") for(i=0;i<o.pathItems.length;i++) recolher(o.pathItems[i]);
    }
    for (var i=0;i<app.activeDocument.selection.length;i++) recolher(app.activeDocument.selection[i]);
    if (!caminhos.length) { alert("Nenhum caminho editável na seleção."); return; }
    var v = prompt("Diâmetro da fresa em mm (0 para plotter)", "3");
    if (v === null) return;
    var fresa = Number(v.replace(",","."));
    if (!(fresa >= 0)) { alert("Diâmetro inválido."); return; }
    function assinatura(p){
        var pts=[], melhor, k, j, seq;
        for(j=0;j<p.pathPoints.length;j++){
            var q=p.pathPoints[j];pts.push([String(q.anchor),String(q.leftDirection),String(q.rightDirection)]);
        }
        // Chaves de aresta, incluindo alças. Ordenação elimina diferença de origem e orientação.
        var segmentos=[], n=pts.length;
        for(k=0;k<(p.closed?n:n-1);k++){
            var a=pts[k], b=pts[(k+1)%n];
            seq=[a[0],a[2],b[1],b[0]].join("/");
            melhor=[b[0],b[1],a[2],a[0]].join("/");
            segmentos.push(seq<melhor?seq:melhor);
        }
        return String(p.closed)+"|"+segmentos.sort().join(";");
    }
    for (i=0;i<caminhos.length;i++) {
        var p=caminhos[i], nome=(i+1)+". "+(p.name||"Caminho"), chave=assinatura(p);
        if (!p.closed) mensagens.push(nome+" · caminho aberto");
        if (p.pathPoints.length<2) mensagens.push(nome+" · menos de dois nós");
        if (encontrados[chave]) mensagens.push(nome+" · coincide com "+encontrados[chave]);
        else encontrados[chave]=nome;
        var b=p.geometricBounds;
        if(fresa && Math.min(b[2]-b[0],b[1]-b[3])*25.4/72 < fresa) mensagens.push(nome+" · menor dimensão inferior à fresa");
    }
    if (!mensagens.length) { alert(caminhos.length+" caminho(s) conferido(s)."); return; }
    var w=new Window("dialog","IBD · Conferência de corte");
    var campo=w.add("edittext",undefined,mensagens.join("\n"),{multiline:true,readonly:true,scrolling:true});campo.preferredSize=[640,360];
    w.add("button",undefined,"Fechar",{name:"ok"});w.show();
}());
