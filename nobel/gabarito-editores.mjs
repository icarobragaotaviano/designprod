// Posições em mm a partir do corte superior esquerdo, independentes do editor.
export function planoEditor(dados) {
  const {largura, altura, sangria, reserva, seguranca, lado} = dados;
  if (![largura, altura, sangria, reserva, seguranca].every(Number.isFinite) ||
      largura <= 0 || altura <= 0 || Math.min(sangria,reserva,seguranca) < 0) {
    throw Error('Medidas inválidas para o gabarito.');
  }
  const distancia = reserva + seguranca;
  const horizontal = lado === 'superior' || lado === 'inferior';
  if (!['superior','inferior','esquerda','direita'].includes(lado) ||
      distancia >= (horizontal ? altura : largura)) throw Error('Reserva incompatível com o formato.');
  const y = lado === 'inferior' ? altura - distancia : distancia;
  const x = lado === 'direita' ? largura - distancia : distancia;
  return {largura,altura,sangria,guia:horizontal ? [[0,y],[largura,y]] : [[x,0],[x,altura]]};
}

export function scriptIllustrator(dados) {
  const p = planoEditor(dados);
  return `#target illustrator
(function () {
    var plano = ${JSON.stringify(p)};
    var pt = 72 / 25.4;
    var preset = new DocumentPreset();
    preset.width = plano.largura * pt;
    preset.height = plano.altura * pt;
    preset.units = RulerUnits.Millimeters;
    preset.colorMode = DocumentColorSpace.CMYK;
    var b = plano.sangria * pt;
    preset.documentBleedLink = true;
    preset.documentBleedOffsetRect = [b,b,b,b];
    var perfis = app.startupPresetsList;
    if (!perfis.length) throw Error('Nenhum perfil de documento instalado.');
    var doc = app.documents.addDocument(perfis[0], preset);
    var arte = doc.activeLayer;
    arte.name = "Arte";
    var tecnica = doc.layers.add();
    tecnica.name = "Guia Wire-o";
    tecnica.printable = false;
    var rect = doc.artboards[0].artboardRect;
    function pos(p) { return [rect[0] + p[0]*pt, rect[1] - p[1]*pt]; }
    var guia = tecnica.pathItems.add();
    guia.setEntirePath([pos(plano.guia[0]),pos(plano.guia[1])]);
    guia.guides = true;
    tecnica.locked = true;
    doc.activeLayer = arte;
}());
`;
}

export function moduloCorel(dados) {
  const {largura,altura,sangria,guia} = planoEditor(dados);
  // O nome único permite importar mais de um gabarito no mesmo projeto VBA.
  const assinatura = [largura,altura,sangria,...guia.flat()].join(':');
  let hash = 2166136261;
  for (const letra of assinatura) hash = Math.imul(hash ^ letra.charCodeAt(0),16777619);
  const codigo = (hash >>> 0).toString(16);
  return `Attribute VB_Name = "IBDGabarito_${codigo}"
Option Explicit

Public Sub CriarGabarito_${codigo}()
    Dim doc As Document, pg As Page, arte As Layer, tecnica As Layer, guia As Shape
    Set doc = Application.CreateDocument
    doc.Unit = cdrMillimeter
    Set pg = doc.ActivePage
    pg.SetSize ${largura}, ${altura}
    pg.Bleed = ${sangria}
    Set arte = pg.ActiveLayer
    arte.Name = "Arte"
    Set tecnica = pg.CreateLayer("Guia Wire-o")
    tecnica.Printable = False
    Set guia = tecnica.CreateLineSegment(pg.LeftX + ${guia[0][0]}, pg.TopY - ${guia[0][1]}, pg.LeftX + ${guia[1][0]}, pg.TopY - ${guia[1][1]})
    guia.Outline.Color.RGBAssign 224, 75, 30
    tecnica.Editable = False
    arte.Activate
End Sub
`.replace(/\n/g,'\r\n');
}
