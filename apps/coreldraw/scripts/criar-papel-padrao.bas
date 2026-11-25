Attribute VB_Name = "IBD_CriarPapelPadrao"
' @ibd-id coreldraw/criar-papel-padrao
' @ibd-titulo Criar documento ou página em papel padrão
' @ibd-descricao Cria novo documento, nova página ou ajusta a página ativa nos papéis padrão Nobel (T9, T8, T4) e formatos gráficos/ISO (A4, A5, A3, SRA3 e outros).
' @ibd-app coreldraw
' @ibd-versao 1.0.0
' @ibd-tags papel, nobel, pagina, documento, formato, a4, a5, t4, t8, t9, coreldraw

Option Explicit

Public Function ObterListaPapeis() As Variant
    ' Primeiro os padroes Nobel, seguidos pelos formatos presentes no app (ISO, graficos, Oficio, B, folhas).
    ObterListaPapeis = Array( _
        "Padrao Nobel T9|220|380", "Padrao Nobel T8|238|328", "Padrao Nobel T4|328|478", "A4|210|297", _
        "A5|148|210", "A6|105|148", "A7|74|105", "A3|297|420", _
        "SRA3|320|450", "Super A3 / A3+|330|480", "A4+ grafico 220x320|220|320", "A4+ grafico 225x320|225|320", _
        "A4+ grafico 230x330|230|330", "Super A4 sublimacao|230|350", "A2|420|594", "A1|594|841", _
        "A0|841|1189", "Carta (Letter)|216|279", "Oficio / Folio 216x320|216|320", "Oficio 2 / Folio 216x330|216|330", _
        "Oficio (Legal)|216|356", "Meio Oficio|165|216", "B4 (ISO)|250|353", "B5 (ISO)|176|250", _
        "B6 (ISO)|125|176", "Meia folha (1/2)|480|660", "Folha 64x88 cm|640|880", "Folha inteira (BB)|660|960", _
        "Formato 76x112 cm|760|1120")
End Function

Public Sub CriarPapelPadrao()
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

    lista = ObterListaPapeis()
    menu = "Escolha o numero do papel (ou digite LxA em mm):" & vbCrLf
    For i = 0 To 11
        p = Split(lista(i), "|")
        menu = menu & (i + 1) & ") " & p(0) & " (" & p(1) & "x" & p(2) & ")   "
        If (i Mod 2) = 1 Then menu = menu & vbCrLf
    Next i
    menu = menu & vbCrLf & "13-29: A2..A0, Carta, Oficio, B4..B6, Meia folha, 64x88, BB, 76x112" & vbCrLf & _
           "Opcional: numero ; modo (D=Novo Doc, P=Nova Pagina, R=Redim Pagina) ; ori (V/H) ; margemMm ; sangriaMm"

    entrada = InputBox(menu, "IBD - Criar papel padrao (Nobel + ISO)", "3;D;V;5;0")
    If Trim$(entrada) = "" Then Exit Sub

    partes = Split(entrada, ";")
    modo = "D"
    ori = ""
    margem = 5#
    sangria = 0#
    If UBound(partes) >= 1 Then modo = UCase$(Trim$(partes(1)))
    If UBound(partes) >= 2 Then ori = UCase$(Trim$(partes(2)))
    If UBound(partes) >= 3 Then margem = Val(Replace(Trim$(partes(3)), ",", "."))
    If UBound(partes) >= 4 Then sangria = Val(Replace(Trim$(partes(4)), ",", "."))

    If InStr(1, partes(0), "x", vbTextCompare) > 0 Then
        Dim dims As Variant
        dims = Split(LCase$(Trim$(partes(0))), "x")
        wMm = Val(Replace(dims(0), ",", "."))
        hMm = Val(Replace(dims(1), ",", "."))
        nomeFmt = "Papel " & wMm & "x" & hMm
    Else
        idx = CLng(Val(Trim$(partes(0)))) - 1
        If idx < 0 Or idx > UBound(lista) Then
            MsgBox "Numero de formato invalido (1 a " & (UBound(lista) + 1) & ").", vbExclamation, "IBD - Papel padrao"
            Exit Sub
        End If
        p = Split(lista(idx), "|")
        nomeFmt = CStr(p(0))
        wMm = Val(p(1))
        hMm = Val(p(2))
    End If

    msg = ExecutarCriarPapel(nomeFmt, wMm, hMm, ori, modo, margem, sangria)
    If Left$(msg, 5) = "ERRO:" Then
        MsgBox Mid$(msg, 6), vbExclamation, "IBD - Papel padrao"
    End If
End Sub

Public Function ExecutarCriarPapel( _
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
    Dim editAntes As Boolean
    Dim xMin As Double, xMax As Double, yMin As Double, yMax As Double
    Dim grupoIniciado As Boolean

    w = larguraMm
    h = alturaMm
    If w <= 0# Or h <= 0# Then
        ExecutarCriarPapel = "ERRO: Largura e altura precisam ser maiores que zero."
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
    If modo = "D" Or ActiveDocument Is Nothing Then
        Set doc = Application.CreateDocument
        origUnit = doc.Unit
        doc.Unit = cdrMillimeter
        Set pg = doc.ActivePage
        pg.SetSize w, h
        pg.Name = nomeFormato & " " & Format$(w, "0") & "x" & Format$(h, "0") & "mm"
    Else
        Set doc = ActiveDocument
        origUnit = doc.Unit
        doc.Unit = cdrMillimeter
        doc.BeginCommandGroup "IBD: Criar papel " & nomeFormato
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
    End If

    If margemMm > 0# Or sangriaMm > 0# Then
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
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
    ActiveWindow.ActiveView.ToFitPage
    On Error GoTo 0
    ExecutarCriarPapel = "Papel criado: " & nomeFormato & " (" & Format$(w, "0.#") & " x " & Format$(h, "0.#") & " mm)."
    Exit Function

ErrHandler:
    Dim desc As String
    desc = Err.Description
    On Error Resume Next
    If grupoIniciado Then doc.EndCommandGroup
    If Not doc Is Nothing And modo <> "D" Then doc.Unit = origUnit
    ExecutarCriarPapel = "ERRO: Erro ao criar papel padrao: " & desc
End Function
