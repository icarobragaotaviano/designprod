Attribute VB_Name = "IBD_BarraFerramentas"
' IBD - Instalador da Barra de Ferramentas e Painel para CorelDRAW
' Compativel com CorelDRAW X3 a 2025+ (32 e 64 bits).
' Importe os .bas de scripts\, IBD_PainelCorel.bas e este modulo em GlobalMacros (Alt + F11),
' depois execute GlobalMacros.IBD_BarraFerramentas.InstalarBarraIBD.

Option Explicit

Public Sub InstalarBarraIBD()
    Const BAR_NOME As String = "IBD Ferramentas"
    Const CUI_BAR_TOP As Long = 1
    Const CAT_MACROS As String = "2cc24a3e-fe24-4708-9a74-9c75406eebcd"
    Dim bar As CommandBar
    Dim btn As Object
    Dim pastaPadrao As String
    Dim pastaIcones As String
    Dim i As Long

    pastaPadrao = Environ$("LOCALAPPDATA")
    If Len(pastaPadrao) > 0 Then
        pastaPadrao = pastaPadrao & "\IBD_Ferramentas\CorelDRAW\icones\"
    Else
        pastaPadrao = "C:\IBD_Ferramentas\icones\"
    End If

    pastaIcones = InputBox( _
        "Informe o caminho completo da pasta 'icones' (terminando com \):", _
        "IBD - Instalar Barra de Ferramentas", _
        pastaPadrao)
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

    Set bar = FrameWork.CommandBars.Add(BAR_NOME, CUI_BAR_TOP, False)

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_PainelCorel.AbrirPainelIBD")
    If Not btn Is Nothing Then
        btn.Caption = "Painel IBD"
        btn.ToolTipText = "IBD: Painel IBD"
        Err.Clear
        btn.SetIcon2 pastaIcones & "painel-ibd.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "painel-ibd.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_CriarPapelPadrao.CriarPapelPadrao")
    If Not btn Is Nothing Then
        btn.Caption = "Criar documento ou pagina em papel padrao"
        btn.ToolTipText = "IBD: Criar documento ou pagina em papel padrao"
        Err.Clear
        btn.SetIcon2 pastaIcones & "criar-papel-padrao.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "criar-papel-padrao.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_CriarPecaPadrao.CriarPecaPadrao")
    If Not btn Is Nothing Then
        btn.Caption = "Criar peca grafica padrao"
        btn.ToolTipText = "IBD: Criar peca grafica padrao"
        Err.Clear
        btn.SetIcon2 pastaIcones & "criar-peca-padrao.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "criar-peca-padrao.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_DeslocamentoExpandirContorno.DeslocarExpandirContorno")
    If Not btn Is Nothing Then
        btn.Caption = "Gerar contorno deslocado e expandido"
        btn.ToolTipText = "IBD: Gerar contorno deslocado e expandido"
        Err.Clear
        btn.SetIcon2 pastaIcones & "deslocamento-expandir-contorno.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "deslocamento-expandir-contorno.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_MargemSegurancaGuias.CriarMargemSeguranca")
    If Not btn Is Nothing Then
        btn.Caption = "Criar margem de seguranca interna (guias)"
        btn.ToolTipText = "IBD: Criar margem de seguranca interna (guias)"
        Err.Clear
        btn.SetIcon2 pastaIcones & "margem-seguranca-guias.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "margem-seguranca-guias.ico"
        End If
    End If
    On Error GoTo ErrHandler

    On Error Resume Next
    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "GlobalMacros.IBD_TextoDimensoesObjeto.CriarTextoDimensoesObjeto")
    If Not btn Is Nothing Then
        btn.Caption = "Cotar dimensoes da selecao em texto"
        btn.ToolTipText = "IBD: Cotar dimensoes da selecao em texto"
        Err.Clear
        btn.SetIcon2 pastaIcones & "texto-dimensoes-objeto.ico"
        If Err.Number <> 0 Then
            Err.Clear
            btn.SetCustomIcon pastaIcones & "texto-dimensoes-objeto.ico"
        End If
    End If
    On Error GoTo ErrHandler

    bar.Visible = True
    MsgBox "Barra '" & BAR_NOME & "' criada com " & bar.Controls.Count & " botao(oes)!" & vbCrLf & _
           "Clique no primeiro icone ('Painel IBD') para abrir o painel flutuante/encaixado.", _
           vbInformation, "IBD Ferramentas"
    Exit Sub

ErrHandler:
    MsgBox "Erro ao montar barra no CorelDRAW: " & Err.Description, vbCritical, "IBD Ferramentas"
End Sub
