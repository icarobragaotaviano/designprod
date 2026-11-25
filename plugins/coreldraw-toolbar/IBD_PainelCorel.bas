Attribute VB_Name = "IBD_PainelCorel"
' IBD - Atalho interno para abrir o Painel Universal dentro do CorelDRAW
' Compativel com todas as versoes (VBA6 32-bit e VBA7 64-bit).

Option Explicit

Public Sub AbrirPainelIBD()
    Dim fso As Object
    Dim pasta As String
    Dim htaPath As String

    Set fso = CreateObject("Scripting.FileSystemObject")
    pasta = GetSetting("IBD_Ferramentas", "CorelDRAW", "PastaPainel", "")
    If Len(pasta) = 0 Or Not fso.FileExists(pasta & "\IBD_Painel_Corel.hta") Then
        pasta = Environ$("LOCALAPPDATA") & "\IBD_Ferramentas\CorelDRAW"
    End If

    If Not fso.FileExists(pasta & "\IBD_Painel_Corel.hta") Then
        pasta = InputBox( _
            "Informe a pasta onde extraiu o arquivo IBD_Painel_Corel.hta:", _
            "IBD - Abrir Painel", _
            pasta)
        If Trim$(pasta) = "" Then Exit Sub
        If Right$(pasta, 1) = "\" Then pasta = Left$(pasta, Len(pasta) - 1)
        If Not fso.FileExists(pasta & "\IBD_Painel_Corel.hta") Then
            MsgBox "Arquivo IBD_Painel_Corel.hta nao encontrado em: " & pasta, vbExclamation, "IBD Ferramentas"
            Exit Sub
        End If
    End If

    SaveSetting "IBD_Ferramentas", "CorelDRAW", "PastaPainel", pasta
    htaPath = pasta & "\IBD_Painel_Corel.hta"
    Shell "mshta.exe """ & htaPath & """", vbNormalFocus
End Sub
