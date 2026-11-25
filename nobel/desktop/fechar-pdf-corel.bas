Attribute VB_Name = "IBDFechamento"
Option Explicit

Public Sub FecharPDF()
    If Documents.Count = 0 Then Exit Sub
    Dim destino As String, estilo As String, web As VbMsgBoxResult, temp As String
    Dim mestre As Document, copia As Document
    Set mestre = ActiveDocument
    If mestre.Dirty Or Len(mestre.FilePath) = 0 Then
        MsgBox "Salve o mestre editavel em disco antes de fechar o PDF.": Exit Sub
    End If
    estilo = InputBox("Nome do estilo PDF homologado para este destino", "IBD - Fechar PDF")
    If estilo = "" Then Exit Sub
    web = MsgBox("Aplicar regras Web-to-Print (texto em curvas e sem marcas)?", vbYesNoCancel)
    If web = vbCancel Then Exit Sub
    destino = InputBox("Caminho completo do novo PDF", "IBD", mestre.FilePath & "\arte-fechada.pdf")
    If destino = "" Then Exit Sub
    If LCase$(Right$(destino, 4)) <> ".pdf" Then destino = destino & ".pdf"
    If Len(Dir$(destino)) <> 0 Then MsgBox "Escolha um nome novo.": Exit Sub
    temp = mestre.FilePath & "\ibd-prepress-" & Format$(Now, "yyyymmddhhnnss") & "-" & CLng(Timer * 100) & ".cdr"
    On Error GoTo Falha
    FileCopy mestre.FullFileName, temp
    Set copia = Application.OpenDocument(temp)
    If Not copia.PDFSettings.Load(estilo) Then Err.Raise 5, , "Estilo PDF nao encontrado."
    If web = vbYes Then
        copia.PDFSettings.TextAsCurves = True
        copia.PDFSettings.CropMarks = False
        copia.PDFSettings.RegistrationMarks = False
        copia.PDFSettings.ColorBars = False
    End If
    copia.PublishToPDF destino
    MsgBox "Confira caixas de pagina, separacoes e perfil no PDF final."
    GoTo Encerrar
Falha:
    MsgBox Err.Description
Encerrar:
    On Error Resume Next
    If Not copia Is Nothing Then
        copia.Dirty = False
        copia.Close
    End If
    If Len(Dir$(temp)) <> 0 Then Kill temp
End Sub
