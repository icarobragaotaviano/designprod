Attribute VB_Name = "IBDRemendoAdesivo"
Option Explicit

Public Sub CriarRemendoAdesivo()
    If Documents.Count = 0 Then Exit Sub
    Dim selecionados As ShapeRange
    Set selecionados = ActiveSelectionRange
    If selecionados.Count = 0 Then
        MsgBox "Selecione toda a arte da pagina que deve aparecer no remendo.": Exit Sub
    End If

    Dim entrada As String, dados As Variant, i As Integer, medida(0 To 4) As Double
    entrada = InputBox("X; Y; largura; altura; margem em mm. X/Y a partir do canto superior esquerdo da pagina.", "IBD - Remendo de adesivo", "10;10;50;30;3")
    If entrada = "" Then Exit Sub
    dados = Split(entrada, ";")
    If UBound(dados) <> 4 Then GoTo Invalido
    On Error GoTo Invalido
    Dim campo As String, separador As String
    separador = Mid$(CStr(1.5), 2, 1)
    For i = 0 To 4
        campo = Trim$(dados(i))
        If Len(campo) = 0 Or campo Like "*[!0123456789.,]*" Then GoTo Invalido
        campo = Replace$(Replace$(campo, ".", separador), ",", separador)
        If InStr(campo, separador) <> InStrRev(campo, separador) Or Not IsNumeric(campo) Then GoTo Invalido
        medida(i) = CDbl(campo)
    Next i
    If medida(2) <= 0 Or medida(3) <= 0 Then GoTo Invalido

    Dim fonte As Document, pgFonte As Page, unidade As cdrUnit, w As Double, h As Double
    Set fonte = ActiveDocument
    Set pgFonte = ActivePage
    unidade = fonte.Unit
    w = EmMm(pgFonte.SizeWidth, unidade)
    h = EmMm(pgFonte.SizeHeight, unidade)
    If medida(0) + medida(2) > w + 0.000001 Or medida(1) + medida(3) > h + 0.000001 Then GoTo Invalido

    Dim x As Double, y As Double, finalW As Double, finalH As Double
    x = Maior(0, medida(0) - medida(4))
    y = Maior(0, medida(1) - medida(4))
    finalW = Menor(w, medida(0) + medida(2) + medida(4)) - x
    finalH = Menor(h, medida(1) + medida(3) + medida(4)) - y

    Dim originalX As Double, originalY As Double, bbW As Double, bbH As Double
    selecionados.GetBoundingBox originalX, originalY, bbW, bbH, False
    originalX = EmMm(originalX - pgFonte.LeftX, unidade)
    originalY = EmMm(originalY - pgFonte.BottomY, unidade)

    Dim copia As Document, folha As Page, arte As ShapeRange, clipe As Shape, px As Double, py As Double
    On Error GoTo Falha
    Set copia = selecionados.CreateDocumentFrom(False)
    copia.Unit = cdrMillimeter
    Set folha = copia.ActivePage
    folha.SetSize finalW, finalH
    Set arte = folha.Shapes.All
    If arte.Count = 0 Then Err.Raise 5, , "A copia ficou vazia."
    arte.GetBoundingBox px, py, bbW, bbH, False
    arte.Move folha.LeftX + originalX - x - px, folha.BottomY + originalY - (h - y - finalH) - py
    Set clipe = folha.ActiveLayer.CreateRectangle2(folha.LeftX, folha.BottomY, finalW, finalH)
    clipe.Fill.ApplyNoFill
    clipe.Outline.SetNoOutline
    arte.AddToPowerClip clipe, cdrFalse
    MsgBox "Remendo editavel criado. X " & Round(x, 3) & " / Y " & Round(y, 3) & " mm. Formato " & Round(finalW, 3) & " x " & Round(finalH, 3) & " mm."
    Exit Sub
Invalido:
    MsgBox "Revise os valores. O dano precisa caber na pagina de origem."
    Exit Sub
Falha:
    Dim aviso As String
    aviso = Err.Description
    On Error Resume Next
    If Not copia Is Nothing Then
        copia.Dirty = False
        copia.Close
    End If
    fonte.Activate
    MsgBox aviso
End Sub

Private Function EmMm(ByVal n As Double, ByVal u As cdrUnit) As Double
    EmMm = Application.ConvertUnits(n, u, cdrMillimeter)
End Function

Private Function Menor(ByVal a As Double, ByVal b As Double) As Double
    If a < b Then Menor = a Else Menor = b
End Function

Private Function Maior(ByVal a As Double, ByVal b As Double) As Double
    If a > b Then Maior = a Else Maior = b
End Function
