Attribute VB_Name = "IBD_TextoDimensoesObjeto"
' @ibd-id coreldraw/texto-dimensoes-objeto
' @ibd-titulo Texto com dimensoes do objeto
' @ibd-descricao Cria texto artistico com as dimensoes combinadas dos objetos selecionados na unidade escolhida e na camada de textos.
' @ibd-app coreldraw
' @ibd-versao 1.0.0
' @ibd-tags dimensoes, medida, texto, cota, coreldraw
' @ibd-doc docs/ferramentas-vetor.md

Option Explicit

Public Sub CriarTextoDimensoesObjeto()
    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim origRef As cdrReferencePoint
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
    Dim wMm As Double, hMm As Double
    Dim wVal As String, hVal As String, rotulo As String
    Dim s As Shape
    Dim lx As Double, by As Double, sw As Double, sh As Double
    Dim lyrTexto As Layer
    Dim txtShape As Shape
    Dim gapMm As Double
    Dim grupoIniciado As Boolean

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD — Dimensoes do objeto"
        Exit Sub
    End If

    Set doc = ActiveDocument
    If doc.Selection.Shapes.Count = 0 Then
        MsgBox "Selecione pelo menos um objeto para medir.", vbExclamation, "IBD — Dimensoes do objeto"
        Exit Sub
    End If

    entradaFmt = InputBox( _
        "Unidade (mm, cm, m, px, in, pt) e casas decimais (separados por ;):", _
        "IBD — Unidade e precisao", _
        "mm;1")
    If Trim$(entradaFmt) = "" Then Exit Sub

    partes = Split(entradaFmt, ";")
    unidade = LCase$(Trim$(partes(0)))
    If unidade <> "mm" And unidade <> "cm" And unidade <> "m" And _
       unidade <> "px" And unidade <> "in" And unidade <> "pt" Then
        MsgBox "Unidade invalida. Use mm, cm, m, px, in ou pt.", vbExclamation, "IBD — Dimensoes do objeto"
        Exit Sub
    End If

    decimais = 1
    If UBound(partes) >= 1 Then
        If IsNumeric(Trim$(partes(1))) Then decimais = CLng(Val(Trim$(partes(1))))
    End If
    If decimais < 0 Then decimais = 0
    If decimais > 4 Then decimais = 4

    entradaPos = InputBox( _
        "Posicao (Abaixo, Acima, Centro) e tamanho da fonte em pt (ex: Abaixo;10):", _
        "IBD — Posicionamento do texto", _
        "Abaixo;10")
    If Trim$(entradaPos) = "" Then Exit Sub

    partes = Split(entradaPos, ";")
    posicao = LCase$(Trim$(partes(0)))
    If posicao <> "abaixo" And posicao <> "acima" And posicao <> "centro" Then
        posicao = "abaixo"
    End If

    tamanhoPt = 10#
    If UBound(partes) >= 1 Then
        Dim fsStr As String
        fsStr = Replace(Trim$(partes(1)), ",", ".")
        If IsNumeric(fsStr) And Val(fsStr) > 0# Then tamanhoPt = CSng(Val(fsStr))
    End If

    respTracado = MsgBox( _
        "Incluir a espessura do contorno na medicao?", _
        vbYesNoCancel + vbQuestion, _
        "IBD — Caixa delimitadora")
    If respTracado = vbCancel Then Exit Sub
    incluirTracado = (respTracado = vbYes)

    origUnit = doc.Unit
    origRef = doc.ReferencePoint

    On Error GoTo ErrHandler
    doc.Unit = cdrMillimeter
    doc.ReferencePoint = cdrCenter
    doc.BeginCommandGroup "IBD: Texto com dimensoes"
    grupoIniciado = True

    Set selRange = doc.SelectionRange
    minL = 1E+30
    maxT = -1E+30
    maxR = -1E+30
    minB = 1E+30

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

    Set lyrTexto = ObterOuCriarCamada(doc.ActivePage, "01_TEXTOS")
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

    txtShape.CenterX = (minL + maxR) / 2#
    If posicao = "acima" Then
        txtShape.BottomY = maxT + gapMm
    ElseIf posicao = "centro" Then
        txtShape.CenterY = (minB + maxT) / 2#
    Else
        txtShape.TopY = minB - gapMm
    End If

    doc.EndCommandGroup
    grupoIniciado = False
    doc.ReferencePoint = origRef
    doc.Unit = origUnit
    Exit Sub

ErrHandler:
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    doc.ReferencePoint = origRef
    doc.Unit = origUnit
    MsgBox "Erro ao gerar texto de dimensoes: " & Err.Description, vbCritical, "IBD — Dimensoes do objeto"
End Sub

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
