Attribute VB_Name = "ImposicaoArteCorte"
Option Explicit

Public Sub MontarArteEFaca()
    On Error GoTo Falha
    Dim doc As Document, origem As Page, paginaArte As Page, paginaFaca As Page
    Dim unidade As cdrUnit, grupo As Boolean, mudouUnidade As Boolean
    Dim original As Shape, mestre As Shape, copia As Shape
    Dim camadaArte As Layer, camadaFaca As Layer, camadaMarcas As Layer
    Dim efeito As Effect, partes As ShapeRange, parte As Shape, direcao As cdrContourDirection
    Dim p As Variant, entrada As String, n As Long, i As Long, j As Long
    Dim w As Double, h As Double, margem As Double, intervalo As Double, afastamento As Double
    Dim cruzes As Boolean, retangular As Boolean, pt As Double, vermelho As Color, preto As Color
    Dim ax As Double, ay As Double, ar As Double, ab As Double
    Dim fx As Double, fy As Double, fr As Double, fb As Double
    Dim ux As Double, uy As Double, largura As Double, altura As Double
    Dim colunas As Double, linhas As Double, capacidade As Double
    Dim tx As Double, ty As Double, mx As Double, my As Double, cw As Double, ch As Double, mensagem As String

    If Documents.Count = 0 Then Err.Raise 5, , "Abra um documento no CorelDRAW."
    If ActiveSelectionRange.Count <> 1 Then Err.Raise 5, , "Selecione um objeto ou grupo."
    Set doc = ActiveDocument
    Set origem = ActivePage
    Set original = ActiveSelectionRange(1)
    entrada = InputBox("Largura; altura; margem; intervalo; quantidade; deslocamento da faca; cruzes; tipo de faca" & vbCrLf & _
        "Medidas em mm. Quantidade 0 = automatica. Offset positivo para fora, negativo para dentro." & vbCrLf & _
        "Cruzes: 0 = nao, 1 = sim. Faca: 0 = curva selecionada, 1 = retangulo da selecao.", _
        "Imposicao de arte e corte", "328;478;10;5;0;0;1;0")
    If Len(entrada) = 0 Then Exit Sub
    p = Split(entrada, ";")
    If UBound(p) <> 7 Then Err.Raise 5, , "Informe oito parametros separados por ponto e virgula."
    w = Numero(p(0)): h = Numero(p(1)): margem = Numero(p(2)): intervalo = Numero(p(3))
    afastamento = Numero(p(5))
    If w <= 0 Or h <= 0 Or margem < 0 Or intervalo < 0 Or Abs(afastamento) > 100 Then Err.Raise 5, , "Confira as medidas."
    If Numero(p(4)) < 0 Or Numero(p(4)) > 500 Or Fix(Numero(p(4))) <> Numero(p(4)) Then Err.Raise 5, , "Quantidade inteira entre 0 e 500."
    n = CLng(Numero(p(4)))
    If (Numero(p(6)) <> 0 And Numero(p(6)) <> 1) Or (Numero(p(7)) <> 0 And Numero(p(7)) <> 1) Then Err.Raise 5, , "Use 0 ou 1 para cruzes e tipo de faca."
    cruzes = (Numero(p(6)) = 1): retangular = (Numero(p(7)) = 1)
    If cruzes And margem < 8 Then Err.Raise 5, , "As cruzes exigem margem minima de 8 mm."

    unidade = doc.Unit
    doc.Unit = cdrMillimeter
    mudouUnidade = True
    doc.BeginCommandGroup "Imposicao de arte e corte"
    grupo = True
    pt = 0.25 * 25.4 / 72
    original.GetBoundingBox ax, ab, largura, altura, True
    ar = ax + largura: ay = ab + altura
    If retangular Then
        fx = ax - afastamento: fy = ay + afastamento
        fr = ar + afastamento: fb = ab - afastamento
    Else
        If original.Type <> cdrCurveShape Then Err.Raise 5, , "Converta o contorno externo em uma curva fechada ou use faca retangular."
        If Not original.Curve.Closed Or original.Curve.SubPaths.Count <> 1 Then Err.Raise 5, , "Use um traco fechado com um unico subcaminho."
        Set mestre = original.Layer.CreateCurve(original.Curve)
        mestre.Fill.ApplyUniformFill CreateCMYKColor(0, 100, 100, 0)
        mestre.Outline.SetNoOutline
        If afastamento <> 0 Then
            If afastamento > 0 Then direcao = cdrContourOutside Else direcao = cdrContourInside
            Set efeito = mestre.CreateContour(direcao, Abs(afastamento), 1)
            Set partes = efeito.Separate
            If partes.Count <> 1 Then
                partes.Delete
                Err.Raise 5, , "O deslocamento nao gerou uma faca unica."
            End If
            Set parte = partes(1)
            If parte.Type = cdrGroupShape Then
                Set partes = parte.UngroupEx
                If partes.Count <> 1 Then
                    partes.Delete
                    Err.Raise 5, , "O deslocamento fragmentou a faca."
                End If
                Set parte = partes(1)
            End If
            If parte Is mestre Then Err.Raise 5, , "A faca precisa ser independente da arte."
            mestre.Delete
            Set mestre = parte
        End If
        If mestre.Type <> cdrCurveShape Then Err.Raise 5, , "O resultado da faca precisa ser uma curva."
        If Not mestre.Curve.Closed Or mestre.Curve.SubPaths.Count <> 1 Then Err.Raise 5, , "O deslocamento dividiu ou eliminou a curva."
        fx = mestre.LeftX: fy = mestre.TopY: fr = mestre.RightX: fb = mestre.BottomY
    End If
    If fx >= fr Or fb >= fy Then Err.Raise 5, , "O recuo elimina a faca."
    ux = Minimo(ax, fx - pt / 2): uy = Maximo(ay, fy + pt / 2)
    largura = Maximo(ar, fr + pt / 2) - ux
    altura = uy - Minimo(ab, fb - pt / 2)
    colunas = Int((w - 2 * margem + intervalo + 0.00000001) / (largura + intervalo))
    linhas = Int((h - 2 * margem + intervalo + 0.00000001) / (altura + intervalo))
    If colunas < 1 Or linhas < 1 Then Err.Raise 5, , "A peca com a faca e a margem nao cabe nesta folha."
    capacidade = colunas * linhas
    If n > capacidade Then Err.Raise 5, , "Cabem ate " & capacidade & " pecas nesta folha."
    If n = 0 Then
        If capacidade > 500 Then Err.Raise 5, , "Informe uma quantidade manual de ate 500."
        n = CLng(capacidade)
    End If

    Set paginaArte = doc.AddPages(1)
    paginaArte.SetSize w, h
    paginaArte.Name = "ARTE " & paginaArte.Index
    Set paginaFaca = doc.AddPages(1)
    paginaFaca.SetSize w, h
    paginaFaca.Name = "FACA " & paginaFaca.Index
    Set camadaArte = paginaArte.CreateLayer("Arte")
    Set camadaFaca = paginaFaca.CreateLayer("Faca")
    Set vermelho = CreateCMYKColor(0, 100, 100, 0)
    Set preto = CreateCMYKColor(0, 0, 0, 100)

    For i = 0 To n - 1
        tx = margem - ux + (i - Int(i / colunas) * colunas) * (largura + intervalo)
        ty = uy + margem + Int(i / colunas) * (altura + intervalo)
        Set copia = original.CopyToLayer(camadaArte)
        paginaArte.Activate
        copia.GetBoundingBox mx, my, cw, ch, True
        copia.Move paginaArte.LeftX + ax + tx - mx, paginaArte.TopY + ay - ty - (my + ch)
        paginaFaca.Activate
        If retangular Then
            Set copia = camadaFaca.CreateRectangle2(paginaFaca.LeftX + fx + tx, paginaFaca.TopY + fb - ty, fr - fx, fy - fb)
        Else
            Set copia = mestre.CopyToLayer(camadaFaca)
            copia.Move paginaFaca.LeftX + fx + tx - copia.LeftX, paginaFaca.TopY + fy - ty - copia.TopY
        End If
        LinhaTecnica copia, pt, vermelho
    Next i

    If cruzes Then
        For j = 0 To 1
            Dim pagina As Page
            If j = 0 Then Set pagina = paginaArte Else Set pagina = paginaFaca
            pagina.Activate
            Set camadaMarcas = pagina.CreateLayer("Cruzes de registro")
            For i = 0 To 3
                mx = pagina.LeftX + IIf(i Mod 2 = 0, 5, w - 5)
                my = pagina.TopY - IIf(i < 2, 5, h - 5)
                Set copia = camadaMarcas.CreateLineSegment(mx - 2, my, mx + 2, my)
                LinhaTecnica copia, pt, preto
                Set copia = camadaMarcas.CreateLineSegment(mx, my - 2, mx, my + 2)
                LinhaTecnica copia, pt, preto
            Next i
        Next j
    End If

    If Not mestre Is Nothing Then mestre.Delete
    paginaArte.Activate
    doc.EndCommandGroup
    grupo = False
    doc.Unit = unidade
    MsgBox n & " pecas montadas. Capacidade: " & capacidade & "." & vbCrLf & "Exporte ARTE e FACA em escala 1:1."
    Exit Sub

Falha:
    mensagem = Err.Description
    On Error Resume Next
    If Not mestre Is Nothing Then mestre.Delete
    If Not paginaFaca Is Nothing Then paginaFaca.Delete
    If Not paginaArte Is Nothing Then paginaArte.Delete
    If Not origem Is Nothing Then origem.Activate
    If grupo Then doc.EndCommandGroup
    If mudouUnidade Then doc.Unit = unidade
    MsgBox mensagem, vbExclamation, "Imposicao de arte e corte"
End Sub

Private Function Numero(ByVal texto As String) As Double
    texto = Replace(Trim$(texto), ",", ".")
    If Len(texto) = 0 Or texto Like "*[!0-9.+-]*" Then Err.Raise 5, , "Medida invalida: " & texto
    Dim separador As String, local As String
    separador = Mid$(CStr(1.5), 2, 1)
    local = Replace(texto, ".", separador)
    If Not IsNumeric(local) Then Err.Raise 5, , "Medida invalida: " & texto
    Numero = CDbl(local)
End Function

Private Sub LinhaTecnica(ByVal objeto As Shape, ByVal espessura As Double, ByVal cor As Color)
    objeto.Fill.ApplyNoFill
    objeto.Outline.SetProperties Width:=espessura, Color:=cor, LineCaps:=cdrOutlineButtLineCaps, LineJoin:=cdrOutlineRoundLineJoin
    objeto.OverprintOutline = False
End Sub

Private Function Minimo(ByVal a As Double, ByVal b As Double) As Double
    If a < b Then Minimo = a Else Minimo = b
End Function

Private Function Maximo(ByVal a As Double, ByVal b As Double) As Double
    If a > b Then Maximo = a Else Maximo = b
End Function
