Attribute VB_Name = "NobelOS"
Option Explicit

Public Sub AbrirPastaDaArte()
    Dim exp As Object, entrada As String, partes As Variant, pasta As String
    Set exp = CreateObject("VBScript.RegExp")
    exp.Pattern = "(^|[^0-9])([0-9]{4}-[0-9]{6})([^0-9]|$)"
    If Documents.Count > 0 Then
        If exp.Test(ActiveDocument.Name) Then entrada = exp.Execute(ActiveDocument.Name)(0).SubMatches(1)
    End If
    entrada = InputBox("Cliente e pedido", "Nobel - Abrir pasta", entrada)
    If entrada = "" Then Exit Sub
    If Not entrada Like "####-######" Then
        MsgBox "Use 0000-000000.": Exit Sub
    End If
    partes = Split(entrada, "-")
    If CLng(partes(1)) = 0 Then Exit Sub
    pasta = "Q:\0 - 2019\0 - OS SITE\" & partes(0) & "\Pedido " & CLng(partes(1))
    If Not CreateObject("Scripting.FileSystemObject").FolderExists(pasta) Then
        MsgBox "Pasta indisponivel: " & pasta: Exit Sub
    End If
    CreateObject("Shell.Application").Open pasta
End Sub
