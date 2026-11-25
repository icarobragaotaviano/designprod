Attribute VB_Name = "IBDAuditoria"
Option Explicit

Private ocorrencias As Collection
Private donos As Collection

Public Sub AuditarArte()
    If Documents.Count = 0 Then Exit Sub
    Dim strTeto As String, strPpi As String, teto As Double, ppi As Double, pg As Page
    strTeto = InputBox("Limite de cobertura CMYK (%)", "IBD", "300")
    If Len(Trim$(strTeto)) = 0 Then Exit Sub
    strPpi = InputBox("Resolucao de referencia (ppi)", "IBD", "300")
    If Len(Trim$(strPpi)) = 0 Then Exit Sub
    teto = LerDoubleSeguro(strTeto): ppi = LerDoubleSeguro(strPpi)
    If teto <= 0 Or teto > 400 Or ppi <= 0 Then
        MsgBox "Informe valores numericos validos (CMYK 1-400%, resolucao > 0).", vbExclamation, "IBD - Auditoria"
        Exit Sub
    End If
    Set ocorrencias = New Collection
    Set donos = New Collection
    For Each pg In ActiveDocument.Pages
        Examinar pg.Shapes, pg.Index, teto, ppi
    Next pg
    If ocorrencias.Count = 0 Then
        MsgBox "Nenhuma ocorrencia nas propriedades verificadas.", vbInformation, "IBD - Auditoria": Exit Sub
    End If
    Dim idx As Long, resposta As String, resumo As String
    For idx = 1 To ocorrencias.Count
        Debug.Print idx & ". " & ocorrencias(idx)
        If idx <= 10 Then resumo = resumo & idx & ". " & ocorrencias(idx) & vbCrLf
    Next idx
    resposta = InputBox(resumo & vbCrLf & "Lista completa na janela Imediato do VBA. Informe o indice para selecionar.", "IBD - " & ocorrencias.Count & " ocorrencias")
    If Len(Trim$(resposta)) = 0 Or Not IsNumeric(resposta) Then Exit Sub
    idx = CLng(Val(Trim$(resposta)))
    If idx < 1 Or idx > donos.Count Then Exit Sub
    Dim s As Shape
    Set s = donos(idx)
    s.Layer.Page.Activate
    s.CreateSelection
    ActiveWindow.ActiveView.ToFitSelection
End Sub

Private Function LerDoubleSeguro(ByVal texto As String) As Double
    Dim sep As String, norm As String
    norm = Trim$(texto)
    If Len(norm) = 0 Or norm Like "*[!0-9.,]*" Then
        LerDoubleSeguro = 0#
        Exit Function
    End If
    sep = Mid$(CStr(1.5), 2, 1)
    norm = Replace(Replace(norm, ".", sep), ",", sep)
    If InStr(norm, sep) <> InStrRev(norm, sep) Or Not IsNumeric(norm) Then
        LerDoubleSeguro = 0#
        Exit Function
    End If
    LerDoubleSeguro = CDbl(norm)
End Function

Private Sub Avisar(ByVal s As Shape, ByVal pg As Long, ByVal motivo As String)
    ocorrencias.Add "P" & pg & " - " & motivo
    donos.Add s
End Sub

Private Function SobraBranca(ByVal c As Color) As Boolean
    If c.Type = cdrColorCMYK Then SobraBranca = (c.CMYKCyan + c.CMYKMagenta + c.CMYKYellow + c.CMYKBlack = 0)
End Function

Private Sub Cor(ByVal s As Shape, ByVal pg As Long, ByVal c As Color, ByVal over As Boolean, ByVal local As String, ByVal teto As Double)
    If c.Type = cdrColorRGB Then Avisar s, pg, "RGB em " & local
    If c.Type <> cdrColorCMYK Then Exit Sub
    Dim total As Double
    total = c.CMYKCyan + c.CMYKMagenta + c.CMYKYellow + c.CMYKBlack
    If total = 400 Then Avisar s, pg, "CMYK 400% em " & local
    If total > teto Then Avisar s, pg, "Excesso de tinta em " & local & " (" & total & "%)"
    If total = 0 And over Then Avisar s, pg, "Branco em sobreimpressao (" & local & ")"
End Sub

Private Sub Examinar(ByVal lista As Shapes, ByVal pg As Long, ByVal teto As Double, ByVal ppi As Double)
    Dim s As Shape, pc As PowerClip, c As Color, tam As Double
    For Each s In lista
        If s.Type = cdrGroupShape Then
            Examinar s.Shapes, pg, teto, ppi
        Else
            Set pc = Nothing
            On Error Resume Next
            Set pc = s.PowerClip
            On Error GoTo 0
            If Not pc Is Nothing Then Examinar pc.Shapes, pg, teto, ppi

            If s.Type = cdrBitmapShape Then
                On Error Resume Next
                If s.Bitmap.Mode = cdrRGBColorImage Then Avisar s, pg, "Bitmap RGB"
                If s.Bitmap.ResolutionX < ppi Or s.Bitmap.ResolutionY < ppi Then Avisar s, pg, "Bitmap abaixo da resolucao alvo"
                On Error GoTo 0
            End If

            If s.Type = cdrTextShape Then Avisar s, pg, "Texto editavel; confira a exigencia de curvas"

            If s.CanHaveFill Then
                If s.Fill.Type = cdrUniformFill Then
                    Set c = s.Fill.UniformColor
                    Cor s, pg, c, s.OverprintFill, "preenchimento", teto
                    If s.Type = cdrTextShape And c.Type = cdrColorCMYK Then
                        tam = 0#
                        On Error Resume Next
                        tam = s.Text.Story.Size
                        On Error GoTo 0
                        If tam > 0 And tam <= 10 And c.CMYKBlack >= 85 And c.CMYKCyan + c.CMYKMagenta + c.CMYKYellow > 0 Then
                            Avisar s, pg, "Texto pequeno com preto composto"
                        End If
                    End If
                End If
            End If

            If s.CanHaveOutline Then
                If s.Outline.Type <> cdrNoOutline Then
                    Cor s, pg, s.Outline.Color, s.OverprintOutline, "contorno", teto
                    If Application.ConvertUnits(s.Outline.Width, ActiveDocument.Unit, cdrPoint) < 0.25 Then
                        Avisar s, pg, "Filete abaixo de 0,25 pt"
                    End If
                End If
            End If
        End If
    Next s
End Sub

Public Sub CorrigirBrancoSelecionado()
    If Documents.Count = 0 Then Exit Sub
    If ActiveSelectionRange.Count = 0 Then Exit Sub
    Dim s As Shape
    ActiveDocument.BeginCommandGroup "IBD - Corrigir sobreimpressao do branco"
    On Error GoTo Encerrar
    For Each s In ActiveSelectionRange
        If s.CanHaveFill Then
            If s.Fill.Type = cdrUniformFill Then
                If SobraBranca(s.Fill.UniformColor) Then s.OverprintFill = False
            End If
        End If
        If s.CanHaveOutline Then
            If s.Outline.Type <> cdrNoOutline Then
                If SobraBranca(s.Outline.Color) Then s.OverprintOutline = False
            End If
        End If
    Next s
Encerrar:
    ActiveDocument.EndCommandGroup
    If Err.Number <> 0 Then MsgBox Err.Description
End Sub

Public Sub PretoPuroEmTextosSelecionados()
    If Documents.Count = 0 Then Exit Sub
    If ActiveSelectionRange.Count = 0 Then Exit Sub
    Dim s As Shape, corAtual As Color, tam As Double, total As Long
    ActiveDocument.BeginCommandGroup "IBD - Texto pequeno em K100"
    On Error GoTo Encerrar
    For Each s In ActiveSelectionRange
        If s.Type = cdrTextShape And s.CanHaveFill Then
            If s.Fill.Type = cdrUniformFill Then
                Set corAtual = s.Fill.UniformColor
                tam = 0#
                On Error Resume Next
                tam = s.Text.Story.Size
                On Error GoTo Encerrar
                If tam > 0 And tam <= 10 And corAtual.Type = cdrColorCMYK Then
                    If corAtual.CMYKBlack >= 85 And corAtual.CMYKCyan + corAtual.CMYKMagenta + corAtual.CMYKYellow > 0 Then
                        s.Fill.ApplyUniformFill CreateCMYKColor(0, 0, 0, 100)
                        s.OverprintFill = True
                        total = total + 1
                    End If
                End If
            End If
        End If
    Next s
Encerrar:
    Dim problema As String
    problema = Err.Description
    ActiveDocument.EndCommandGroup
    If Len(problema) > 0 Then MsgBox problema Else MsgBox total & " texto(s) corrigido(s)."
End Sub
