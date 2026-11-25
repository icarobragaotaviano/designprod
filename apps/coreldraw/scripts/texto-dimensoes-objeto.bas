Attribute VB_Name = "IBD_TextoDimensoesObjeto"
' @ibd-id coreldraw/texto-dimensoes-objeto
' @ibd-titulo Cotar dimensões da seleção em texto
' @ibd-descricao Mede a caixa delimitadora da seleção na unidade escolhida (mm, cm, m, px, in ou pt) e cria texto artístico L × A na camada 01_TEXTOS.
' @ibd-app coreldraw
' @ibd-versao 1.1.0
' @ibd-tags dimensoes, medida, texto, cota, coreldraw
' @ibd-doc docs/ferramentas-vetor.md

Option Explicit

Public Sub CriarTextoDimensoesObjeto()
    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim selRange As ShapeRange
    Dim entradaFmt As String
    Dim entradaPos As String
    Dim partes As Variant
    Dim unidade As String
    Dim decimais As Long
    Dim posicao As String
    Dim tamanhoPt As Single
    Dim incluirTracado As Boolean
    Dim respTracado As VbMsgBoxResult
    Dim minL As Double, maxT As Double, maxR As Double, minB As Double
    Dim s As Shape
    Dim lx As Double, by As Double, sw As Double, sh As Double
    Dim msg As String

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD - Dimensoes do objeto"
        Exit Sub
    End If

    Set doc = ActiveDocument
    If doc.SelectionRange.Count = 0 Then
        MsgBox "Selecione pelo menos um objeto para medir.", vbExclamation, "IBD - Dimensoes do objeto"
        Exit Sub
    End If

    origUnit = doc.Unit
    doc.Unit = cdrMillimeter
    Set selRange = doc.SelectionRange
    minL = 1E+30: maxT = -1E+30: maxR = -1E+30: minB = 1E+30
    For Each s In selRange
        s.GetBoundingBox lx, by, sw, sh, True
        If lx < minL Then minL = lx
        If by < minB Then minB = by
        If (lx + sw) > maxR Then maxR = lx + sw
        If (by + sh) > maxT Then maxT = by + sh
    Next s
    doc.Unit = origUnit

    entradaFmt = InputBox( _
        "Selecao: " & Format$(maxR - minL, "0.0") & " x " & Format$(maxT - minB, "0.0") & " mm" & vbCrLf & _
        "Config rapida: unidade ; casas ; posicao (Abaixo/Acima/Centro) ; fonte pt ; tracado (S/N)", _
        "IBD - Dimensoes do objeto", _
        "mm;1;Abaixo;10;S")
    If Trim$(entradaFmt) = "" Then Exit Sub

    partes = Split(entradaFmt, ";")
    unidade = LCase$(Trim$(partes(0)))
    If unidade <> "mm" And unidade <> "cm" And unidade <> "m" And _
       unidade <> "px" And unidade <> "in" And unidade <> "pt" Then
        MsgBox "Unidade invalida. Use mm, cm, m, px, in ou pt.", vbExclamation, "IBD - Dimensoes do objeto"
        Exit Sub
    End If

    decimais = 1
    If UBound(partes) >= 1 Then
        decimais = CLng(Val(Replace(Trim$(partes(1)), ",", ".")))
    End If
    If decimais < 0 Then decimais = 0
    If decimais > 4 Then decimais = 4

    If UBound(partes) >= 2 Then
        posicao = LCase$(Trim$(partes(2)))
        If posicao <> "abaixo" And posicao <> "acima" And posicao <> "centro" Then posicao = "abaixo"

        tamanhoPt = 10#
        If UBound(partes) >= 3 Then
            Dim fsUnif As Double
            fsUnif = Val(Replace(Trim$(partes(3)), ",", "."))
            If fsUnif > 0# Then tamanhoPt = CSng(fsUnif)
        End If

        incluirTracado = True
        If UBound(partes) >= 4 Then
            incluirTracado = (UCase$(Trim$(partes(4))) <> "N")
        End If
    Else
        entradaPos = InputBox( _
            "Posicao (Abaixo, Acima, Centro) e tamanho da fonte em pt (ex: Abaixo;10):", _
            "IBD - Posicionamento do texto", _
            "Abaixo;10")
        If Trim$(entradaPos) = "" Then Exit Sub

        partes = Split(entradaPos, ";")
        posicao = LCase$(Trim$(partes(0)))
        If posicao <> "abaixo" And posicao <> "acima" And posicao <> "centro" Then posicao = "abaixo"

        tamanhoPt = 10#
        If UBound(partes) >= 1 Then
            Dim fsVal As Double
            fsVal = Val(Replace(Trim$(partes(1)), ",", "."))
            If fsVal > 0# Then tamanhoPt = CSng(fsVal)
        End If

        respTracado = MsgBox( _
            "Incluir a espessura do contorno na medicao?", _
            vbYesNoCancel + vbQuestion, _
            "IBD - Caixa delimitadora")
        If respTracado = vbCancel Then Exit Sub
        incluirTracado = (respTracado = vbYes)
    End If

    msg = ExecutarTextoDimensoes(unidade, decimais, posicao, tamanhoPt, incluirTracado, "01_TEXTOS")
    If Left$(msg, 5) = "ERRO:" Then
        MsgBox Mid$(msg, 6), vbExclamation, "IBD - Dimensoes do objeto"
    End If
End Sub

Public Function ExecutarTextoDimensoes( _
    ByVal unidade As String, _
    ByVal decimais As Long, _
    ByVal posicao As String, _
    ByVal tamanhoPt As Single, _
    ByVal incluirTracado As Boolean, _
    ByVal nomeCamada As String) As String

    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim origRef As cdrReferencePoint
    Dim selRange As ShapeRange
    Dim minL As Double, maxT As Double, maxR As Double, minB As Double
    Dim wMm As Double, hMm As Double
    Dim wVal As String, hVal As String, rotulo As String
    Dim s As Shape
    Dim lx As Double, by As Double, sw As Double, sh As Double
    Dim lyrTexto As Layer
    Dim editavelAntes As Boolean
    Dim txtShape As Shape
    Dim gapMm As Double
    Dim grupoIniciado As Boolean

    If ActiveDocument Is Nothing Then
        ExecutarTextoDimensoes = "ERRO: Abra um documento antes de executar."
        Exit Function
    End If

    Set doc = ActiveDocument
    If doc.SelectionRange.Count = 0 Then
        ExecutarTextoDimensoes = "ERRO: Selecione pelo menos um objeto para medir."
        Exit Function
    End If

    unidade = LCase$(Trim$(unidade))
    If unidade <> "mm" And unidade <> "cm" And unidade <> "m" And _
       unidade <> "px" And unidade <> "in" And unidade <> "pt" Then unidade = "mm"
    If decimais < 0 Then decimais = 0
    If decimais > 4 Then decimais = 4
    If tamanhoPt <= 0# Then tamanhoPt = 10#
    posicao = LCase$(Trim$(posicao))
    If Trim$(nomeCamada) = "" Then nomeCamada = "01_TEXTOS"

    origUnit = doc.Unit
    origRef = doc.ReferencePoint

    On Error GoTo ErrHandler
    doc.Unit = cdrMillimeter
    doc.ReferencePoint = cdrCenter
    doc.BeginCommandGroup "IBD: Texto com dimensoes"
    grupoIniciado = True

    Set selRange = doc.SelectionRange
    minL = 1E+30: maxT = -1E+30: maxR = -1E+30: minB = 1E+30

    For Each s In selRange
        s.GetBoundingBox lx, by, sw, sh, incluirTracado
        If lx < minL Then minL = lx
        If by < minB Then minB = by
        If (lx + sw) > maxR Then maxR = lx + sw
        If (by + sh) > maxT Then maxT = by + sh
    Next s

    wMm = maxR - minL
    hMm = maxT - minB
    wVal = FormatarUnidade(wMm, unidade, decimais)
    hVal = FormatarUnidade(hMm, unidade, decimais)
    rotulo = wVal & " x " & hVal & " " & unidade

    Set lyrTexto = ObterOuCriarCamada(doc.ActivePage, nomeCamada)
    editavelAntes = lyrTexto.Editable
    lyrTexto.Visible = True
    lyrTexto.Editable = True

    gapMm = 3#
    Set txtShape = lyrTexto.CreateArtisticText( _
        (minL + maxR) / 2#, _
        minB - gapMm, _
        rotulo, _
        , _
        , _
        "Arial", _
        tamanhoPt, _
        cdrFalse, _
        cdrFalse, _
        , _
        cdrCenterAlignment)

    ' Garante preenchimento visivel caso o estilo padrao esteja sem cor
    On Error Resume Next
    If txtShape.Fill.Type = cdrNoFill Then
        txtShape.Fill.ApplyUniformFill CreateCMYKColor(0, 0, 0, 100)
    End If
    On Error GoTo ErrHandler

    txtShape.CenterX = (minL + maxR) / 2#
    If posicao = "acima" Then
        txtShape.BottomY = maxT + gapMm
    ElseIf posicao = "centro" Then
        txtShape.CenterY = (minB + maxT) / 2#
    Else
        txtShape.TopY = minB - gapMm
    End If

    lyrTexto.Editable = editavelAntes
    doc.EndCommandGroup
    grupoIniciado = False
    doc.ReferencePoint = origRef
    doc.Unit = origUnit
    ExecutarTextoDimensoes = "Cota criada: " & rotulo & " (camada " & nomeCamada & ")."
    Exit Function

ErrHandler:
    Dim descErro As String
    descErro = Err.Description
    On Error Resume Next
    If Not lyrTexto Is Nothing Then lyrTexto.Editable = editavelAntes
    If grupoIniciado Then doc.EndCommandGroup
    doc.ReferencePoint = origRef
    doc.Unit = origUnit
    ExecutarTextoDimensoes = "ERRO: Erro ao gerar texto de dimensoes: " & descErro
End Function

Private Function FormatarUnidade(ByVal valorMm As Double, ByVal unidade As String, ByVal casas As Long) As String
    Dim fatorMm As Double
    Dim convertido As Double
    Dim mascara As String

    Select Case unidade
        Case "cm": fatorMm = 10#
        Case "m":  fatorMm = 1000#
        Case "in": fatorMm = 25.4
        Case "pt": fatorMm = 25.4 / 72#
        Case "px": fatorMm = 25.4 / 96#
        Case Else: fatorMm = 1#
    End Select

    convertido = valorMm / fatorMm
    If casas = 0 Then
        mascara = "0"
    Else
        mascara = "0." & String$(casas, "0")
    End If
    FormatarUnidade = Replace(Format$(convertido, mascara), ".", ",")
End Function

Private Function ObterOuCriarCamada(ByVal pg As Page, ByVal nome As String) As Layer
    Dim lyr As Layer
    For Each lyr In pg.Layers
        If StrComp(lyr.Name, nome, vbTextCompare) = 0 Then
            Set ObterOuCriarCamada = lyr
            Exit Function
        End If
    Next lyr
    Set ObterOuCriarCamada = pg.CreateLayer(nome)
End Function
