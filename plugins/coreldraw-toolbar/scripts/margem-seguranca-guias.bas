Attribute VB_Name = "IBD_MargemSegurancaGuias"
' IBD — Criar margem de segurança interna (guias)
' coreldraw/margem-seguranca-guias v1.0.0
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
' @ibd-versao 1.0.0
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
    Dim pg As Page
    Dim criadas As Long
    Dim ignoradas As Long
    Dim grupoIniciado As Boolean

    If ActiveDocument Is Nothing Then
        MsgBox "Abra um documento antes de executar esta macro.", vbExclamation, "IBD — Margem de seguranca"
        Exit Sub
    End If

    Set doc = ActiveDocument
    origUnit = doc.Unit
    doc.Unit = cdrMillimeter

    Dim infoPag As String
    infoPag = Format$(doc.ActivePage.SizeWidth, "0.0") & " x " & Format$(doc.ActivePage.SizeHeight, "0.0") & " mm"

    entrada = InputBox( _
        "Pagina ativa: " & infoPag & vbCrLf & _
        "Predefinicoes: 3 | 5 | 10 | 15 | 20 mm (ou use cm / pt)" & vbCrLf & _
        "Para aplicar em todas as paginas sem perguntar, adicione ';T' (ex: 5;T):", _
        "IBD — Margem de seguranca (guias)", _
        "5")
    If Trim(entrada) = "" Then
        doc.Unit = origUnit
        Exit Sub
    End If

    aplicarTodas = False
    Dim partesMarg As Variant
    partesMarg = Split(entrada, ";")
    entrada = partesMarg(0)
    If UBound(partesMarg) >= 1 And UCase$(Trim$(partesMarg(1))) = "T" Then
        aplicarTodas = True
    End If

    valorMm = ConverterParaMm(entrada)
    If valorMm <= 0# Then
        doc.Unit = origUnit
        MsgBox "Informe um valor numerico maior que zero.", vbExclamation, "IBD — Margem de seguranca"
        Exit Sub
    End If

    If Not aplicarTodas And doc.Pages.Count > 1 Then
        respEscopo = MsgBox( _
            "Aplicar guias de margem de " & Format$(valorMm, "0.0") & " mm em todas as " & doc.Pages.Count & " paginas?" & vbCrLf & _
            "(Nao = somente pagina ativa)", _
            vbYesNoCancel + vbQuestion, _
            "IBD — Escopo da margem")
        If respEscopo = vbCancel Then
            doc.Unit = origUnit
            Exit Sub
        End If
        aplicarTodas = (respEscopo = vbYes)
    End If

    On Error GoTo ErrHandler
    doc.Unit = cdrMillimeter
    doc.BeginCommandGroup "IBD: Margem de seguranca (guias)"
    grupoIniciado = True

    criadas = 0
    ignoradas = 0

    If aplicarTodas Then
        For Each pg In doc.Pages
            If AdicionarGuiasPagina(pg, valorMm) Then
                criadas = criadas + 1
            Else
                ignoradas = ignoradas + 1
            End If
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
        MsgBox "A margem informada e maior ou igual a metade da largura ou altura util da pagina.", vbExclamation, "IBD — Margem de seguranca"
    ElseIf ignoradas > 0 Then
        MsgBox "Guias criadas em " & criadas & " pagina(s). Ignoradas: " & ignoradas & " pagina(s) menores que o dobro da margem.", vbInformation, "IBD — Margem de seguranca"
    End If
    Exit Sub

ErrHandler:
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    doc.Unit = origUnit
    MsgBox "Erro ao criar guias de margem: " & Err.Description, vbCritical, "IBD — Margem de seguranca"
End Sub

Private Function AdicionarGuiasPagina(ByVal pg As Page, ByVal m As Double) As Boolean
    Dim w As Double
    Dim h As Double
    Dim xMin As Double, xMax As Double, yMin As Double, yMax As Double
    Dim lyrGuias As Layer

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
    With lyrGuias
        .CreateGuide xMin + m, yMin, xMin + m, yMax
        .CreateGuide xMax - m, yMin, xMax - m, yMax
        .CreateGuide xMin, yMin + m, xMax, yMin + m
        .CreateGuide xMin, yMax - m, xMax, yMax - m
    End With

    AdicionarGuiasPagina = True
End Function

Private Function ConverterParaMm(ByVal texto As String) As Double
    Dim limpo As String
    Dim fator As Double

    limpo = LCase$(Trim$(texto))
    limpo = Replace(limpo, ",", ".")
    fator = 1#

    If Right$(limpo, 2) = "cm" Then
        fator = 10#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "pt" Then
        fator = 25.4 / 72#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    ElseIf Right$(limpo, 2) = "mm" Then
        fator = 1#
        limpo = Trim$(Left$(limpo, Len(limpo) - 2))
    End If

    If Not IsNumeric(limpo) Then
        ConverterParaMm = 0#
    Else
        ConverterParaMm = CDbl(Val(limpo)) * fator
    End If
End Function
