Attribute VB_Name = "IBD_BarraFerramentas"
' IBD — Instalador da Barra de Ferramentas com Icones (.ico)
' Importe os .bas de scripts/ e este modulo em GlobalMacros (Alt + F11),
' depois execute InstalarBarraIBD().

Option Explicit

Public Sub InstalarBarraIBD()
    Const BAR_NOME As String = "IBD Ferramentas"
    Dim bar As CommandBar
    Dim btn As CommandBarControl
    Dim pastaIcones As String
    Dim i As Long

    pastaIcones = InputBox( _
        "Informe o caminho completo da pasta 'icones' extraida do ZIP (terminando com \):", _
        "IBD — Instalar Barra de Ferramentas", _
        "C:\IBD_Ferramentas\icones\")
    If Trim$(pastaIcones) = "" Then Exit Sub
    If Right$(pastaIcones, 1) <> "\" And Right$(pastaIcones, 1) <> "/" Then
        pastaIcones = pastaIcones & "\"
    End If

    On Error GoTo ErrHandler
    For i = FrameWork.CommandBars.Count To 1 Step -1
        If FrameWork.CommandBars(i).Name = BAR_NOME Then
            FrameWork.CommandBars(i).Delete
        End If
    Next i

    Set bar = FrameWork.CommandBars.Add(BAR_NOME, cdrBarTop, False)

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(cdrCmdCategoryMacros, "GlobalMacros.IBD_DeslocamentoExpandirContorno.DeslocarExpandirContorno")
    If Not btn Is Nothing Then
        btn.Caption = "Gerar contorno deslocado e expandido"
        btn.TooltipText = "IBD: Gerar contorno deslocado e expandido"
        Err.Clear
        btn.SetIcon2 pastaIcones & "deslocamento-expandir-contorno.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "deslocamento-expandir-contorno.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(cdrCmdCategoryMacros, "GlobalMacros.IBD_MargemSegurancaGuias.CriarMargemSeguranca")
    If Not btn Is Nothing Then
        btn.Caption = "Criar margem de segurança interna (guias)"
        btn.TooltipText = "IBD: Criar margem de segurança interna (guias)"
        Err.Clear
        btn.SetIcon2 pastaIcones & "margem-seguranca-guias.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "margem-seguranca-guias.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(cdrCmdCategoryMacros, "GlobalMacros.IBD_TextoDimensoesObjeto.CriarTextoDimensoesObjeto")
    If Not btn Is Nothing Then
        btn.Caption = "Cotar dimensões da seleção em texto"
        btn.TooltipText = "IBD: Cotar dimensões da seleção em texto"
        Err.Clear
        btn.SetIcon2 pastaIcones & "texto-dimensoes-objeto.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "texto-dimensoes-objeto.ico"
        End If
    End If
    On Error GoTo ErrHandler

    bar.Visible = True
    MsgBox "Barra '" & BAR_NOME & "' criada com " & bar.Controls.Count & " icone(s)!", vbInformation, "IBD Ferramentas"
    Exit Sub

ErrHandler:
    MsgBox "Erro ao montar barra no CorelDRAW: " & Err.Description, vbCritical, "IBD Ferramentas"
End Sub
