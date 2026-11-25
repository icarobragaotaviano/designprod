Attribute VB_Name = "IBD_DeslocamentoExpandirContorno"
' @ibd-id coreldraw/deslocamento-expandir-contorno
' @ibd-titulo Gerar contorno deslocado e expandido
' @ibd-descricao Aplica contorno vetorial deslocado (externo ou interno), separa o efeito em curvas editáveis, limpa preenchimento e aplica traço CMYK ou RGB.
' @ibd-app coreldraw
' @ibd-versao 1.1.0
' @ibd-tags contorno, deslocamento, offset, separar, faca, coreldraw
' @ibd-doc docs/ferramentas-vetor.md

Option Explicit

Public Sub DeslocarExpandirContorno()
    Dim doc As Document
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
    Dim msg As String

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD - Contorno deslocado"
        Exit Sub
    End If

    Set doc = ActiveDocument
    If doc.SelectionRange.Count = 0 Then
        MsgBox "Selecione pelo menos um objeto vetorial.", vbExclamation, "IBD - Contorno deslocado"
        Exit Sub
    End If

    entrada = InputBox( _
        "Selecao: " & doc.SelectionRange.Count & " objeto(s)" & vbCrLf & _
        "Config rapida: desloc mm (+ fora/- dentro) ; canto (M/R/C) ; pt ; CMYK ; manter (S/N):", _
        "IBD - Deslocamento + Expandir + Contorno", _
        "2;M;1;0,100,0,0;S")
    If Trim$(entrada) = "" Then Exit Sub

    partes = Split(entrada, ";")
    offsetMm = Val(Replace(Trim$(partes(0)), ",", "."))
    If offsetMm = 0# Then
        MsgBox "Informe um deslocamento diferente de zero.", vbExclamation, "IBD - Contorno deslocado"
        Exit Sub
    End If

    codigoCanto = "M"
    If UBound(partes) >= 1 Then codigoCanto = UCase$(Trim$(partes(1)))

    strokePt = 1#
    If UBound(partes) >= 2 Then
        strokePt = Val(Replace(Trim$(partes(2)), ",", "."))
    End If
    If strokePt <= 0# Then
        MsgBox "A espessura do contorno deve ser maior que zero.", vbExclamation, "IBD - Contorno deslocado"
        Exit Sub
    End If

    If UBound(partes) >= 3 Then
        entradaCor = Trim$(partes(3))
    Else
        entradaCor = InputBox( _
            "Cor CMYK do contorno (C,M,Y,K de 0 a 100 - padrao Magenta corte):", _
            "IBD - Cor do contorno", _
            "0,100,0,0")
        If Trim$(entradaCor) = "" Then Exit Sub
    End If
    If Not LerCmyk(entradaCor, cmykVals) Then
        MsgBox "Cor CMYK invalida. Use quatro numeros separados por virgula (ex: 0,100,0,0).", vbExclamation, "IBD - Contorno deslocado"
        Exit Sub
    End If

    If UBound(partes) >= 4 Then
        manterOriginal = (UCase$(Trim$(partes(4))) <> "N")
    Else
        respManter = MsgBox( _
            "Manter os objetos originais intactos?", _
            vbYesNoCancel + vbQuestion, _
            "IBD - Manter original")
        If respManter = vbCancel Then Exit Sub
        manterOriginal = (respManter = vbYes)
    End If

    unificarFormas = False
    If doc.SelectionRange.Count > 1 Then
        respUnificar = MsgBox( _
            "Unificar (Weld/Boundary) as " & doc.SelectionRange.Count & " formas selecionadas antes de gerar o contorno?", _
            vbYesNoCancel + vbQuestion, _
            "IBD - Unificar formas")
        If respUnificar = vbCancel Then Exit Sub
        unificarFormas = (respUnificar = vbYes)
    End If

    msg = ExecutarDeslocarContorno(offsetMm, codigoCanto, strokePt, cmykVals(0), cmykVals(1), cmykVals(2), cmykVals(3), manterOriginal, unificarFormas)
    If Left$(msg, 5) = "ERRO:" Then
        MsgBox Mid$(msg, 6), vbExclamation, "IBD - Contorno deslocado"
    End If
End Sub

Public Function ExecutarDeslocarContorno( _
    ByVal offsetMm As Double, _
    ByVal codigoCanto As String, _
    ByVal strokePt As Double, _
    ByVal cC As Long, ByVal cM As Long, ByVal cY As Long, ByVal cK As Long, _
    ByVal manterOriginal As Boolean, _
    ByVal unificarFormas As Boolean) As String

    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim srOrig As ShapeRange
    Dim srAlvos As ShapeRange
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
    Dim strokeMm As Double
    Dim gerados As Long

    If ActiveDocument Is Nothing Then
        ExecutarDeslocarContorno = "ERRO: Abra um documento antes de executar."
        Exit Function
    End If

    Set doc = ActiveDocument
    If doc.SelectionRange.Count = 0 Then
        ExecutarDeslocarContorno = "ERRO: Selecione pelo menos um objeto vetorial."
        Exit Function
    End If
    If offsetMm = 0# Then
        ExecutarDeslocarContorno = "ERRO: Informe um deslocamento diferente de zero."
        Exit Function
    End If
    If strokePt <= 0# Then
        ExecutarDeslocarContorno = "ERRO: A espessura do contorno deve ser maior que zero."
        Exit Function
    End If

    direcao = IIf(offsetMm > 0#, cdrContourOutside, cdrContourInside)
    Select Case UCase$(Trim$(codigoCanto))
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
    strokeMm = Application.ConvertUnits(strokePt, cdrPoint, cdrMillimeter)
    doc.BeginCommandGroup "IBD: Deslocamento + Contorno"
    grupoIniciado = True

    Set srOrig = doc.SelectionRange
    Set outShapes = Application.CreateShapeRange
    Set colContorno = CreateCMYKColor(cC, cM, cY, cK)
    Set colDummy = CreateCMYKColor(cC, cM, cY, cK)

    Set srAlvos = Application.CreateShapeRange
    If unificarFormas And srOrig.Count > 1 Then
        Set shapeUnificada = UnificarFormasSeguro(srOrig)
        If Not shapeUnificada Is Nothing Then
            srAlvos.Add shapeUnificada
        Else
            For Each s In srOrig
                srAlvos.Add s
            Next s
        End If
    Else
        For Each s In srOrig
            srAlvos.Add s
        Next s
    End If

    gerados = 0
    For Each s In srAlvos
        Set eff = CriarContornoSeguro(s, direcao, Abs(offsetMm), colDummy, cantoContorno)
        If Not eff Is Nothing Then
            Set sepRange = eff.Separate
            If Not sepRange Is Nothing Then
                ConfigurarContornosSep sepRange, s.StaticID, strokeMm, colContorno, cantoTraco, outShapes
                gerados = gerados + 1
            End If
        End If
    Next s

    If Not shapeUnificada Is Nothing Then
        On Error Resume Next
        shapeUnificada.Delete
        On Error GoTo ErrHandler
    End If
    If Not manterOriginal And gerados > 0 Then
        srOrig.Delete
    End If

    doc.ClearSelection
    If outShapes.Count > 0 Then outShapes.AddToSelection

    doc.EndCommandGroup
    grupoIniciado = False
    doc.Unit = origUnit

    If outShapes.Count = 0 Then
        ExecutarDeslocarContorno = "ERRO: Nenhum contorno pode ser gerado (verifique se o objeto e vetorial ou se o recuo negativo e maior que a forma)."
    Else
        ExecutarDeslocarContorno = outShapes.Count & " contorno(s) deslocado(s) gerado(s) (" & Format$(offsetMm, "0.0") & " mm)."
    End If
    Exit Function

ErrHandler:
    Dim descErro As String
    descErro = Err.Description
    On Error Resume Next
    If Not shapeUnificada Is Nothing Then shapeUnificada.Delete
    If grupoIniciado Then doc.EndCommandGroup
    doc.Unit = origUnit
    ExecutarDeslocarContorno = "ERRO: Erro ao gerar contorno deslocado: " & descErro
End Function

Private Function UnificarFormasSeguro(ByVal srOrig As ShapeRange) As Shape
    Dim dupRange As ShapeRange
    Dim unif As Shape
    Dim idxW As Long

    ' Primeiro tenta CreateBoundary (funciona inclusive com grupos e textos sem falhar)
    On Error Resume Next
    Set unif = srOrig.CreateBoundary(0#, 0#, True, False)
    If Err.Number = 0 And Not unif Is Nothing Then
        On Error GoTo 0
        Set UnificarFormasSeguro = unif
        Exit Function
    End If
    Err.Clear

    ' Fallback para versoes mais antigas: duplicar e Weld sequencial
    Set dupRange = srOrig.Duplicate(0#, 0#)
    If dupRange Is Nothing Or dupRange.Count = 0 Then
        On Error GoTo 0
        Exit Function
    End If
    Set unif = dupRange(1)
    For idxW = 2 To dupRange.Count
        Set unif = unif.Weld(dupRange(idxW))
        If Err.Number <> 0 Then
            Err.Clear
            dupRange.Delete
            Set unif = Nothing
            Exit For
        End If
    Next idxW
    On Error GoTo 0
    Set UnificarFormasSeguro = unif
End Function

Private Function CriarContornoSeguro( _
    ByVal s As Shape, _
    ByVal direcao As cdrContourDirection, _
    ByVal distMm As Double, _
    ByVal colDummy As Color, _
    ByVal cantoContorno As cdrContourCornerType) As Effect

    Dim eff As Effect

    ' Assinatura completa (CorelDRAW X6 - 2025+)
    On Error Resume Next
    Set eff = s.CreateContour( _
        direcao, _
        distMm, _
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
    If Err.Number = 0 And Not eff Is Nothing Then
        On Error GoTo 0
        Set CriarContornoSeguro = eff
        Exit Function
    End If
    Err.Clear

    ' Fallback compativel com CorelDRAW X3 / X4 / X5
    Set eff = s.CreateContour( _
        direcao, _
        distMm, _
        1, _
        cdrDirectFountainFillBlend, _
        colDummy, _
        colDummy)
    If Err.Number = 0 And Not eff Is Nothing Then
        On Error GoTo 0
        Set CriarContornoSeguro = eff
        Exit Function
    End If
    Err.Clear
    On Error GoTo 0
    Set CriarContornoSeguro = Nothing
End Function

Private Sub ConfigurarContornosSep( _
    ByVal rng As ShapeRange, _
    ByVal idOriginal As Long, _
    ByVal strokeMm As Double, _
    ByVal cor As Color, _
    ByVal cantoTraco As cdrOutlineLineJoin, _
    ByVal destino As ShapeRange)

    Dim item As Shape
    Dim subRng As ShapeRange

    For Each item In rng
        If item.StaticID <> idOriginal Then
            If item.Type = cdrGroupShape Then
                Set subRng = item.UngroupEx
                ConfigurarContornosSep subRng, idOriginal, strokeMm, cor, cantoTraco, destino
            Else
                On Error Resume Next
                If item.CanHaveFill Then item.Fill.ApplyNoFill
                If item.CanHaveOutline Then
                    item.Outline.SetProperties _
                        Width:=strokeMm, _
                        Color:=cor, _
                        BehindFill:=cdrFalse, _
                        ScaleWithShape:=cdrFalse, _
                        LineCaps:=cdrOutlineRoundLineCaps, _
                        LineJoin:=cantoTraco, _
                        MiterLimit:=4#
                    If Err.Number <> 0 Then
                        Err.Clear
                        item.Outline.SetProperties _
                            Width:=strokeMm, _
                            Color:=cor, _
                            BehindFill:=cdrFalse, _
                            ScaleWithShape:=cdrFalse, _
                            LineCaps:=cdrOutlineRoundLineCaps, _
                            LineJoin:=cantoTraco
                    End If
                End If
                On Error GoTo 0
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
