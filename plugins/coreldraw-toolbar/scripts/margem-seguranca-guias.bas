Attribute VB_Name = "IBD_MargemSegurancaGuias"
' IBD - Criar margem de segurança interna (guias)
' coreldraw/margem-seguranca-guias v1.1.0
'
' Arquivo pronto para uso: independente do repositorio,
' importe no Editor VBA do CorelDRAW (Alt + F11 > Arquivo > Importar).
'
' Gerado de apps/coreldraw/scripts/margem-seguranca-guias.bas. Nao edite aqui:
' a origem e o repositorio, e a proxima geracao sobrescreve este arquivo.
' @ibd-id coreldraw/margem-seguranca-guias
' @ibd-titulo Criar margem de segurança interna (guias)
' @ibd-descricao Cria quatro linhas-guia internas (esq., dir., base e topo) com a margem em mm para dentro da página ativa ou de todas as páginas.
' @ibd-app coreldraw
' @ibd-versao 1.1.0
' @ibd-tags guias, margem, seguranca, pagina, coreldraw
' @ibd-doc docs/ferramentas-vetor.md

Option Explicit

Public Sub CriarMargemSeguranca()
    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim entrada As String
    Dim valorMm As Double
    Dim aplicarTodas As Boolean
    Dim respEscopo As VbMsgBoxResult
    Dim infoPag As String
    Dim partesMarg As Variant
    Dim msg As String

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD - Margem de seguranca"
        Exit Sub
    End If

    Set doc = ActiveDocument
    origUnit = doc.Unit
    doc.Unit = cdrMillimeter
    infoPag = Format$(doc.ActivePage.SizeWidth, "0.0") & " x " & Format$(doc.ActivePage.SizeHeight, "0.0") & " mm"
    doc.Unit = origUnit

    entrada = InputBox( _
        "Pagina ativa: " & infoPag & vbCrLf & _
        "Predefinicoes: 3 | 5 | 10 | 15 | 20 mm (aceita mm, cm, m, in, pt ou px)" & vbCrLf & _
        "Para aplicar em todas as paginas sem perguntar, adicione ';T' (ex: 5;T):", _
        "IBD - Margem de seguranca (guias)", _
        "5")
    If Trim$(entrada) = "" Then Exit Sub

    aplicarTodas = False
    partesMarg = Split(entrada, ";")
    entrada = partesMarg(0)
    If UBound(partesMarg) >= 1 Then
        If UCase$(Trim$(partesMarg(1))) = "T" Then aplicarTodas = True
    End If

    valorMm = ConverterParaMm(entrada)
    If valorMm <= 0# Then
        MsgBox "Informe um valor numerico maior que zero.", vbExclamation, "IBD - Margem de seguranca"
        Exit Sub
    End If

    If Not aplicarTodas And doc.Pages.Count > 1 Then
        respEscopo = MsgBox( _
            "Aplicar guias de margem de " & Format$(valorMm, "0.0") & " mm em todas as " & doc.Pages.Count & " paginas?" & vbCrLf & _
            "(Nao = somente pagina ativa)", _
            vbYesNoCancel + vbQuestion, _
            "IBD - Escopo da margem")
        If respEscopo = vbCancel Then Exit Sub
        aplicarTodas = (respEscopo = vbYes)
    End If

    msg = ExecutarMargemSeguranca(valorMm, aplicarTodas)
    If Left$(msg, 5) = "ERRO:" Then
        MsgBox Mid$(msg, 6), vbExclamation, "IBD - Margem de seguranca"
    ElseIf Len(msg) > 0 Then
        MsgBox msg, vbInformation, "IBD - Margem de seguranca"
    End If
End Sub

Public Function ExecutarMargemSeguranca(ByVal valorMm As Double, ByVal aplicarTodas As Boolean) As String
    Dim doc As Document
    Dim origUnit As cdrUnit
    Dim pg As Page
    Dim criadas As Long
    Dim ignoradas As Long
    Dim grupoIniciado As Boolean
    Dim chavesMaster As String
    Dim chavePg As String

    If ActiveDocument Is Nothing Then
        ExecutarMargemSeguranca = "ERRO: Abra um documento antes de executar."
        Exit Function
    End If
    If valorMm <= 0# Then
        ExecutarMargemSeguranca = "ERRO: Informe uma margem maior que zero."
        Exit Function
    End If

    Set doc = ActiveDocument
    origUnit = doc.Unit
    chavesMaster = "|"

    On Error GoTo ErrHandler
    doc.Unit = cdrMillimeter
    doc.BeginCommandGroup "IBD: Margem de seguranca (guias)"
    grupoIniciado = True

    criadas = 0
    ignoradas = 0

    If aplicarTodas Then
        For Each pg In doc.Pages
            chavePg = CStr(Round(pg.LeftX, 2)) & ";" & CStr(Round(pg.BottomY, 2)) & ";" & _
                      CStr(Round(pg.RightX, 2)) & ";" & CStr(Round(pg.TopY, 2))
            If pg.GuidesLayer.Master Then
                If InStr(1, chavesMaster, "|" & chavePg & "|", vbBinaryCompare) > 0 Then
                    criadas = criadas + 1
                    GoTo ProximaPagina
                End If
                chavesMaster = chavesMaster & chavePg & "|"
            End If
            If AdicionarGuiasPagina(pg, valorMm) Then
                criadas = criadas + 1
            Else
                ignoradas = ignoradas + 1
            End If
ProximaPagina:
        Next pg
    Else
        If AdicionarGuiasPagina(doc.ActivePage, valorMm) Then
            criadas = 1
        Else
            ignoradas = 1
        End If
    End If

    doc.EndCommandGroup
    grupoIniciado = False
    doc.Unit = origUnit

    If criadas = 0 Then
        ExecutarMargemSeguranca = "ERRO: A margem informada e maior ou igual a metade da largura ou altura util da pagina."
    ElseIf ignoradas > 0 Then
        ExecutarMargemSeguranca = "Guias criadas em " & criadas & " pagina(s). Ignoradas: " & ignoradas & " pagina(s) menores que o dobro da margem."
    Else
        ExecutarMargemSeguranca = "Guias de margem (" & Format$(valorMm, "0.0") & " mm) criadas em " & criadas & " pagina(s)."
    End If
    Exit Function

ErrHandler:
    Dim descErro As String
    descErro = Err.Description
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    doc.Unit = origUnit
    ExecutarMargemSeguranca = "ERRO: Erro ao criar guias de margem: " & descErro
End Function

Private Function AdicionarGuiasPagina(ByVal pg As Page, ByVal m As Double) As Boolean
    Dim w As Double
    Dim h As Double
    Dim xMin As Double, xMax As Double, yMin As Double, yMax As Double
    Dim lyrGuias As Layer
    Dim editavelAntes As Boolean

    w = pg.SizeWidth
    h = pg.SizeHeight
    If (2# * m) >= w Or (2# * m) >= h Then
        AdicionarGuiasPagina = False
        Exit Function
    End If

    xMin = pg.LeftX
    xMax = pg.RightX
    yMin = pg.BottomY
    yMax = pg.TopY

    Set lyrGuias = pg.GuidesLayer
    editavelAntes = lyrGuias.Editable
    On Error GoTo RestaurarCamada
    lyrGuias.Visible = True
    lyrGuias.Editable = True

    With lyrGuias
        .CreateGuide xMin + m, yMin, xMin + m, yMax
        .CreateGuide xMax - m, yMin, xMax - m, yMax
        .CreateGuide xMin, yMin + m, xMax, yMin + m
        .CreateGuide xMin, yMax - m, xMax, yMax - m
    End With

    lyrGuias.Editable = editavelAntes
    AdicionarGuiasPagina = True
    Exit Function

RestaurarCamada:
    Dim errNum As Long, errDesc As String
    errNum = Err.Number
    errDesc = Err.Description
    On Error Resume Next
    lyrGuias.Editable = editavelAntes
    On Error GoTo 0
    Err.Raise errNum, , errDesc
End Function

Public Function ConverterParaMm(ByVal texto As String) As Double
    Dim limpo As String
    Dim fator As Double
    Dim v As Double

    limpo = LCase$(Trim$(texto))
    fator = 1#

    If Right$(limpo, 2) = "cm" Then
        fator = 10#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "mm" Then
        fator = 1#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "pt" Then
        fator = 25.4 / 72#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "in" Then
        fator = 25.4
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "px" Then
        fator = 25.4 / 96#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 1) = "m" Then
        fator = 1000#
        limpo = Trim$(Left$(limpo, Len(limpo) - 1))
    End If

    v = LerNumeroSeguro(limpo)
    If v <= 0# Then
        ConverterParaMm = 0#
    Else
        ConverterParaMm = v * fator
    End If
End Function

Private Function LerNumeroSeguro(ByVal s As String) As Double
    Dim sep As String
    Dim norm As String
    norm = Trim$(s)
    If Len(norm) = 0 Or norm Like "*[!0-9.,+-]*" Then
        LerNumeroSeguro = 0#
        Exit Function
    End If
    sep = Mid$(CStr(1.5), 2, 1)
    norm = Replace(Replace(norm, ".", sep), ",", sep)
    If InStr(norm, sep) <> InStrRev(norm, sep) Or Not IsNumeric(norm) Then
        LerNumeroSeguro = 0#
        Exit Function
    End If
    LerNumeroSeguro = CDbl(norm)
End Function
