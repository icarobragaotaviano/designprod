Attribute VB_Name = "IBD_DeslocamentoExpandirContorno"
' @ibd-id coreldraw/deslocamento-expandir-contorno
' @ibd-titulo Deslocamento, expandir e contorno
' @ibd-descricao Aplica contorno deslocado para fora ou dentro na selecao, separa o contorno do efeito, remove o preenchimento e aplica traco CMYK.
' @ibd-app coreldraw
' @ibd-versao 1.0.0
' @ibd-tags contorno, deslocamento, offset, separar, faca, coreldraw
' @ibd-doc docs/ferramentas-vetor.md

Option Explicit

Public Sub DeslocarExpandirContorno()
    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim srOrig As ShapeRange
    Dim srAlvos As ShapeRange
    Dim entrada As String
    Dim partes As Variant
    Dim offsetMm As Double
    Dim codigoCanto As String
    Dim strokePt As Double
    Dim entradaCor As String
    Dim cmykVals(3) As Long
    Dim manterOriginal As Boolean
    Dim unificarFormas As Boolean
    Dim respManter As VbMsgBoxResult
    Dim respUnificar As VbMsgBoxResult
    Dim direcao As cdrContourDirection
    Dim cantoContorno As cdrContourCornerType
    Dim cantoTraco As cdrOutlineLineJoin
    Dim s As Shape
    Dim eff As Effect
    Dim sepRange As ShapeRange
    Dim outShapes As ShapeRange
    Dim colContorno As Color
    Dim colDummy As Color
    Dim grupoIniciado As Boolean
    Dim shapeUnificada As Shape

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD — Contorno deslocado"
        Exit Sub
    End If

    Set doc = ActiveDocument
    If doc.Selection.Shapes.Count = 0 Then
        MsgBox "Selecione pelo menos um objeto vetorial.", vbExclamation, "IBD — Contorno deslocado"
        Exit Sub
    End If

    entrada = InputBox( _
        "Deslocamento mm (+ fora / - dentro); canto (M=Mitra, R=Arredondado, C=Chanfrado); espessura pt:", _
        "IBD — Deslocamento + Expandir + Contorno", _
        "2;M;1")
    If Trim$(entrada) = "" Then Exit Sub

    partes = Split(entrada, ";")
    offsetMm = CDbl(Val(Replace(Trim$(partes(0)), ",", ".")))
    If offsetMm = 0# Then
        MsgBox "Informe um deslocamento diferente de zero.", vbExclamation, "IBD — Contorno deslocado"
        Exit Sub
    End If

    codigoCanto = "M"
    If UBound(partes) >= 1 Then codigoCanto = UCase$(Trim$(partes(1)))

    strokePt = 1#
    If UBound(partes) >= 2 Then
        strokePt = CDbl(Val(Replace(Trim$(partes(2)), ",", ".")))
    End If
    If strokePt <= 0# Then
        MsgBox "A espessura do contorno deve ser maior que zero.", vbExclamation, "IBD — Contorno deslocado"
        Exit Sub
    End If

    entradaCor = InputBox( _
        "Cor CMYK do contorno (C,M,Y,K de 0 a 100 — padrao Magenta corte):", _
        "IBD — Cor do contorno", _
        "0,100,0,0")
    If Trim$(entradaCor) = "" Then Exit Sub
    If Not LerCmyk(entradaCor, cmykVals) Then
        MsgBox "Cor CMYK invalida. Use quatro numeros separados por virgula (ex: 0,100,0,0).", vbExclamation, "IBD — Contorno deslocado"
        Exit Sub
    End If

    respManter = MsgBox( _
        "Manter os objetos originais intactos?", _
        vbYesNoCancel + vbQuestion, _
        "IBD — Manter original")
    If respManter = vbCancel Then Exit Sub
    manterOriginal = (respManter = vbYes)

    unificarFormas = False
    If doc.SelectionRange.Count > 1 Then
        respUnificar = MsgBox( _
            "Unificar (Weld) as " & doc.SelectionRange.Count & " formas selecionadas antes de gerar o contorno?", _
            vbYesNoCancel + vbQuestion, _
            "IBD — Unificar formas")
        If respUnificar = vbCancel Then Exit Sub
        unificarFormas = (respUnificar = vbYes)
    End If

    direcao = IIf(offsetMm > 0#, cdrContourOutside, cdrContourInside)
    Select Case codigoCanto
        Case "R"
            cantoContorno = cdrContourCornerRound
            cantoTraco = cdrOutlineRoundLineJoin
        Case "C"
            cantoContorno = cdrContourCornerBevel
            cantoTraco = cdrOutlineBevelLineJoin
        Case Else
            cantoContorno = cdrContourCornerMiteredOffsetBevel
            cantoTraco = cdrOutlineMiterLineJoin
    End Select

    origUnit = doc.Unit
    On Error GoTo ErrHandler
    doc.Unit = cdrMillimeter
    doc.BeginCommandGroup "IBD: Deslocamento + Contorno"
    grupoIniciado = True

    Set srOrig = doc.SelectionRange
    Set outShapes = Application.CreateShapeRange
    Set colContorno = CreateCMYKColor(cmykVals(0), cmykVals(1), cmykVals(2), cmykVals(3))
    Set colDummy = CreateCMYKColor(cmykVals(0), cmykVals(1), cmykVals(2), cmykVals(3))

    Set srAlvos = Application.CreateShapeRange
    If unificarFormas And srOrig.Count > 1 Then
        Dim dupRange As ShapeRange
        Dim idxW As Long
        Set dupRange = srOrig.Duplicate(0#, 0#)
        Set shapeUnificada = dupRange(1)
        For idxW = 2 To dupRange.Count
            Set shapeUnificada = shapeUnificada.Weld(dupRange(idxW))
        Next idxW
        srAlvos.Add shapeUnificada
    Else
        For Each s In srOrig
            srAlvos.Add s
        Next s
    End If

    For Each s In srAlvos
        doc.Unit = cdrMillimeter
        Set eff = s.CreateContour( _
            direcao, _
            Abs(offsetMm), _
            1, _
            cdrDirectFountainFillBlend, _
            colDummy, _
            colDummy, _
            , _
            0, _
            0, _
            cdrContourSquareCap, _
            cantoContorno, _
            4#)

        Set sepRange = eff.Separate
        ConfigurarContornosSep sepRange, s.StaticID, strokePt, colContorno, cantoTraco, outShapes
    Next s

    If unificarFormas And Not shapeUnificada Is Nothing Then
        shapeUnificada.Delete
        If Not manterOriginal Then srOrig.Delete
    ElseIf Not manterOriginal Then
        srOrig.Delete
    End If

    doc.ClearSelection
    If outShapes.Count > 0 Then outShapes.AddToSelection

    doc.EndCommandGroup
    grupoIniciado = False
    doc.Unit = origUnit
    Exit Sub

ErrHandler:
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    doc.Unit = origUnit
    MsgBox "Erro ao gerar contorno deslocado: " & Err.Description, vbCritical, "IBD — Contorno deslocado"
End Sub

Private Sub ConfigurarContornosSep( _
    ByVal rng As ShapeRange, _
    ByVal idOriginal As Long, _
    ByVal strokePt As Double, _
    ByVal cor As Color, _
    ByVal cantoTraco As cdrOutlineLineJoin, _
    ByVal destino As ShapeRange)

    Dim item As Shape
    Dim subRng As ShapeRange

    For Each item In rng
        If item.StaticID <> idOriginal Then
            If item.Type = cdrGroupShape Then
                Set subRng = item.UngroupEx
                ConfigurarContornosSep subRng, idOriginal, strokePt, cor, cantoTraco, destino
            Else
                item.Fill.ApplyNoFill
                ActiveDocument.Unit = cdrPoint
                item.Outline.SetProperties _
                    Width:=strokePt, _
                    Color:=cor, _
                    BehindFill:=cdrFalse, _
                    ScaleWithShape:=cdrFalse, _
                    LineCaps:=cdrOutlineRoundLineCaps, _
                    LineJoin:=cantoTraco, _
                    MiterLimit:=4#
                ActiveDocument.Unit = cdrMillimeter
                destino.Add item
            End If
        End If
    Next item
End Sub

Private Function LerCmyk(ByVal texto As String, ByRef saida() As Long) As Boolean
    Dim partes As Variant
    Dim i As Long
    Dim v As Long

    partes = Split(Replace(texto, ";", ","), ",")
    If UBound(partes) <> 3 Then
        LerCmyk = False
        Exit Function
    End If
    For i = 0 To 3
        If Not IsNumeric(Trim$(partes(i))) Then
            LerCmyk = False
            Exit Function
        End If
        v = CLng(Val(Trim$(partes(i))))
        If v < 0 Or v > 100 Then
            LerCmyk = False
            Exit Function
        End If
        saida(i) = v
    Next i
    LerCmyk = True
End Function
