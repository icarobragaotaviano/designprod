Attribute VB_Name = "IBD_CriarPecaPadrao"
' @ibd-id coreldraw/criar-peca-padrao
' @ibd-titulo Criar peça gráfica padrão
' @ibd-descricao Cria documento, página ou molde vetorial nas peças mais comuns (cartão 90×50, panfletos 140×100, 140×200, 100×150, A4, A5, tags, etiquetas e outras).
' @ibd-app coreldraw
' @ibd-versao 1.0.0
' @ibd-tags peca, cartao, panfleto, folder, etiqueta, pagina, documento, coreldraw

Option Explicit

Public Function ObterListaPecas() As Variant
    ObterListaPecas = Array( _
        "Cartao de visita BR|90|50", "Panfleto 140x100|140|100", "Panfleto vertical 100x140|100|140", "Panfleto 140x200|140|200", _
        "Panfleto / Postal 100x150|100|150", "Panfleto 150x210|150|210", "A4|210|297", "A5|148|210", _
        "A6|105|148", "A3|297|420", "Cartao de visita ISO|85|55", "Cartao duplo|180|50", _
        "Filipeta / Comanda|100|210", "DL|99|210", "Folder A4 aberto|297|210", "Folder 1 dobra aberto|200|210", _
        "Folder 3 paineis aberto|630|210", "Pasta executiva fechada|220|310", "Pasta aberta|450|310", "Cartaz pequeno|300|420", _
        "Cartaz A3+|310|450", "A7|74|105", "A8|52|74", "A2|420|594", _
        "A1|594|841", "A0|841|1189", "Quadrado 100x100|100|100", "Quadrado 148x148|148|148", _
        "Quadrado 200x200|200|200", "Quadrado 210x210|210|210", "Livro BR|160|230", "Livro tecnico|170|240", _
        "Livro romance|140|210", "Livro pocket|120|180", "Revista|205|275", "Apostila|200|275", _
        "Agenda / Caderno|145|205", "Tabloide|280|380", "Standard|320|520", "Etiqueta pequena 50x30|50|30", _
        "Etiqueta quadrada 50x50|50|50", "Etiqueta media 80x50|80|50", "Etiqueta envio 100x150|100|150", "Tag roupa 50x90|50|90", _
        "Tag pequena 40x85|40|85", "Marcador 50x180|50|180", "Marcador 50x210|50|210", "Ingresso|150|50", _
        "Rifa|200|70", "Talao|140|200", "Pulseira|250|20", "Door hanger|90|210", _
        "Ventarola|180|220", "Wobbler|120|120", "Jogo americano|420|300", "Solapa|100|80", _
        "Cinta|300|60", "Calendario mesa|210|150", "Folhinha|240|340", "Ima de geladeira|50|45", _
        "Envelope DL|229|114", "Envelope C5|162|229", "Envelope Saco A4|240|340")
End Function

Public Sub CriarPecaPadrao()
    Dim lista As Variant
    Dim menu As String
    Dim i As Long
    Dim p As Variant
    Dim entrada As String
    Dim partes As Variant
    Dim idx As Long
    Dim modo As String
    Dim ori As String
    Dim sangria As Double
    Dim margem As Double
    Dim wMm As Double, hMm As Double
    Dim nomeFmt As String
    Dim msg As String

    lista = ObterListaPecas()
    menu = "Escolha o numero da peca (ou digite LxA em mm):" & vbCrLf
    For i = 0 To 9
        p = Split(lista(i), "|")
        menu = menu & (i + 1) & ") " & p(0) & " (" & p(1) & "x" & p(2) & ")   "
        If (i Mod 2) = 1 Then menu = menu & vbCrLf
    Next i
    menu = menu & vbCrLf & "11-63: Cartao ISO/Duplo, Filipeta, DL, Folders, Pastas, Livros, Etiquetas, Tags, PDV, Envelopes" & vbCrLf & _
           "Opcional: numero ; modo (D=Novo Doc, P=Nova Pagina, R=Redim Pagina, M=Molde na pagina) ; ori (V/H) ; margemMm ; sangriaMm"

    entrada = InputBox(menu, "IBD - Criar peca grafica padrao", "1;D;;5;3")
    If Trim$(entrada) = "" Then Exit Sub

    partes = Split(entrada, ";")
    modo = "D"
    ori = ""
    margem = 5#
    sangria = 3#
    If UBound(partes) >= 1 Then modo = UCase$(Trim$(partes(1)))
    If UBound(partes) >= 2 Then ori = UCase$(Trim$(partes(2)))
    If UBound(partes) >= 3 Then margem = Val(Replace(Trim$(partes(3)), ",", "."))
    If UBound(partes) >= 4 Then sangria = Val(Replace(Trim$(partes(4)), ",", "."))

    If InStr(1, partes(0), "x", vbTextCompare) > 0 Then
        Dim dims As Variant
        dims = Split(LCase$(Trim$(partes(0))), "x")
        wMm = Val(Replace(dims(0), ",", "."))
        hMm = Val(Replace(dims(1), ",", "."))
        nomeFmt = "Peca " & wMm & "x" & hMm
    Else
        idx = CLng(Val(Trim$(partes(0)))) - 1
        If idx < 0 Or idx > UBound(lista) Then
            MsgBox "Numero de peca invalido (1 a " & (UBound(lista) + 1) & ").", vbExclamation, "IBD - Peca padrao"
            Exit Sub
        End If
        p = Split(lista(idx), "|")
        nomeFmt = CStr(p(0))
        wMm = Val(p(1))
        hMm = Val(p(2))
    End If

    msg = ExecutarCriarPeca(nomeFmt, wMm, hMm, ori, modo, margem, sangria)
    If Left$(msg, 5) = "ERRO:" Then
        MsgBox Mid$(msg, 6), vbExclamation, "IBD - Peca padrao"
    End If
End Sub

Public Function ExecutarCriarPeca( _
    ByVal nomeFormato As String, _
    ByVal larguraMm As Double, _
    ByVal alturaMm As Double, _
    ByVal orientacao As String, _
    ByVal modo As String, _
    ByVal margemMm As Double, _
    ByVal sangriaMm As Double) As String

    Dim doc As Document
    Dim pg As Page
    Dim origUnit As cdrUnit
    Dim w As Double, h As Double, tmp As Double
    Dim lyrGuias As Layer
    Dim lyrMolde As Layer
    Dim editAntes As Boolean
    Dim xMin As Double, xMax As Double, yMin As Double, yMax As Double
    Dim ret As Shape
    Dim grupoIniciado As Boolean

    w = larguraMm
    h = alturaMm
    If w <= 0# Or h <= 0# Then
        ExecutarCriarPeca = "ERRO: Largura e altura precisam ser maiores que zero."
        Exit Function
    End If

    orientacao = UCase$(Trim$(orientacao))
    If orientacao = "V" Or orientacao = "RETRATO" Then
        If w > h Then tmp = w: w = h: h = tmp
    ElseIf orientacao = "H" Or orientacao = "PAISAGEM" Then
        If h > w Then tmp = w: w = h: h = tmp
    End If

    modo = UCase$(Trim$(modo))
    If modo = "" Then modo = "D"

    On Error GoTo ErrHandler
    If modo = "M" And Not ActiveDocument Is Nothing Then
        Set doc = ActiveDocument
        origUnit = doc.Unit
        doc.Unit = cdrMillimeter
        doc.BeginCommandGroup "IBD: Molde " & nomeFormato
        grupoIniciado = True
        Set pg = doc.ActivePage
        xMin = pg.CenterX - (w / 2#)
        yMin = pg.CenterY - (h / 2#)
        xMax = xMin + w
        yMax = yMin + h
        Set lyrMolde = pg.ActiveLayer
        If lyrMolde Is Nothing Or Not lyrMolde.Editable Then Set lyrMolde = pg.Layers(1)
        Set ret = lyrMolde.CreateRectangle2(xMin, yMin, w, h)
        ret.Name = nomeFormato & " " & Format$(w, "0") & "x" & Format$(h, "0") & "mm"
        ret.Fill.ApplyNoFill
        ret.Outline.SetProperties Width:=0.2, Color:=CreateCMYKColor(0, 100, 0, 0)
        ret.CreateSelection
    ElseIf modo = "D" Or ActiveDocument Is Nothing Then
        Set doc = Application.CreateDocument
        origUnit = doc.Unit
        doc.Unit = cdrMillimeter
        Set pg = doc.ActivePage
        pg.SetSize w, h
        pg.Name = nomeFormato & " " & Format$(w, "0") & "x" & Format$(h, "0") & "mm"
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
    Else
        Set doc = ActiveDocument
        origUnit = doc.Unit
        doc.Unit = cdrMillimeter
        doc.BeginCommandGroup "IBD: Criar peca " & nomeFormato
        grupoIniciado = True
        If modo = "R" Then
            Set pg = doc.ActivePage
            pg.SetSize w, h
            pg.Name = nomeFormato & " " & Format$(w, "0") & "x" & Format$(h, "0") & "mm"
        Else
            Set pg = doc.AddPages(1)
            pg.SetSize w, h
            pg.Name = nomeFormato & " " & Format$(w, "0") & "x" & Format$(h, "0") & "mm"
            pg.Activate
        End If
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
    End If

    If margemMm > 0# Or sangriaMm > 0# Then
        Set lyrGuias = pg.GuidesLayer
        editAntes = lyrGuias.Editable
        lyrGuias.Visible = True
        lyrGuias.Editable = True
        If margemMm > 0# And (2# * margemMm) < w And (2# * margemMm) < h Then
            lyrGuias.CreateGuide xMin + margemMm, yMin, xMin + margemMm, yMax
            lyrGuias.CreateGuide xMax - margemMm, yMin, xMax - margemMm, yMax
            lyrGuias.CreateGuide xMin, yMin + margemMm, xMax, yMin + margemMm
            lyrGuias.CreateGuide xMin, yMax - margemMm, xMax, yMax - margemMm
        End If
        If sangriaMm > 0# Then
            lyrGuias.CreateGuide xMin - sangriaMm, yMin, xMin - sangriaMm, yMax
            lyrGuias.CreateGuide xMax + sangriaMm, yMin, xMax + sangriaMm, yMax
            lyrGuias.CreateGuide xMin, yMin - sangriaMm, xMax, yMin - sangriaMm
            lyrGuias.CreateGuide xMin, yMax + sangriaMm, xMax, yMax + sangriaMm
        End If
        lyrGuias.Editable = editAntes
    End If

    If grupoIniciado Then
        doc.EndCommandGroup
        grupoIniciado = False
    End If
    doc.Unit = cdrMillimeter
    On Error Resume Next
    If modo <> "M" Then ActiveWindow.ActiveView.ToFitPage
    On Error GoTo 0
    ExecutarCriarPeca = "Peca criada: " & nomeFormato & " (" & Format$(w, "0.#") & " x " & Format$(h, "0.#") & " mm)."
    Exit Function

ErrHandler:
    Dim desc As String
    desc = Err.Description
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    If Not doc Is Nothing And modo <> "D" Then doc.Unit = origUnit
    ExecutarCriarPeca = "ERRO: Erro ao criar peca padrao: " & desc
End Function
