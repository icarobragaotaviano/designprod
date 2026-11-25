/**
 * Gerador do Painel Universal + Barra de Ferramentas do CorelDRAW.
 *
 * Funciona em QUALQUER versao do CorelDRAW no Windows (X3 a 2025+, 32 e 64 bits):
 *  - IBD_Painel_Corel.hta: painel visual identico ao painel CEP do Illustrator,
 *    com icones SVG, busca, favoritos, mostrar/ocultar funcoes, papeis Nobel/ISO,
 *    pecas graficas comuns e execucao direta via COM late-bound.
 *  - Attach-Painel-Corel.ps1: vincula o painel como janela filha/owned do CorelDRAW
 *    (fica sempre por cima da area de desenho, minimiza junto com o Corel e encaixa
 *    na borda direita ou esquerda).
 *  - IBD_PainelCorel.bas + IBD_InstalarBarraFerramentas.bas: modulos VBA corrigidos
 *    (CRLF, ASCII seguro, Object/cuiBarTop/GUID Macros) para abrir o painel e as
 *    ferramentas direto de uma barra fixa dentro do CorelDRAW.
 */
import { gerarCodigoIconesJs, resolverIconeId } from './icones.mjs';

export const PAPEIS_COREL = [
  { id: 'nobel-t9', rotulo: 'Padrao Nobel T9 — 220 x 380 mm', curto: 'T9', w: 220, h: 380 },
  { id: 'nobel-t8', rotulo: 'Padrao Nobel T8 — 238 x 328 mm', curto: 'T8', w: 238, h: 328 },
  { id: 'nobel-t4', rotulo: 'Padrao Nobel T4 — 328 x 478 mm', curto: 'T4', w: 328, h: 478 },
  { id: 'a4', rotulo: 'A4 — 210 x 297 mm', curto: 'A4', w: 210, h: 297 },
  { id: 'a5', rotulo: 'A5 — 148 x 210 mm', curto: 'A5', w: 148, h: 210 },
  { id: 'a6', rotulo: 'A6 — 105 x 148 mm', curto: 'A6', w: 105, h: 148 },
  { id: 'a7', rotulo: 'A7 — 74 x 105 mm', curto: 'A7', w: 74, h: 105 },
  { id: 'a3', rotulo: 'A3 — 297 x 420 mm', curto: 'A3', w: 297, h: 420 },
  { id: 'sra3', rotulo: 'SRA3 — 320 x 450 mm', curto: 'SRA3', w: 320, h: 450 },
  { id: 'super-a3', rotulo: 'Super A3 / A3+ — 330 x 480 mm', curto: 'A3+', w: 330, h: 480 },
  { id: 'a4-220x320', rotulo: 'A4+ grafico — 220 x 320 mm', curto: 'A4+ 220', w: 220, h: 320 },
  { id: 'a4-225x320', rotulo: 'A4+ grafico — 225 x 320 mm', curto: 'A4+ 225', w: 225, h: 320 },
  { id: 'a4-230x330', rotulo: 'A4+ grafico — 230 x 330 mm', curto: 'A4+ 230', w: 230, h: 330 },
  { id: 'super-a4', rotulo: 'Super A4 sublimacao — 230 x 350 mm', curto: 'Super A4', w: 230, h: 350 },
  { id: 'a2', rotulo: 'A2 — 420 x 594 mm', curto: 'A2', w: 420, h: 594 },
  { id: 'a1', rotulo: 'A1 — 594 x 841 mm', curto: 'A1', w: 594, h: 841 },
  { id: 'a0', rotulo: 'A0 — 841 x 1189 mm', curto: 'A0', w: 841, h: 1189 },
  { id: 'carta', rotulo: 'Carta (Letter) — 216 x 279 mm', curto: 'Carta', w: 216, h: 279 },
  { id: 'oficio-320', rotulo: 'Oficio / Folio — 216 x 320 mm', curto: 'Oficio 320', w: 216, h: 320 },
  { id: 'oficio-330', rotulo: 'Oficio 2 / Folio — 216 x 330 mm', curto: 'Oficio 330', w: 216, h: 330 },
  { id: 'legal', rotulo: 'Oficio (Legal) — 216 x 356 mm', curto: 'Legal', w: 216, h: 356 },
  { id: 'meio-oficio', rotulo: 'Meio Oficio — 165 x 216 mm', curto: 'Meio Of.', w: 165, h: 216 },
  { id: 'b4', rotulo: 'B4 (ISO) — 250 x 353 mm', curto: 'B4', w: 250, h: 353 },
  { id: 'b5', rotulo: 'B5 (ISO) — 176 x 250 mm', curto: 'B5', w: 176, h: 250 },
  { id: 'b6', rotulo: 'B6 (ISO) — 125 x 176 mm', curto: 'B6', w: 125, h: 176 },
  { id: 'meia-folha', rotulo: 'Meia folha (1/2) — 480 x 660 mm', curto: '1/2 Folha', w: 480, h: 660 },
  { id: 'folha-64x88', rotulo: 'Folha 64 x 88 cm — 640 x 880 mm', curto: '64x88', w: 640, h: 880 },
  { id: 'folha-bb', rotulo: 'Folha inteira (BB) — 660 x 960 mm', curto: 'BB 66x96', w: 660, h: 960 },
  { id: 'formato-76x112', rotulo: 'Formato 76 x 112 cm — 760 x 1120 mm', curto: '76x112', w: 760, h: 1120 }
];

export const PECAS_COREL = [
  { id: 'cartao-90x50', rotulo: 'Cartao de visita BR — 90 x 50 mm', curto: '90x50', w: 90, h: 50 },
  { id: 'panfleto-140x100', rotulo: 'Panfleto — 140 x 100 mm', curto: '140x100', w: 140, h: 100 },
  { id: 'panfleto-100x140', rotulo: 'Panfleto vertical — 100 x 140 mm', curto: '100x140', w: 100, h: 140 },
  { id: 'panfleto-140x200', rotulo: 'Panfleto — 140 x 200 mm', curto: '140x200', w: 140, h: 200 },
  { id: 'panfleto-100x150', rotulo: 'Panfleto / Postal — 100 x 150 mm', curto: '100x150', w: 100, h: 150 },
  { id: 'panfleto-150x210', rotulo: 'Panfleto — 150 x 210 mm', curto: '150x210', w: 150, h: 210 },
  { id: 'a4', rotulo: 'A4 — 210 x 297 mm', curto: 'A4', w: 210, h: 297 },
  { id: 'a5', rotulo: 'A5 — 148 x 210 mm', curto: 'A5', w: 148, h: 210 },
  { id: 'a6', rotulo: 'A6 — 105 x 148 mm', curto: 'A6', w: 105, h: 148 },
  { id: 'a3', rotulo: 'A3 — 297 x 420 mm', curto: 'A3', w: 297, h: 420 },
  { id: 'cartao-iso', rotulo: 'Cartao de visita ISO — 85 x 55 mm', curto: '85x55', w: 85, h: 55 },
  { id: 'cartao-duplo', rotulo: 'Cartao duplo — 180 x 50 mm', curto: '180x50', w: 180, h: 50 },
  { id: 'filipeta', rotulo: 'Filipeta / Comanda — 100 x 210 mm', curto: '100x210', w: 100, h: 210 },
  { id: 'dl', rotulo: 'DL — 99 x 210 mm', curto: 'DL', w: 99, h: 210 },
  { id: 'folder-a4', rotulo: 'Folder A4 aberto — 297 x 210 mm', curto: 'Folder A4', w: 297, h: 210 },
  { id: 'folder-1dobra', rotulo: 'Folder 1 dobra aberto — 200 x 210 mm', curto: 'Folder 1D', w: 200, h: 210 },
  { id: 'folder-3paineis', rotulo: 'Folder 3 paineis aberto — 630 x 210 mm', curto: 'Folder 3P', w: 630, h: 210 },
  { id: 'pasta-fechada', rotulo: 'Pasta executiva fechada — 220 x 310 mm', curto: 'Pasta F', w: 220, h: 310 },
  { id: 'pasta-aberta', rotulo: 'Pasta aberta — 450 x 310 mm', curto: 'Pasta A', w: 450, h: 310 },
  { id: 'cartaz-300x420', rotulo: 'Cartaz pequeno — 300 x 420 mm', curto: '300x420', w: 300, h: 420 },
  { id: 'cartaz-310x450', rotulo: 'Cartaz A3+ — 310 x 450 mm', curto: '310x450', w: 310, h: 450 },
  { id: 'a7', rotulo: 'A7 — 74 x 105 mm', curto: 'A7', w: 74, h: 105 },
  { id: 'a8', rotulo: 'A8 — 52 x 74 mm', curto: 'A8', w: 52, h: 74 },
  { id: 'a2', rotulo: 'A2 — 420 x 594 mm', curto: 'A2', w: 420, h: 594 },
  { id: 'a1', rotulo: 'A1 — 594 x 841 mm', curto: 'A1', w: 594, h: 841 },
  { id: 'a0', rotulo: 'A0 — 841 x 1189 mm', curto: 'A0', w: 841, h: 1189 },
  { id: 'quad-100', rotulo: 'Quadrado — 100 x 100 mm', curto: '100x100', w: 100, h: 100 },
  { id: 'quad-148', rotulo: 'Quadrado — 148 x 148 mm', curto: '148x148', w: 148, h: 148 },
  { id: 'quad-200', rotulo: 'Quadrado — 200 x 200 mm', curto: '200x200', w: 200, h: 200 },
  { id: 'quad-210', rotulo: 'Quadrado — 210 x 210 mm', curto: '210x210', w: 210, h: 210 },
  { id: 'livro-br', rotulo: 'Livro BR — 160 x 230 mm', curto: '160x230', w: 160, h: 230 },
  { id: 'livro-tec', rotulo: 'Livro tecnico — 170 x 240 mm', curto: '170x240', w: 170, h: 240 },
  { id: 'livro-rom', rotulo: 'Livro romance — 140 x 210 mm', curto: '140x210', w: 140, h: 210 },
  { id: 'livro-pocket', rotulo: 'Livro pocket — 120 x 180 mm', curto: '120x180', w: 120, h: 180 },
  { id: 'revista', rotulo: 'Revista — 205 x 275 mm', curto: '205x275', w: 205, h: 275 },
  { id: 'apostila', rotulo: 'Apostila — 200 x 275 mm', curto: '200x275', w: 200, h: 275 },
  { id: 'agenda', rotulo: 'Agenda / Caderno — 145 x 205 mm', curto: '145x205', w: 145, h: 205 },
  { id: 'tabloide', rotulo: 'Tabloide — 280 x 380 mm', curto: '280x380', w: 280, h: 380 },
  { id: 'standard', rotulo: 'Standard — 320 x 520 mm', curto: '320x520', w: 320, h: 520 },
  { id: 'etq-50x30', rotulo: 'Etiqueta pequena — 50 x 30 mm', curto: '50x30', w: 50, h: 30 },
  { id: 'etq-50x50', rotulo: 'Etiqueta quadrada — 50 x 50 mm', curto: '50x50', w: 50, h: 50 },
  { id: 'etq-80x50', rotulo: 'Etiqueta media — 80 x 50 mm', curto: '80x50', w: 80, h: 50 },
  { id: 'etq-100x150', rotulo: 'Etiqueta envio — 100 x 150 mm', curto: '100x150', w: 100, h: 150 },
  { id: 'tag-50x90', rotulo: 'Tag roupa — 50 x 90 mm', curto: '50x90', w: 50, h: 90 },
  { id: 'tag-40x85', rotulo: 'Tag pequena — 40 x 85 mm', curto: '40x85', w: 40, h: 85 },
  { id: 'marcador-180', rotulo: 'Marcador — 50 x 180 mm', curto: '50x180', w: 50, h: 180 },
  { id: 'marcador-210', rotulo: 'Marcador — 50 x 210 mm', curto: '50x210', w: 50, h: 210 },
  { id: 'ingresso', rotulo: 'Ingresso — 150 x 50 mm', curto: '150x50', w: 150, h: 50 },
  { id: 'rifa', rotulo: 'Rifa — 200 x 70 mm', curto: '200x70', w: 200, h: 70 },
  { id: 'talao', rotulo: 'Talao — 140 x 200 mm', curto: 'Talao', w: 140, h: 200 },
  { id: 'pulseira', rotulo: 'Pulseira — 250 x 20 mm', curto: '250x20', w: 250, h: 20 },
  { id: 'door-hanger', rotulo: 'Door hanger — 90 x 210 mm', curto: '90x210', w: 90, h: 210 },
  { id: 'ventarola', rotulo: 'Ventarola — 180 x 220 mm', curto: '180x220', w: 180, h: 220 },
  { id: 'wobbler', rotulo: 'Wobbler — 120 x 120 mm', curto: '120x120', w: 120, h: 120 },
  { id: 'jogo-americano', rotulo: 'Jogo americano — 420 x 300 mm', curto: '420x300', w: 420, h: 300 },
  { id: 'solapa', rotulo: 'Solapa — 100 x 80 mm', curto: '100x80', w: 100, h: 80 },
  { id: 'cinta', rotulo: 'Cinta — 300 x 60 mm', curto: '300x60', w: 300, h: 60 },
  { id: 'calendario', rotulo: 'Calendario mesa — 210 x 150 mm', curto: '210x150', w: 210, h: 150 },
  { id: 'folhinha', rotulo: 'Folhinha — 240 x 340 mm', curto: '240x340', w: 240, h: 340 },
  { id: 'ima', rotulo: 'Ima de geladeira — 50 x 45 mm', curto: '50x45', w: 50, h: 45 },
  { id: 'env-dl', rotulo: 'Envelope DL — 229 x 114 mm', curto: 'Env DL', w: 229, h: 114 },
  { id: 'env-c5', rotulo: 'Envelope C5 — 162 x 229 mm', curto: 'Env C5', w: 162, h: 229 },
  { id: 'env-saco', rotulo: 'Envelope Saco A4 — 240 x 340 mm', curto: 'Env A4', w: 240, h: 340 }
];

export function paraCrlf(texto) {
  return String(texto).replace(/\r?\n/g, '\r\n');
}

export function asciiSeguro(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\r\n\t]/g, '');
}

/**
 * Gera IBD_InstalarBarraFerramentas.bas 100% compativel com qualquer versao do CorelDRAW.
 * Usa Object (sem CommandBarControl), CUI_BAR_TOP = 1 (cuiBarTop) e o GUID oficial de Macros.
 */
export function gerarInstaladorBarraBas(marca, macros) {
  const nomeMarca = asciiSeguro(marca.nome || 'IBD');
  const linhasAdd = macros.map((m) => {
    const cap = asciiSeguro(m.titulo).replace(/"/g, '""');
    return [
      '    On Error Resume Next',
      `    Set btn = bar.Controls.AddCustomButton(CAT_MACROS, "${m.macro}")`,
      '    If Not btn Is Nothing Then',
      `        btn.Caption = "${cap}"`,
      `        btn.ToolTipText = "${nomeMarca}: ${cap}"`,
      '        Err.Clear',
      `        btn.SetIcon2 pastaIcones & "${m.ico}"`,
      '        If Err.Number <> 0 Then',
      '            Err.Clear',
      `            btn.SetCustomIcon pastaIcones & "${m.ico}"`,
      '        End If',
      '    End If',
      '    On Error GoTo ErrHandler'
    ].join('\r\n');
  }).join('\r\n\r\n');

  return paraCrlf(`Attribute VB_Name = "IBD_BarraFerramentas"
' ${nomeMarca} - Instalador da Barra de Ferramentas e Painel para CorelDRAW
' Compativel com CorelDRAW X3 a 2025+ (32 e 64 bits).
' Importe os .bas de scripts\\, IBD_PainelCorel.bas e este modulo em GlobalMacros (Alt + F11),
' depois execute GlobalMacros.IBD_BarraFerramentas.InstalarBarraIBD.

Option Explicit

Public Sub InstalarBarraIBD()
    Const BAR_NOME As String = "${nomeMarca} Ferramentas"
    Const CUI_BAR_TOP As Long = 1
    Const CAT_MACROS As String = "2cc24a3e-fe24-4708-9a74-9c75406eebcd"
    Dim bar As CommandBar
    Dim btn As Object
    Dim pastaPadrao As String
    Dim pastaIcones As String
    Dim i As Long

    pastaPadrao = Environ$("LOCALAPPDATA")
    If Len(pastaPadrao) > 0 Then
        pastaPadrao = pastaPadrao & "\\${nomeMarca}_Ferramentas\\CorelDRAW\\icones\\"
    Else
        pastaPadrao = "C:\\${nomeMarca}_Ferramentas\\icones\\"
    End If

    pastaIcones = InputBox( _
        "Informe o caminho completo da pasta 'icones' (terminando com \\):", _
        "${nomeMarca} - Instalar Barra de Ferramentas", _
        pastaPadrao)
    If Trim$(pastaIcones) = "" Then Exit Sub
    If Right$(pastaIcones, 1) <> "\\" And Right$(pastaIcones, 1) <> "/" Then
        pastaIcones = pastaIcones & "\\"
    End If

    On Error GoTo ErrHandler
    For i = FrameWork.CommandBars.Count To 1 Step -1
        If FrameWork.CommandBars(i).Name = BAR_NOME Then
            FrameWork.CommandBars(i).Delete
        End If
    Next i

    Set bar = FrameWork.CommandBars.Add(BAR_NOME, CUI_BAR_TOP, False)

${linhasAdd}

    bar.Visible = True
    MsgBox "Barra '" & BAR_NOME & "' criada com " & bar.Controls.Count & " botao(oes)!" & vbCrLf & _
           "Clique no primeiro icone ('Painel ${nomeMarca}') para abrir o painel flutuante/encaixado.", _
           vbInformation, "${nomeMarca} Ferramentas"
    Exit Sub

ErrHandler:
    MsgBox "Erro ao montar barra no CorelDRAW: " & Err.Description, vbCritical, "${nomeMarca} Ferramentas"
End Sub
`);
}

/**
 * Modulo VBA que abre o Painel IBD diretamente de dentro do CorelDRAW
 * (da barra de ferramentas ou atalho) e o vincula a janela ativa do CorelDRAW.
 */
export function gerarPainelAbrirBas(marca) {
  const nomeMarca = asciiSeguro(marca.nome || 'IBD');
  return paraCrlf(`Attribute VB_Name = "IBD_PainelCorel"
' ${nomeMarca} - Atalho interno para abrir o Painel Universal dentro do CorelDRAW
' Compativel com todas as versoes (VBA6 32-bit e VBA7 64-bit).

Option Explicit

Public Sub AbrirPainelIBD()
    Dim fso As Object
    Dim pasta As String
    Dim htaPath As String

    Set fso = CreateObject("Scripting.FileSystemObject")
    pasta = GetSetting("${nomeMarca}_Ferramentas", "CorelDRAW", "PastaPainel", "")
    If Len(pasta) = 0 Or Not fso.FileExists(pasta & "\\IBD_Painel_Corel.hta") Then
        pasta = Environ$("LOCALAPPDATA") & "\\${nomeMarca}_Ferramentas\\CorelDRAW"
    End If

    If Not fso.FileExists(pasta & "\\IBD_Painel_Corel.hta") Then
        pasta = InputBox( _
            "Informe a pasta onde extraiu o arquivo IBD_Painel_Corel.hta:", _
            "${nomeMarca} - Abrir Painel", _
            pasta)
        If Trim$(pasta) = "" Then Exit Sub
        If Right$(pasta, 1) = "\\" Then pasta = Left$(pasta, Len(pasta) - 1)
        If Not fso.FileExists(pasta & "\\IBD_Painel_Corel.hta") Then
            MsgBox "Arquivo IBD_Painel_Corel.hta nao encontrado em: " & pasta, vbExclamation, "${nomeMarca} Ferramentas"
            Exit Sub
        End If
    End If

    SaveSetting "${nomeMarca}_Ferramentas", "CorelDRAW", "PastaPainel", pasta
    htaPath = pasta & "\\IBD_Painel_Corel.hta"
    Shell "mshta.exe """ & htaPath & """", vbNormalFocus
End Sub
`);
}

/**
 * Script PowerShell auxiliar que vincula o painel HTA a janela do CorelDRAW
 * (GWLP_HWNDPARENT = owner) para permanecer sempre por cima do CorelDRAW e encaixar na borda.
 */
export function gerarAttachPs1(marca) {
  const tituloJanela = `${asciiSeguro(marca.nome || 'IBD')} Ferramentas - CorelDRAW`;
  return paraCrlf(`param(
  [string]$Side = "R",
  [int]$Width = 318
)
$ErrorActionPreference = "SilentlyContinue"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class IbdDockWin {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
  private static extern IntPtr SetWindowLong32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
  private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  public static IntPtr SetOwner(IntPtr child, IntPtr owner) {
    if (IntPtr.Size == 8) return SetWindowLongPtr64(child, -8, owner);
    return SetWindowLong32(child, -8, owner);
  }
}
"@

$htaHwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25; $i++) {
  $htaHwnd = [IbdDockWin]::FindWindow($null, "${tituloJanela}")
  if ($htaHwnd -ne [IntPtr]::Zero) { break }
  Start-Sleep -Milliseconds 120
}
if ($htaHwnd -eq [IntPtr]::Zero) { exit 0 }

$corel = Get-Process -Name "CorelDRW" | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $corel) { exit 0 }

$corelHwnd = $corel.MainWindowHandle
[void][IbdDockWin]::SetOwner($htaHwnd, $corelHwnd)

$rc = New-Object IbdDockWin+RECT
if ([IbdDockWin]::GetWindowRect($corelHwnd, [ref]$rc)) {
  $top = $rc.Top + 132
  $h = [Math]::Max(420, ($rc.Bottom - $rc.Top) - 168)
  if ($Side -eq "L") {
    $x = $rc.Left + 8
    [void][IbdDockWin]::MoveWindow($htaHwnd, $x, $top, $Width, $h, $true)
  } elseif ($Side -eq "R") {
    $x = [Math]::Max($rc.Left + 8, $rc.Right - $Width - 10)
    [void][IbdDockWin]::MoveWindow($htaHwnd, $x, $top, $Width, $h, $true)
  }
}
[void][IbdDockWin]::SetWindowPos($htaHwnd, [IntPtr]::Zero, 0, 0, 0, 0, 0x0013)
`);
}

export function gerarAbrirPainelBat() {
  return paraCrlf(`@echo off
start "" mshta.exe "%~dp0IBD_Painel_Corel.hta"
`);
}

export function gerarInstalarCorelBat(marca) {
  const nomeMarca = asciiSeguro(marca.nome || 'IBD');
  return paraCrlf(`@echo off
setlocal
set "DEST=%LOCALAPPDATA%\\${nomeMarca}_Ferramentas\\CorelDRAW"
if not exist "%DEST%" mkdir "%DEST%"
xcopy "%~dp0." "%DEST%\\" /E /I /Y /Q >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\${nomeMarca} Painel - CorelDRAW.lnk'); $lnk.TargetPath='mshta.exe'; $lnk.Arguments='\"%DEST%\\IBD_Painel_Corel.hta\"'; $lnk.WorkingDirectory='%DEST%'; $lnk.IconLocation='%DEST%\\icones\\painel-ibd.ico'; $lnk.Save()" >nul 2>&1

echo ====================================================================
echo  ${nomeMarca} Ferramentas - Painel Universal para CorelDRAW instalado!
echo ====================================================================
echo.
echo Pasta instalada: %DEST%
echo Atalho criado na Area de Trabalho: "${nomeMarca} Painel - CorelDRAW"
echo.
echo O painel funciona em QUALQUER versao do CorelDRAW sem importar VBA.
echo.
echo [OPCIONAL] Para tambem criar a barra de icones fixa dentro do Corel:
echo   1. No CorelDRAW, pressione Alt + F11 (Editor VBA).
echo   2. Clique direito em GlobalMacros ^> Importar Arquivo... e importe:
echo      - Todos os arquivos .bas de: %DEST%\\scripts\\
echo      - %DEST%\\IBD_PainelCorel.bas
echo      - %DEST%\\IBD_InstalarBarraFerramentas.bas
echo   3. Execute InstalarBarraIBD (F5).
echo.
echo Abrindo o Painel ${nomeMarca} agora...
start "" mshta.exe "%DEST%\\IBD_Painel_Corel.hta"
pause
`);
}

/**
 * Gera o Painel Universal HTML5/HTA do CorelDRAW com visual identico ao painel do Illustrator,
 * controle Mostrar/Ocultar funcoes, Favoritos, Busca, Encaixe na borda do Corel e execucao
 * direta via COM late-bound (sem depender de versao do CorelDRAW).
 */
export function gerarPainelCorelHta(marca, catalogo) {
  const nomeMarca = asciiSeguro(marca.nome || 'IBD');
  const tituloJanela = `${nomeMarca} Ferramentas - CorelDRAW`;
  const versao = marca.versao || '0.1.0';
  const cores = marca.cores || {};
  const iconesJs = gerarCodigoIconesJs();

  const toolsCorel = (catalogo.ferramentas || [])
    .filter((f) => f.app === 'coreldraw' && f.tipo === 'script')
    .map((f) => ({
      id: f.id,
      slug: f.id.split('/').pop(),
      titulo: f.titulo,
      descricao: f.descricao,
      tags: f.tags || [],
      icone: f.icone || resolverIconeId(f.id, f.tipo)
    }));

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <!-- O modo IE11 não expõe o VBScript usado pela ponte COM do painel. -->
  <meta http-equiv="X-UA-Compatible" content="IE=10" />
  <title>${tituloJanela}</title>
  <HTA:APPLICATION
    ID="IBDPainelCorel"
    APPLICATIONNAME="${tituloJanela}"
    BORDER="thin"
    BORDERSTYLE="normal"
    CAPTION="yes"
    CONTEXTMENU="no"
    MAXIMIZEBUTTON="no"
    MINIMIZEBUTTON="yes"
    NAVIGABLE="no"
    SCROLL="no"
    SHOWINTASKBAR="yes"
    SINGLEINSTANCE="yes"
    SYSMENU="yes"
    WINDOWSTATE="normal"
  />
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
    body {
      display: -ms-flexbox;
      display: flex;
      -ms-flex-direction: column;
      flex-direction: column;
      background: ${cores.fundo || '#181a1f'};
      color: ${cores.texto || '#e4e7ee'};
      font-family: "Segoe UI", Tahoma, sans-serif;
      font-size: 12px;
    }
    .cabecalho { -ms-flex-negative: 0; flex-shrink: 0; padding: 8px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; }
    .cabecalho-linha { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; -ms-flex-pack: justify; justify-content: space-between; }
    .titulo-grupo { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; }
    .badge-marca { padding: 2px 6px; border-radius: 4px; background: ${cores.acento || '#f0c419'}; color: ${cores.acentoTexto || '#16181d'}; font-size: 10px; font-weight: 800; margin-right: 8px; }
    .titulo-texto h1 { margin: 0; font-size: 12px; font-weight: 700; }
    .contexto { display: block; color: ${cores.textoSecundario || '#b6bcc8'}; font-size: 10px; }
    .modo-grupo { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; }
    .modo-btn {
      display: inline-block;
      min-width: 24px;
      height: 24px;
      padding: 0 5px;
      margin-left: 3px;
      border-radius: 5px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: transparent;
      color: ${cores.textoSecundario || '#b6bcc8'};
      cursor: pointer;
      font-size: 11px;
      line-height: 22px;
      text-align: center;
    }
    .modo-btn:hover { border-color: ${cores.acento || '#f0c419'}; color: ${cores.texto || '#e4e7ee'}; }
    .modo-btn.ativo { background: ${cores.acento || '#f0c419'}; color: ${cores.acentoTexto || '#16181d'}; border-color: ${cores.acento || '#f0c419'}; font-weight: 700; }
    .ocultas-badge { display: inline-block; padding: 0 4px; margin-left: 2px; border-radius: 7px; background: #4a232b; color: ${cores.erro || '#f29ca6'}; font-size: 9px; font-weight: 700; }
    .modo-btn.ativo .ocultas-badge { background: #16181d; color: ${cores.acento || '#f0c419'}; }

    .barra-dock {
      -ms-flex-negative: 0;
      flex-shrink: 0;
      display: -ms-flexbox;
      display: flex;
      -ms-flex-align: center;
      align-items: center;
      -ms-flex-pack: justify;
      justify-content: space-between;
      padding: 4px 10px;
      background: ${cores.superficie || '#20232a'};
      border-bottom: 1px solid ${cores.borda || '#3a404d'};
      font-size: 10px;
      color: ${cores.textoSecundario || '#b6bcc8'};
    }
    .dock-btns button {
      padding: 2px 7px;
      margin-left: 3px;
      border-radius: 4px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: ${cores.fundo || '#181a1f'};
      color: ${cores.textoSecundario || '#b6bcc8'};
      font-size: 10px;
      cursor: pointer;
    }
    .dock-btns button:hover { border-color: ${cores.acento || '#f0c419'}; color: ${cores.texto || '#e4e7ee'}; }

    .barra-busca { -ms-flex-negative: 0; flex-shrink: 0; padding: 7px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; }
    .barra-busca input {
      width: 100%;
      height: 26px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: ${cores.superficie || '#20232a'};
      color: ${cores.texto || '#e4e7ee'};
      font-size: 11px;
    }

    .abas { -ms-flex-negative: 0; flex-shrink: 0; display: -ms-flexbox; display: flex; padding: 6px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; }
    .aba {
      padding: 3px 9px;
      margin-right: 4px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: ${cores.textoSecundario || '#b6bcc8'};
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .aba.ativo { background: ${cores.superficie || '#20232a'}; color: ${cores.acento || '#f0c419'}; border-color: ${cores.acento || '#f0c419'}; }
    .aba-badge { padding: 0 4px; border-radius: 8px; background: #362f19; color: ${cores.acento || '#f0c419'}; font-size: 9px; margin-left: 3px; }

    .lista { -ms-flex: 1; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
    .lista.modo-grade { padding: 7px; }
    .grade-wrap { display: -ms-flexbox; display: flex; -ms-flex-wrap: wrap; flex-wrap: wrap; }
    .tile {
      width: 48%;
      margin: 1%;
      padding: 8px;
      border: 1px solid ${cores.borda || '#3a404d'};
      border-radius: 7px;
      background: ${cores.superficie || '#20232a'};
      cursor: pointer;
    }
    .tile:hover { border-color: ${cores.acento || '#f0c419'}; background: #282c36; }
    .tile-topo { display: -ms-flexbox; display: flex; -ms-flex-pack: justify; justify-content: space-between; -ms-flex-align: start; align-items: flex-start; margin-bottom: 6px; }
    .icone-badge { display: inline-block; width: 32px; height: 32px; padding: 4px; border-radius: 7px; background: ${cores.fundo || '#181a1f'}; border: 1px solid ${cores.borda || '#3a404d'}; text-align: center; }
    .icone-badge.pequeno { width: 26px; height: 26px; padding: 3px; border-radius: 5px; margin-right: 8px; }
    .tile-titulo { font-size: 11px; font-weight: 600; line-height: 1.25; margin-bottom: 6px; min-height: 28px; }
    .tile-pe { font-size: 9px; font-weight: 700; color: ${cores.textoSecundario || '#b6bcc8'}; }
    .star-btn { width: 20px; height: 20px; border: none; border-radius: 4px; background: transparent; color: ${cores.textoSecundario || '#b6bcc8'}; cursor: pointer; padding: 0; font-size: 13px; }
    .star-btn.ativo { color: ${cores.acento || '#f0c419'}; }

    .cartao { padding: 9px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; }
    .cartao-cab { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; }
    .cartao-titulo { -ms-flex: 1; flex: 1; font-size: 12px; font-weight: 600; }
    .cartao-descricao { margin-top: 5px; color: ${cores.textoSecundario || '#b6bcc8'}; font-size: 11px; line-height: 1.35; }
    .cartao-acoes { margin-top: 7px; }
    .btn-acao {
      padding: 4px 12px;
      border-radius: 12px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: ${cores.superficie || '#20232a'};
      color: ${cores.texto || '#e4e7ee'};
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-acao:hover { border-color: ${cores.acento || '#f0c419'}; }
    .btn-primario { background: ${cores.acento || '#f0c419'}; color: ${cores.acentoTexto || '#16181d'}; border-color: ${cores.acento || '#f0c419'}; }

    .gerenciar-barra { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; -ms-flex-pack: justify; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; background: ${cores.superficie || '#20232a'}; }
    .gerenciar-info { font-size: 10px; color: ${cores.textoSecundario || '#b6bcc8'}; }
    .gerenciar-item { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; padding: 7px 10px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; cursor: pointer; }
    .gerenciar-item:hover { background: #262a33; }
    .gerenciar-item.oculta { opacity: 0.55; }
    .gerenciar-item input { margin: 0 8px 0 0; }
    .gerenciar-nome { -ms-flex: 1; flex: 1; font-size: 11px; font-weight: 600; }
    .gerenciar-estado { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; background: #173326; color: ${cores.sucesso || '#52b788'}; }
    .gerenciar-item.oculta .gerenciar-estado { background: #3b1e25; color: ${cores.erro || '#f29ca6'}; }

    .form-box { padding: 10px; }
    .form-topo { display: -ms-flexbox; display: flex; -ms-flex-align: center; align-items: center; -ms-flex-pack: justify; justify-content: space-between; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid ${cores.borda || '#3a404d'}; }
    .form-titulo { font-size: 12px; font-weight: 700; color: ${cores.acento || '#f0c419'}; }
    .campo { margin-bottom: 9px; }
    .campo label { display: block; font-size: 10px; color: ${cores.textoSecundario || '#b6bcc8'}; margin-bottom: 3px; font-weight: 600; }
    .campo select, .campo input[type="text"], .campo input[type="number"] {
      width: 100%;
      height: 26px;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: ${cores.superficie || '#20232a'};
      color: ${cores.texto || '#e4e7ee'};
      font-size: 11px;
    }
    .campo-linha { display: -ms-flexbox; display: flex; }
    .campo-linha > div { -ms-flex: 1; flex: 1; margin-right: 6px; }
    .campo-linha > div:last-child { margin-right: 0; }
    .chk-linha { display: block; margin-bottom: 6px; font-size: 11px; cursor: pointer; }
    .chk-linha input { margin-right: 6px; vertical-align: middle; }
    .chips { margin-top: 4px; }
    .chip {
      display: inline-block;
      padding: 2px 7px;
      margin: 2px 3px 0 0;
      border-radius: 10px;
      border: 1px solid ${cores.borda || '#3a404d'};
      background: ${cores.superficie || '#20232a'};
      color: ${cores.texto || '#e4e7ee'};
      font-size: 10px;
      cursor: pointer;
    }
    .chip:hover { border-color: ${cores.acento || '#f0c419'}; color: ${cores.acento || '#f0c419'}; }
    .form-rodape { margin-top: 12px; display: -ms-flexbox; display: flex; -ms-flex-pack: justify; justify-content: space-between; }

    .rodape { -ms-flex-negative: 0; flex-shrink: 0; padding: 6px 10px; border-top: 1px solid ${cores.borda || '#3a404d'}; color: ${cores.textoSecundario || '#b6bcc8'}; font-size: 10px; background: ${cores.superficie || '#20232a'}; }
    .rodape.erro { color: ${cores.erro || '#f29ca6'}; }
    .rodape.sucesso { color: ${cores.sucesso || '#52b788'}; }
    .vazio { padding: 24px 12px; color: ${cores.textoSecundario || '#b6bcc8'}; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="cabecalho">
    <div class="cabecalho-linha">
      <div class="titulo-grupo">
        <span class="badge-marca">${nomeMarca}</span>
        <div class="titulo-texto">
          <h1>Ferramentas</h1>
          <span class="contexto"><span id="nome-host">CorelDRAW</span> · v${versao}</span>
        </div>
      </div>
      <div class="modo-grupo">
        <button type="button" id="modo-grade" class="modo-btn ativo" title="Grade de icones">⊞</button>
        <button type="button" id="modo-lista" class="modo-btn" title="Lista detalhada">☰</button>
        <button type="button" id="btn-gerenciar" class="modo-btn" title="Mostrar ou ocultar funcoes">👁<span class="ocultas-badge" id="ocultas-badge" style="display:none">0</span></button>
      </div>
    </div>
  </div>

  <div class="barra-dock">
    <span id="corel-conn">Conectando ao CorelDRAW...</span>
    <span class="dock-btns">
      <button type="button" id="btn-dock-l" title="Encaixar na esquerda do CorelDRAW">◀ Esq</button>
      <button type="button" id="btn-dock-r" title="Encaixar na direita do CorelDRAW">Dir ▶</button>
      <button type="button" id="btn-reconectar" title="Reconectar ao CorelDRAW">↻</button>
    </span>
  </div>

  <div class="barra-busca">
    <input id="filtro" type="text" placeholder="Buscar por nome ou tag..." />
  </div>

  <div class="abas" id="abas">
    <button type="button" class="aba ativo" data-aba="todos">Todos</button>
    <button type="button" class="aba" data-aba="favoritos">★ Favoritos <span class="aba-badge" id="fav-contador">0</span></button>
  </div>

  <div id="lista" class="lista modo-grade"></div>

  <div class="rodape" id="rodape">
    <span id="status">Pronto. Clique em uma ferramenta para configurar e executar.</span>
  </div>

  <script language="VBScript">
    Option Explicit

    ' Constantes VGCore verificadas (validas do CorelDRAW X3 ao 2025+)
    Const CDR_MM = 3
    Const CDR_PT = 14
    Const CDR_CENTER = 9
    Const CDR_ALIGN_CENTER = 3
    Const CDR_CONTOUR_INSIDE = 0
    Const CDR_CONTOUR_OUTSIDE = 1
    Const CDR_BLEND_DIRECT = 0
    Const CDR_CAP_SQUARE = 2
    Const CDR_CORNER_BEVEL = 0
    Const CDR_CORNER_ROUND = 2
    Const CDR_CORNER_MITER = 4
    Const CDR_OUTLINE_ROUND_CAP = 1
    Const CDR_OUTLINE_MITER = 0
    Const CDR_OUTLINE_ROUND = 1
    Const CDR_OUTLINE_BEVEL = 2
    Const CDR_SHAPE_GROUP = 7
    Const CDR_NO_FILL = 0
    Const CDR_FALSE = 0

    Function PastaDoPainel()
      Dim p
      p = Replace(document.location.pathname, "/", "\\")
      If Left(p, 1) = "\\" And Mid(p, 3, 1) = ":" Then p = Mid(p, 2)
      PastaDoPainel = Left(p, InStrRev(p, "\\") - 1)
    End Function

    Function CaminhoPrefs()
      Dim sh, fso, dirIbd
      Set sh = CreateObject("WScript.Shell")
      Set fso = CreateObject("Scripting.FileSystemObject")
      dirIbd = sh.ExpandEnvironmentStrings("%APPDATA%") & "\\IBD"
      If Not fso.FolderExists(dirIbd) Then fso.CreateFolder dirIbd
      CaminhoPrefs = dirIbd & "\\coreldraw-painel-prefs.json"
    End Function

    Function CorelPrefsLer()
      On Error Resume Next
      Dim fso, p, ts
      Set fso = CreateObject("Scripting.FileSystemObject")
      p = CaminhoPrefs()
      If fso.FileExists(p) Then
        Set ts = fso.OpenTextFile(p, 1, False)
        CorelPrefsLer = ts.ReadAll
        ts.Close
      Else
        CorelPrefsLer = "{}"
      End If
    End Function

    Sub CorelPrefsSalvar(jsonStr)
      On Error Resume Next
      Dim fso, p, ts
      Set fso = CreateObject("Scripting.FileSystemObject")
      p = CaminhoPrefs()
      Set ts = fso.OpenTextFile(p, 2, True)
      ts.Write jsonStr
      ts.Close
    End Sub

    Function CorelEncaixarJanela(lado)
      On Error Resume Next
      Dim sh, fso, ps1, cmd
      Set fso = CreateObject("Scripting.FileSystemObject")
      ps1 = PastaDoPainel() & "\\Attach-Painel-Corel.ps1"
      If Not fso.FileExists(ps1) Then
        CorelEncaixarJanela = "Auxiliar de encaixe ausente. Reinstale o pacote do painel."
        Exit Function
      End If
      Set sh = CreateObject("WScript.Shell")
      cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -Side " & lado & " -Width 318"
      sh.Run cmd, 0, False
      If Err.Number <> 0 Then CorelEncaixarJanela = "Falha ao iniciar o encaixe: " & Err.Description
    End Function

    Function ObterCorel(abrirSeFechado)
      Dim app
      On Error Resume Next
      Set app = Nothing
      Set app = GetObject(, "CorelDRAW.Application")
      If Err.Number <> 0 Or (app Is Nothing) Then
        Err.Clear
        If abrirSeFechado Then
          Set app = CreateObject("CorelDRAW.Application")
          If Err.Number = 0 And Not (app Is Nothing) Then
            app.Visible = True
          End If
        End If
      End If
      On Error GoTo 0
      Set ObterCorel = app
    End Function

    Function CorelStatusConexao()
      Dim app
      Set app = ObterCorel(False)
      If app Is Nothing Then
        CorelStatusConexao = "CorelDRAW fechado (abre ao executar)"
      Else
        On Error Resume Next
        Dim ver, docs, sel
        ver = app.Version
        docs = app.Documents.Count
        sel = 0
        If docs > 0 Then sel = app.ActiveDocument.SelectionRange.Count
        CorelStatusConexao = "CorelDRAW v" & ver & " · " & docs & " doc · " & sel & " sel."
      End If
    End Function

    Function CorelCriarPapel(nomeFmt, wMm, hMm, ori, modo, margemMm, sangriaMm)
      On Error Resume Next
      Dim app, doc, pg, origUnit, w, h, tmp, xMin, xMax, yMin, yMax, lyrGuias, editAntes, grupo
      Set app = ObterCorel(True)
      If app Is Nothing Then CorelCriarPapel = "ERRO: Nao foi possivel conectar ao CorelDRAW.": Exit Function

      w = CDbl(wMm): h = CDbl(hMm)
      If w <= 0 Or h <= 0 Then CorelCriarPapel = "ERRO: Largura e altura invalidas.": Exit Function
      If ori = "V" And w > h Then tmp = w: w = h: h = tmp
      If ori = "H" And h > w Then tmp = w: w = h: h = tmp

      grupo = False
      If modo = "D" Or app.Documents.Count = 0 Then
        Set doc = app.CreateDocument
        origUnit = CDR_MM
        doc.Unit = CDR_MM
        Set pg = doc.ActivePage
        pg.SetSize w, h
        pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
      Else
        Set doc = app.ActiveDocument
        origUnit = doc.Unit
        doc.Unit = CDR_MM
        doc.BeginCommandGroup "IBD: Criar papel " & nomeFmt
        grupo = True
        If modo = "R" Then
          Set pg = doc.ActivePage
          pg.SetSize w, h
          pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
        Else
          Set pg = doc.AddPages(1)
          pg.SetSize w, h
          pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
          pg.Activate
        End If
      End If

      If Err.Number <> 0 Then
        Dim e1: e1 = Err.Description
        If grupo Then doc.EndCommandGroup
        CorelCriarPapel = "ERRO: " & e1
        Exit Function
      End If

      If CDbl(margemMm) > 0 Or CDbl(sangriaMm) > 0 Then
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
        Set lyrGuias = pg.GuidesLayer
        editAntes = lyrGuias.Editable
        lyrGuias.Visible = True
        lyrGuias.Editable = True
        If CDbl(margemMm) > 0 And (2 * CDbl(margemMm)) < w And (2 * CDbl(margemMm)) < h Then
          lyrGuias.CreateGuide xMin + CDbl(margemMm), yMin, xMin + CDbl(margemMm), yMax
          lyrGuias.CreateGuide xMax - CDbl(margemMm), yMin, xMax - CDbl(margemMm), yMax
          lyrGuias.CreateGuide xMin, yMin + CDbl(margemMm), xMax, yMin + CDbl(margemMm)
          lyrGuias.CreateGuide xMin, yMax - CDbl(margemMm), xMax, yMax - CDbl(margemMm)
        End If
        If CDbl(sangriaMm) > 0 Then
          lyrGuias.CreateGuide xMin - CDbl(sangriaMm), yMin, xMin - CDbl(sangriaMm), yMax
          lyrGuias.CreateGuide xMax + CDbl(sangriaMm), yMin, xMax + CDbl(sangriaMm), yMax
          lyrGuias.CreateGuide xMin, yMin - CDbl(sangriaMm), xMax, yMin - CDbl(sangriaMm)
          lyrGuias.CreateGuide xMin, yMax + CDbl(sangriaMm), xMax, yMax + CDbl(sangriaMm)
        End If
        lyrGuias.Editable = editAntes
      End If

      If grupo Then doc.EndCommandGroup
      app.ActiveWindow.ActiveView.ToFitPage
      CorelCriarPapel = "OK:Papel " & nomeFmt & " (" & Round(w, 1) & " x " & Round(h, 1) & " mm) criado."
    End Function

    Function CorelCriarPeca(nomeFmt, wMm, hMm, ori, modo, margemMm, sangriaMm)
      On Error Resume Next
      Dim app, doc, pg, origUnit, w, h, tmp, xMin, xMax, yMin, yMax, lyrGuias, editAntes, lyrMolde, ret, cor, grupo
      Set app = ObterCorel(True)
      If app Is Nothing Then CorelCriarPeca = "ERRO: Nao foi possivel conectar ao CorelDRAW.": Exit Function

      w = CDbl(wMm): h = CDbl(hMm)
      If w <= 0 Or h <= 0 Then CorelCriarPeca = "ERRO: Largura e altura invalidas.": Exit Function
      If ori = "V" And w > h Then tmp = w: w = h: h = tmp
      If ori = "H" And h > w Then tmp = w: w = h: h = tmp

      grupo = False
      If modo = "M" And app.Documents.Count > 0 Then
        Set doc = app.ActiveDocument
        origUnit = doc.Unit
        doc.Unit = CDR_MM
        doc.BeginCommandGroup "IBD: Molde " & nomeFmt
        grupo = True
        Set pg = doc.ActivePage
        xMin = pg.CenterX - (w / 2): yMin = pg.CenterY - (h / 2)
        xMax = xMin + w: yMax = yMin + h
        Set lyrMolde = pg.ActiveLayer
        If (lyrMolde Is Nothing) Or (Not lyrMolde.Editable) Then Set lyrMolde = pg.Layers(1)
        Set ret = lyrMolde.CreateRectangle2(xMin, yMin, w, h)
        ret.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
        ret.Fill.ApplyNoFill
        Set cor = app.CreateCMYKColor(0, 100, 0, 0)
        ret.Outline.SetProperties 0.2, , cor
        ret.CreateSelection
      ElseIf modo = "D" Or app.Documents.Count = 0 Then
        Set doc = app.CreateDocument
        origUnit = CDR_MM
        doc.Unit = CDR_MM
        Set pg = doc.ActivePage
        pg.SetSize w, h
        pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
      Else
        Set doc = app.ActiveDocument
        origUnit = doc.Unit
        doc.Unit = CDR_MM
        doc.BeginCommandGroup "IBD: Criar peca " & nomeFmt
        grupo = True
        If modo = "R" Then
          Set pg = doc.ActivePage
          pg.SetSize w, h
          pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
        Else
          Set pg = doc.AddPages(1)
          pg.SetSize w, h
          pg.Name = nomeFmt & " " & Round(w, 1) & "x" & Round(h, 1) & "mm"
          pg.Activate
        End If
        xMin = pg.LeftX: xMax = pg.RightX: yMin = pg.BottomY: yMax = pg.TopY
      End If

      If Err.Number <> 0 Then
        Dim e1: e1 = Err.Description
        If grupo Then doc.EndCommandGroup
        CorelCriarPeca = "ERRO: " & e1
        Exit Function
      End If

      If CDbl(margemMm) > 0 Or CDbl(sangriaMm) > 0 Then
        Set lyrGuias = pg.GuidesLayer
        editAntes = lyrGuias.Editable
        lyrGuias.Visible = True
        lyrGuias.Editable = True
        If CDbl(margemMm) > 0 And (2 * CDbl(margemMm)) < w And (2 * CDbl(margemMm)) < h Then
          lyrGuias.CreateGuide xMin + CDbl(margemMm), yMin, xMin + CDbl(margemMm), yMax
          lyrGuias.CreateGuide xMax - CDbl(margemMm), yMin, xMax - CDbl(margemMm), yMax
          lyrGuias.CreateGuide xMin, yMin + CDbl(margemMm), xMax, yMin + CDbl(margemMm)
          lyrGuias.CreateGuide xMin, yMax - CDbl(margemMm), xMax, yMax - CDbl(margemMm)
        End If
        If CDbl(sangriaMm) > 0 Then
          lyrGuias.CreateGuide xMin - CDbl(sangriaMm), yMin, xMin - CDbl(sangriaMm), yMax
          lyrGuias.CreateGuide xMax + CDbl(sangriaMm), yMin, xMax + CDbl(sangriaMm), yMax
          lyrGuias.CreateGuide xMin, yMin - CDbl(sangriaMm), xMax, yMin - CDbl(sangriaMm)
          lyrGuias.CreateGuide xMin, yMax + CDbl(sangriaMm), xMax, yMax + CDbl(sangriaMm)
        End If
        lyrGuias.Editable = editAntes
      End If

      If grupo Then doc.EndCommandGroup
      If modo <> "M" Then app.ActiveWindow.ActiveView.ToFitPage
      CorelCriarPeca = "OK:Peca " & nomeFmt & " (" & Round(w, 1) & " x " & Round(h, 1) & " mm) criada."
    End Function

    Function CorelMargemSeguranca(valorMm, aplicarTodas)
      On Error Resume Next
      Dim app, doc, origUnit, pg, criadas, ignoradas, m, chaves, chave, lyr, edAntes
      Set app = ObterCorel(False)
      If app Is Nothing Or app.Documents.Count = 0 Then
        CorelMargemSeguranca = "ERRO: Abra um documento no CorelDRAW primeiro."
        Exit Function
      End If
      m = CDbl(valorMm)
      If m <= 0 Then CorelMargemSeguranca = "ERRO: Informe uma margem maior que zero.": Exit Function

      Set doc = app.ActiveDocument
      origUnit = doc.Unit
      doc.Unit = CDR_MM
      doc.BeginCommandGroup "IBD: Margem de seguranca (guias)"
      criadas = 0: ignoradas = 0: chaves = "|"

      If aplicarTodas Then
        For Each pg In doc.Pages
          chave = CStr(Round(pg.LeftX, 2)) & ";" & CStr(Round(pg.BottomY, 2)) & ";" & CStr(Round(pg.RightX, 2)) & ";" & CStr(Round(pg.TopY, 2))
          If pg.GuidesLayer.Master And InStr(1, chaves, "|" & chave & "|", 0) > 0 Then
            criadas = criadas + 1
          Else
            If pg.GuidesLayer.Master Then chaves = chaves & chave & "|"
            If (2 * m) < pg.SizeWidth And (2 * m) < pg.SizeHeight Then
              Set lyr = pg.GuidesLayer: edAntes = lyr.Editable
              lyr.Visible = True: lyr.Editable = True
              lyr.CreateGuide pg.LeftX + m, pg.BottomY, pg.LeftX + m, pg.TopY
              lyr.CreateGuide pg.RightX - m, pg.BottomY, pg.RightX - m, pg.TopY
              lyr.CreateGuide pg.LeftX, pg.BottomY + m, pg.RightX, pg.BottomY + m
              lyr.CreateGuide pg.LeftX, pg.TopY - m, pg.RightX, pg.TopY - m
              lyr.Editable = edAntes
              criadas = criadas + 1
            Else
              ignoradas = ignoradas + 1
            End If
          End If
        Next
      Else
        Set pg = doc.ActivePage
        If (2 * m) < pg.SizeWidth And (2 * m) < pg.SizeHeight Then
          Set lyr = pg.GuidesLayer: edAntes = lyr.Editable
          lyr.Visible = True: lyr.Editable = True
          lyr.CreateGuide pg.LeftX + m, pg.BottomY, pg.LeftX + m, pg.TopY
          lyr.CreateGuide pg.RightX - m, pg.BottomY, pg.RightX - m, pg.TopY
          lyr.CreateGuide pg.LeftX, pg.BottomY + m, pg.RightX, pg.BottomY + m
          lyr.CreateGuide pg.LeftX, pg.TopY - m, pg.RightX, pg.TopY - m
          lyr.Editable = edAntes
          criadas = 1
        Else
          ignoradas = 1
        End If
      End If

      doc.EndCommandGroup
      doc.Unit = origUnit
      If criadas = 0 Then
        CorelMargemSeguranca = "ERRO: A margem excede a metade da pagina."
      Else
        CorelMargemSeguranca = "OK:Guias de " & Round(m, 2) & " mm criadas em " & criadas & " pagina(s)."
      End If
    End Function

    Function CorelTextoDimensoes(unidade, decimais, posicao, tamanhoPt, incluirTracado, nomeCamada)
      On Error Resume Next
      Dim app, doc, origUnit, origRef, sr, s, lx, by, sw, sh, minL, maxT, maxR, minB
      Dim wMm, hMm, fator, wTxt, hTxt, rotulo, lyr, found, lyrTexto, edAntes, txt, gapMm
      Set app = ObterCorel(False)
      If app Is Nothing Or app.Documents.Count = 0 Then
        CorelTextoDimensoes = "ERRO: Abra um documento no CorelDRAW primeiro."
        Exit Function
      End If
      Set doc = app.ActiveDocument
      If doc.SelectionRange.Count = 0 Then
        CorelTextoDimensoes = "ERRO: Selecione pelo menos um objeto no CorelDRAW."
        Exit Function
      End If

      origUnit = doc.Unit: origRef = doc.ReferencePoint
      doc.Unit = CDR_MM: doc.ReferencePoint = CDR_CENTER
      doc.BeginCommandGroup "IBD: Texto com dimensoes"

      Set sr = doc.SelectionRange
      minL = 1E+30: maxT = -1E+30: maxR = -1E+30: minB = 1E+30
      For Each s In sr
        s.GetBoundingBox lx, by, sw, sh, CBool(incluirTracado)
        If lx < minL Then minL = lx
        If by < minB Then minB = by
        If (lx + sw) > maxR Then maxR = lx + sw
        If (by + sh) > maxT Then maxT = by + sh
      Next

      wMm = maxR - minL: hMm = maxT - minB
      Select Case LCase(unidade)
        Case "cm": fator = 10
        Case "m":  fator = 1000
        Case "in": fator = 25.4
        Case "pt": fator = 25.4 / 72
        Case "px": fator = 25.4 / 96
        Case Else: fator = 1
      End Select
      wTxt = Replace(FormatNumber(wMm / fator, CInt(decimais), -1, 0, 0), ".", ",")
      hTxt = Replace(FormatNumber(hMm / fator, CInt(decimais), -1, 0, 0), ".", ",")
      rotulo = wTxt & " x " & hTxt & " " & unidade

      If Trim(nomeCamada) = "" Then nomeCamada = "01_TEXTOS"
      Set lyrTexto = Nothing
      For Each lyr In doc.ActivePage.Layers
        If StrComp(lyr.Name, nomeCamada, 1) = 0 Then
          Set lyrTexto = lyr
          Exit For
        End If
      Next
      If lyrTexto Is Nothing Then Set lyrTexto = doc.ActivePage.CreateLayer(nomeCamada)

      edAntes = lyrTexto.Editable
      lyrTexto.Visible = True: lyrTexto.Editable = True
      gapMm = 3
      Set txt = lyrTexto.CreateArtisticText((minL + maxR) / 2, minB - gapMm, rotulo, , , "Arial", CSng(tamanhoPt), CDR_FALSE, CDR_FALSE, , CDR_ALIGN_CENTER)
      If Not txt Is Nothing Then
        If txt.Fill.Type = CDR_NO_FILL Then txt.Fill.ApplyUniformFill app.CreateCMYKColor(0, 0, 0, 100)
        txt.CenterX = (minL + maxR) / 2
        If LCase(posicao) = "acima" Then
          txt.BottomY = maxT + gapMm
        ElseIf LCase(posicao) = "centro" Then
          txt.CenterY = (minB + maxT) / 2
        Else
          txt.TopY = minB - gapMm
        End If
      End If
      lyrTexto.Editable = edAntes

      Dim errDesc: errDesc = Err.Description
      doc.EndCommandGroup
      doc.ReferencePoint = origRef: doc.Unit = origUnit
      If Len(errDesc) > 0 And (txt Is Nothing) Then
        CorelTextoDimensoes = "ERRO: " & errDesc
      Else
        CorelTextoDimensoes = "OK:Cota criada: " & rotulo
      End If
    End Function

    Sub ConfigurarSepVbs(rng, idOrig, strokeMm, cor, cantoTraco, destino)
      On Error Resume Next
      Dim item, subRng
      For Each item In rng
        If item.StaticID <> idOrig Then
          If item.Type = CDR_SHAPE_GROUP Then
            Set subRng = item.UngroupEx
            ConfigurarSepVbs subRng, idOrig, strokeMm, cor, cantoTraco, destino
          Else
            If item.CanHaveFill Then item.Fill.ApplyNoFill
            If item.CanHaveOutline Then
              Err.Clear
              item.Outline.SetProperties strokeMm, , cor, , , , , CDR_FALSE, CDR_FALSE, , CDR_OUTLINE_ROUND_CAP, cantoTraco, 4
              If Err.Number <> 0 Then
                Err.Clear
                item.Outline.SetProperties strokeMm, , cor
              End If
            End If
            destino.Add item
          End If
        End If
      Next
    End Sub

    Function CorelDeslocarContorno(offsetMm, canto, strokePt, cC, cM, cY, cK, manterOrig, unificar)
      On Error Resume Next
      Dim app, doc, origUnit, srOrig, srAlvos, outShapes, colContorno, colDummy
      Dim direcao, cantoContorno, cantoTraco, strokeMm, s, eff, sepRange, unif, dupRange, idxW, gerados
      Set app = ObterCorel(False)
      If app Is Nothing Or app.Documents.Count = 0 Then
        CorelDeslocarContorno = "ERRO: Abra um documento no CorelDRAW primeiro."
        Exit Function
      End If
      Set doc = app.ActiveDocument
      If doc.SelectionRange.Count = 0 Then
        CorelDeslocarContorno = "ERRO: Selecione pelo menos um objeto vetorial."
        Exit Function
      End If
      If CDbl(offsetMm) = 0 Then CorelDeslocarContorno = "ERRO: Informe deslocamento diferente de zero.": Exit Function

      If CDbl(offsetMm) > 0 Then direcao = CDR_CONTOUR_OUTSIDE Else direcao = CDR_CONTOUR_INSIDE
      Select Case UCase(canto)
        Case "R": cantoContorno = CDR_CORNER_ROUND: cantoTraco = CDR_OUTLINE_ROUND
        Case "C": cantoContorno = CDR_CORNER_BEVEL: cantoTraco = CDR_OUTLINE_BEVEL
        Case Else: cantoContorno = CDR_CORNER_MITER: cantoTraco = CDR_OUTLINE_MITER
      End Select

      origUnit = doc.Unit
      doc.Unit = CDR_MM
      strokeMm = app.ConvertUnits(CDbl(strokePt), CDR_PT, CDR_MM)
      doc.BeginCommandGroup "IBD: Deslocamento + Contorno"

      Set srOrig = doc.SelectionRange
      Set outShapes = app.CreateShapeRange
      Set colContorno = app.CreateCMYKColor(CLng(cC), CLng(cM), CLng(cY), CLng(cK))
      Set colDummy = app.CreateCMYKColor(CLng(cC), CLng(cM), CLng(cY), CLng(cK))
      Set srAlvos = app.CreateShapeRange
      Set unif = Nothing

      If CBool(unificar) And srOrig.Count > 1 Then
        Err.Clear
        Set unif = srOrig.CreateBoundary(0, 0, True, False)
        If Err.Number <> 0 Or (unif Is Nothing) Then
          Err.Clear
          Set dupRange = srOrig.Duplicate(0, 0)
          Set unif = dupRange(1)
          For idxW = 2 To dupRange.Count
            Set unif = unif.Weld(dupRange(idxW))
          Next
        End If
        If Not (unif Is Nothing) Then srAlvos.Add unif
      End If
      If srAlvos.Count = 0 Then
        For Each s In srOrig
          srAlvos.Add s
        Next
      End If

      gerados = 0
      For Each s In srAlvos
        Err.Clear
        Set eff = s.CreateContour(direcao, Abs(CDbl(offsetMm)), 1, CDR_BLEND_DIRECT, colDummy, colDummy, , 0, 0, CDR_CAP_SQUARE, cantoContorno, 4)
        If Err.Number <> 0 Or (eff Is Nothing) Then
          Err.Clear
          Set eff = s.CreateContour(direcao, Abs(CDbl(offsetMm)), 1, CDR_BLEND_DIRECT, colDummy, colDummy)
        End If
        If Not (eff Is Nothing) Then
          Set sepRange = eff.Separate
          If Not (sepRange Is Nothing) Then
            ConfigurarSepVbs sepRange, s.StaticID, strokeMm, colContorno, cantoTraco, outShapes
            gerados = gerados + 1
          End If
        End If
      Next

      If Not (unif Is Nothing) Then unif.Delete
      If (Not CBool(manterOrig)) And gerados > 0 Then srOrig.Delete
      doc.ClearSelection
      If outShapes.Count > 0 Then outShapes.AddToSelection

      doc.EndCommandGroup
      doc.Unit = origUnit
      If outShapes.Count = 0 Then
        CorelDeslocarContorno = "ERRO: Nenhum contorno gerado (verifique se o objeto e vetorial)."
      Else
        CorelDeslocarContorno = "OK:" & outShapes.Count & " contorno(s) deslocado(s) gerado(s)."
      End If
    End Function
  </script>

  <script>
${iconesJs}
  </script>

  <script>
  (function () {
    var TOOLS = ${JSON.stringify(toolsCorel)};
    var PAPEIS = ${JSON.stringify(PAPEIS_COREL)};
    var PECAS = ${JSON.stringify(PECAS_COREL)};
    var icones = window.IBDIcones || { resolverIconeId: function () { return 'acao'; }, iconeSvg: function () { return ''; } };

    var prefs = { favoritos: [], ocultas: [], modoVis: 'grade', dock: 'R' };
    try {
      var raw = window.CorelPrefsLer ? window.CorelPrefsLer() : '{}';
      var parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object') {
        if (parsed.favoritos && parsed.favoritos.length !== undefined) prefs.favoritos = parsed.favoritos;
        if (parsed.ocultas && parsed.ocultas.length !== undefined) prefs.ocultas = parsed.ocultas;
        if (parsed.modoVis === 'grade' || parsed.modoVis === 'lista') prefs.modoVis = parsed.modoVis;
        if (parsed.dock === 'L' || parsed.dock === 'R') prefs.dock = parsed.dock;
      }
    } catch (e) {}

    var abaAtiva = 'todos';
    var gerenciando = false;
    var ferramentaAberta = null;

    var elLista = document.getElementById('lista');
    var elFiltro = document.getElementById('filtro');
    var elStatus = document.getElementById('status');
    var elRodape = document.getElementById('rodape');
    var elConn = document.getElementById('corel-conn');
    var elFavContador = document.getElementById('fav-contador');
    var elOcultasBadge = document.getElementById('ocultas-badge');
    var btnGrade = document.getElementById('modo-grade');
    var btnLista = document.getElementById('modo-lista');
    var btnGerenciar = document.getElementById('btn-gerenciar');
    var elAbas = document.getElementById('abas');

    try { window.resizeTo(318, 660); } catch (eSz) {}

    function salvarPrefs() {
      try { if (window.CorelPrefsSalvar) window.CorelPrefsSalvar(JSON.stringify(prefs)); } catch (e) {}
    }
    function idxOf(arr, v) {
      for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
      return -1;
    }
    function ehFav(id) { return idxOf(prefs.favoritos, id) > -1; }
    function ehOculta(id) { return idxOf(prefs.ocultas, id) > -1; }
    function alternarFav(id) {
      var i = idxOf(prefs.favoritos, id);
      if (i > -1) prefs.favoritos.splice(i, 1);
      else prefs.favoritos.push(id);
      salvarPrefs();
      render();
    }
    function definirOculta(id, esconder) {
      var i = idxOf(prefs.ocultas, id);
      if (esconder && i === -1) prefs.ocultas.push(id);
      else if (!esconder && i > -1) prefs.ocultas.splice(i, 1);
      salvarPrefs();
      render();
    }
    function status(msg, tipo) {
      elStatus.innerText = msg;
      elRodape.className = 'rodape' + (tipo ? ' ' + tipo : '');
    }
    var ponteIndisponivel = 'A ponte VBScript do painel esta indisponivel no Windows.';
    function atualizarConexao() {
      try { elConn.innerText = window.CorelStatusConexao(); } catch (e) { elConn.innerText = ponteIndisponivel; }
    }
    function encaixarPainel(lado) {
      var erro;
      try { erro = window.CorelEncaixarJanela(lado === 'L' ? 'L' : 'R'); }
      catch (e) { erro = ponteIndisponivel; }
      if (erro) status(erro, 'erro');
    }
    function executarNoCorel(acao) {
      var resposta;
      try { resposta = acao(); }
      catch (e) { resposta = 'ERRO:' + ponteIndisponivel; }
      tratarRetorno(resposta);
    }
    function tituloCurto(t) {
      return String(t || '').replace(/\\s*\\([^)]*\\)/g, '').replace(/^\\s+|\\s+$/g, '');
    }
    function num(v, def) {
      var n = parseFloat(String(v || '').replace(',', '.'));
      return isNaN(n) ? def : n;
    }
    function tratarRetorno(res) {
      var s = String(res || '');
      if (s.indexOf('ERRO:') === 0) status(s.slice(5), 'erro');
      else if (s.indexOf('OK:') === 0) status(s.slice(3), 'sucesso');
      else status(s || 'Concluido.', 'sucesso');
      atualizarConexao();
    }

    function filtrar(incluirOcultas) {
      var termo = elFiltro.value.replace(/^\\s+|\\s+$/g, '').toLowerCase();
      var out = [];
      for (var i = 0; i < TOOLS.length; i++) {
        var f = TOOLS[i];
        if (!incluirOcultas && ehOculta(f.id)) continue;
        if (!incluirOcultas && abaAtiva === 'favoritos' && !ehFav(f.id)) continue;
        if (termo) {
          var hay = (f.titulo + ' ' + f.descricao + ' ' + f.tags.join(' ')).toLowerCase();
          if (hay.indexOf(termo) === -1) continue;
        }
        out.push(f);
      }
      return out;
    }

    function criarEstrela(f) {
      var ativo = ehFav(f.id);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn' + (ativo ? ' ativo' : '');
      b.innerText = ativo ? '★' : '☆';
      b.title = ativo ? 'Remover dos favoritos' : 'Favoritar';
      b.onclick = function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (window.event) window.event.cancelBubble = true;
        alternarFav(f.id);
      };
      return b;
    }

    function renderFormulario(f) {
      elLista.className = 'lista modo-lista';
      elLista.innerHTML = '';
      var box = document.createElement('div');
      box.className = 'form-box';

      var topo = document.createElement('div');
      topo.className = 'form-topo';
      var tit = document.createElement('span');
      tit.className = 'form-titulo';
      tit.innerText = f.titulo;
      var btnVoltar = document.createElement('button');
      btnVoltar.type = 'button';
      btnVoltar.className = 'btn-acao';
      btnVoltar.innerText = '← Voltar';
      btnVoltar.onclick = function () { ferramentaAberta = null; render(); };
      topo.appendChild(tit);
      topo.appendChild(btnVoltar);
      box.appendChild(topo);

      var corpo = document.createElement('div');
      box.appendChild(corpo);
      elLista.appendChild(box);

      if (f.slug === 'criar-papel-padrao' || f.slug === 'criar-peca-padrao') {
        var ehPapel = f.slug === 'criar-papel-padrao';
        var listaFmt = ehPapel ? PAPEIS : PECAS;
        var atalhos = ehPapel
          ? [0, 1, 2, 3, 7, 8]
          : [0, 1, 3, 4, 6, 7];

        var optsHtml = '';
        for (var i = 0; i < listaFmt.length; i++) {
          optsHtml += '<option value="' + i + '">' + listaFmt[i].rotulo + '</option>';
        }
        var chipsHtml = '';
        for (var c = 0; c < atalhos.length; c++) {
          var idxA = atalhos[c];
          chipsHtml += '<button type="button" class="chip" data-idx="' + idxA + '">' + listaFmt[idxA].curto + '</button>';
        }

        var modoHtml = '<option value="D">Novo documento</option>' +
          '<option value="P">Nova pagina no documento aberto</option>' +
          '<option value="R">Redimensionar pagina ativa</option>' +
          (ehPapel ? '' : '<option value="M">Desenhar molde na pagina ativa</option>');

        corpo.innerHTML =
          '<div class="campo"><label>' + (ehPapel ? 'Papel padrao (Nobel primeiro + ISO/graficos)' : 'Peca grafica padrao') + '</label>' +
          '<select id="f-fmt">' + optsHtml + '</select>' +
          '<div class="chips" id="f-chips">' + chipsHtml + '</div></div>' +
          '<div class="campo"><label>Onde criar</label><select id="f-modo">' + modoHtml + '</select></div>' +
          '<div class="campo"><label>Orientacao</label><select id="f-ori"><option value="">Padrao do formato</option><option value="V">Retrato (vertical)</option><option value="H">Paisagem (horizontal)</option></select></div>' +
          '<div class="campo-linha">' +
          '<div class="campo"><label>Margem seg. (mm)</label><input id="f-margem" type="text" value="5" /></div>' +
          '<div class="campo"><label>Sangria (mm)</label><input id="f-sangria" type="text" value="' + (ehPapel ? '0' : '3') + '" /></div>' +
          '</div>' +
          '<div class="form-rodape"><button type="button" class="btn-acao" id="f-cancel">Voltar</button><button type="button" class="btn-acao btn-primario" id="f-ok">' + (ehPapel ? 'Criar papel' : 'Criar peca') + '</button></div>';

        var selFmt = document.getElementById('f-fmt');
        selFmt.selectedIndex = ehPapel ? 2 : 0;
        var chipsBox = document.getElementById('f-chips');
        chipsBox.onclick = function (ev) {
          var t = (ev && ev.target) || (window.event && window.event.srcElement);
          if (t && t.getAttribute && t.getAttribute('data-idx') !== null) {
            selFmt.selectedIndex = parseInt(t.getAttribute('data-idx'), 10);
          }
        };
        document.getElementById('f-cancel').onclick = function () { ferramentaAberta = null; render(); };
        document.getElementById('f-ok').onclick = function () {
          var item = listaFmt[selFmt.selectedIndex] || listaFmt[0];
          var modo = document.getElementById('f-modo').value;
          var ori = document.getElementById('f-ori').value;
          var m = Math.max(0, num(document.getElementById('f-margem').value, 0));
          var s = Math.max(0, num(document.getElementById('f-sangria').value, 0));
          executarNoCorel(function () {
            return ehPapel
              ? window.CorelCriarPapel(item.curto, item.w, item.h, ori, modo, m, s)
              : window.CorelCriarPeca(item.curto, item.w, item.h, ori, modo, m, s);
          });
        };
        return;
      }

      if (f.slug === 'margem-seguranca-guias') {
        corpo.innerHTML =
          '<div class="campo-linha">' +
          '<div class="campo"><label>Margem interna</label><input id="f-val" type="text" value="5" /></div>' +
          '<div class="campo"><label>Unidade</label><select id="f-un"><option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option><option value="pt">pt</option><option value="px">px</option></select></div>' +
          '</div>' +
          '<div class="campo"><div class="chips" id="f-chips">' +
          '<button type="button" class="chip" data-v="3">3</button>' +
          '<button type="button" class="chip" data-v="5">5</button>' +
          '<button type="button" class="chip" data-v="10">10</button>' +
          '<button type="button" class="chip" data-v="15">15</button>' +
          '<button type="button" class="chip" data-v="20">20</button>' +
          '</div></div>' +
          '<label class="chk-linha"><input type="checkbox" id="f-todas" />Aplicar em todas as paginas</label>' +
          '<div class="form-rodape"><button type="button" class="btn-acao" id="f-cancel">Voltar</button><button type="button" class="btn-acao btn-primario" id="f-ok">Criar guias</button></div>';

        document.getElementById('f-chips').onclick = function (ev) {
          var t = (ev && ev.target) || (window.event && window.event.srcElement);
          if (t && t.getAttribute && t.getAttribute('data-v')) document.getElementById('f-val').value = t.getAttribute('data-v');
        };
        document.getElementById('f-cancel').onclick = function () { ferramentaAberta = null; render(); };
        document.getElementById('f-ok').onclick = function () {
          var v = num(document.getElementById('f-val').value, 0);
          var u = document.getElementById('f-un').value;
          var fat = u === 'cm' ? 10 : (u === 'in' ? 25.4 : (u === 'pt' ? 25.4 / 72 : (u === 'px' ? 25.4 / 96 : 1)));
          executarNoCorel(function () {
            return window.CorelMargemSeguranca(v * fat, document.getElementById('f-todas').checked);
          });
        };
        return;
      }

      if (f.slug === 'texto-dimensoes-objeto') {
        corpo.innerHTML =
          '<div class="campo-linha">' +
          '<div class="campo"><label>Unidade</label><select id="f-un"><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="px">px</option><option value="in">in</option><option value="pt">pt</option></select></div>' +
          '<div class="campo"><label>Decimais</label><select id="f-dec"><option value="0">0</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option></select></div>' +
          '</div>' +
          '<div class="campo-linha">' +
          '<div class="campo"><label>Posicao</label><select id="f-pos"><option value="abaixo">Abaixo</option><option value="acima">Acima</option><option value="centro">Centro</option></select></div>' +
          '<div class="campo"><label>Fonte (pt)</label><input id="f-pt" type="text" value="10" /></div>' +
          '</div>' +
          '<div class="campo"><label>Camada destino</label><input id="f-camada" type="text" value="01_TEXTOS" /></div>' +
          '<label class="chk-linha"><input type="checkbox" id="f-traco" checked />Incluir espessura do contorno</label>' +
          '<div class="form-rodape"><button type="button" class="btn-acao" id="f-cancel">Voltar</button><button type="button" class="btn-acao btn-primario" id="f-ok">Criar cota</button></div>';

        document.getElementById('f-cancel').onclick = function () { ferramentaAberta = null; render(); };
        document.getElementById('f-ok').onclick = function () {
          executarNoCorel(function () {
            return window.CorelTextoDimensoes(
              document.getElementById('f-un').value,
              parseInt(document.getElementById('f-dec').value, 10),
              document.getElementById('f-pos').value,
              num(document.getElementById('f-pt').value, 10),
              document.getElementById('f-traco').checked,
              document.getElementById('f-camada').value
            );
          });
        };
        return;
      }

      if (f.slug === 'deslocamento-expandir-contorno') {
        corpo.innerHTML =
          '<div class="campo-linha">' +
          '<div class="campo"><label>Deslocamento (mm)</label><input id="f-off" type="text" value="2" /></div>' +
          '<div class="campo"><label>Espessura (pt)</label><input id="f-pt" type="text" value="1" /></div>' +
          '</div>' +
          '<div class="campo"><div class="chips" id="f-chips">' +
          '<button type="button" class="chip" data-v="-3">-3</button>' +
          '<button type="button" class="chip" data-v="-2">-2</button>' +
          '<button type="button" class="chip" data-v="2">+2</button>' +
          '<button type="button" class="chip" data-v="3">+3</button>' +
          '<button type="button" class="chip" data-v="5">+5</button>' +
          '</div></div>' +
          '<div class="campo-linha">' +
          '<div class="campo"><label>Cantos</label><select id="f-canto"><option value="M">Mitra (reto)</option><option value="R">Arredondado</option><option value="C">Chanfrado</option></select></div>' +
          '<div class="campo"><label>Cor CMYK</label><select id="f-cor"><option value="0,100,0,0">Magenta corte</option><option value="0,100,100,0">Vermelho</option><option value="100,0,0,0">Ciano</option><option value="0,0,0,100">Preto</option></select></div>' +
          '</div>' +
          '<label class="chk-linha"><input type="checkbox" id="f-manter" checked />Manter objeto original</label>' +
          '<label class="chk-linha"><input type="checkbox" id="f-unificar" />Unificar selecao (Boundary/Weld)</label>' +
          '<div class="form-rodape"><button type="button" class="btn-acao" id="f-cancel">Voltar</button><button type="button" class="btn-acao btn-primario" id="f-ok">Gerar contorno</button></div>';

        document.getElementById('f-chips').onclick = function (ev) {
          var t = (ev && ev.target) || (window.event && window.event.srcElement);
          if (t && t.getAttribute && t.getAttribute('data-v')) document.getElementById('f-off').value = t.getAttribute('data-v');
        };
        document.getElementById('f-cancel').onclick = function () { ferramentaAberta = null; render(); };
        document.getElementById('f-ok').onclick = function () {
          var corParts = document.getElementById('f-cor').value.split(',');
          executarNoCorel(function () {
            return window.CorelDeslocarContorno(
              num(document.getElementById('f-off').value, 2),
              document.getElementById('f-canto').value,
              num(document.getElementById('f-pt').value, 1),
              parseInt(corParts[0], 10), parseInt(corParts[1], 10), parseInt(corParts[2], 10), parseInt(corParts[3], 10),
              document.getElementById('f-manter').checked,
              document.getElementById('f-unificar').checked
            );
          });
        };
        return;
      }

      corpo.innerHTML = '<div class="vazio">Ferramenta disponivel via macro VBA no CorelDRAW.</div>';
    }

    function renderGerenciar() {
      elLista.className = 'lista modo-lista';
      elLista.innerHTML = '';
      var todas = filtrar(true);

      var barra = document.createElement('div');
      barra.className = 'gerenciar-barra';
      var visCount = 0;
      for (var k = 0; k < todas.length; k++) if (!ehOculta(todas[k].id)) visCount++;
      var info = document.createElement('span');
      info.className = 'gerenciar-info';
      info.innerText = visCount + ' de ' + todas.length + ' visiveis';
      barra.appendChild(info);

      var acoes = document.createElement('div');
      var bTodas = document.createElement('button');
      bTodas.type = 'button';
      bTodas.className = 'btn-acao';
      bTodas.style.marginRight = '4px';
      bTodas.innerText = 'Mostrar todas';
      bTodas.onclick = function () { prefs.ocultas = []; salvarPrefs(); status('Todas as funcoes estao visiveis.', 'sucesso'); render(); };
      acoes.appendChild(bTodas);

      var bOk = document.createElement('button');
      bOk.type = 'button';
      bOk.className = 'btn-acao btn-primario';
      bOk.innerText = 'Concluir';
      bOk.onclick = function () { gerenciando = false; render(); };
      acoes.appendChild(bOk);
      barra.appendChild(acoes);
      elLista.appendChild(barra);

      for (var i = 0; i < todas.length; i++) {
        (function (f) {
          var oculta = ehOculta(f.id);
          var row = document.createElement('div');
          row.className = 'gerenciar-item' + (oculta ? ' oculta' : '');
          var chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.checked = !oculta;
          chk.onclick = function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            if (window.event) window.event.cancelBubble = true;
            definirOculta(f.id, !chk.checked);
          };
          row.appendChild(chk);

          var badge = document.createElement('span');
          badge.className = 'icone-badge pequeno';
          badge.innerHTML = icones.iconeSvg(f.icone, null, 16);
          row.appendChild(badge);

          var nm = document.createElement('span');
          nm.className = 'gerenciar-nome';
          nm.innerText = f.titulo;
          row.appendChild(nm);

          var st = document.createElement('span');
          st.className = 'gerenciar-estado';
          st.innerText = oculta ? 'Oculta' : 'Visivel';
          row.appendChild(st);

          row.onclick = function () { definirOculta(f.id, !oculta); };
          elLista.appendChild(row);
        })(todas[i]);
      }
    }

    function render() {
      var ocultasCount = 0;
      var favCount = 0;
      for (var i = 0; i < TOOLS.length; i++) {
        if (ehOculta(TOOLS[i].id)) ocultasCount++;
        else if (ehFav(TOOLS[i].id)) favCount++;
      }
      elFavContador.innerText = String(favCount);
      elOcultasBadge.innerText = String(ocultasCount);
      elOcultasBadge.style.display = ocultasCount > 0 ? 'inline-block' : 'none';

      btnGrade.className = 'modo-btn' + (!gerenciando && !ferramentaAberta && prefs.modoVis === 'grade' ? ' ativo' : '');
      btnLista.className = 'modo-btn' + (!gerenciando && !ferramentaAberta && prefs.modoVis === 'lista' ? ' ativo' : '');
      btnGerenciar.className = 'modo-btn' + (gerenciando ? ' ativo' : '');

      var abas = elAbas.getElementsByTagName('button');
      for (var a = 0; a < abas.length; a++) {
        abas[a].className = 'aba' + (!gerenciando && !ferramentaAberta && abas[a].getAttribute('data-aba') === abaAtiva ? ' ativo' : '');
      }

      if (ferramentaAberta) {
        renderFormulario(ferramentaAberta);
        return;
      }
      if (gerenciando) {
        renderGerenciar();
        return;
      }

      var visiveis = filtrar(false);
      elLista.className = 'lista ' + (prefs.modoVis === 'grade' ? 'modo-grade' : 'modo-lista');
      elLista.innerHTML = '';

      if (!visiveis.length) {
        var vz = document.createElement('div');
        vz.className = 'vazio';
        vz.innerText = ocultasCount > 0
          ? 'Nenhuma ferramenta visivel (' + ocultasCount + ' oculta(s)).'
          : 'Nenhuma ferramenta encontrada.';
        if (ocultasCount > 0) {
          var br = document.createElement('br');
          var bRe = document.createElement('button');
          bRe.type = 'button';
          bRe.className = 'btn-acao';
          bRe.style.marginTop = '10px';
          bRe.innerText = 'Gerenciar funcoes ocultas';
          bRe.onclick = function () { gerenciando = true; render(); };
          vz.appendChild(br);
          vz.appendChild(bRe);
        }
        elLista.appendChild(vz);
        return;
      }

      var cont = elLista;
      if (prefs.modoVis === 'grade') {
        cont = document.createElement('div');
        cont.className = 'grade-wrap';
        elLista.appendChild(cont);
      }

      for (var j = 0; j < visiveis.length; j++) {
        (function (f) {
          if (prefs.modoVis === 'grade') {
            var tile = document.createElement('div');
            tile.className = 'tile';
            tile.title = f.titulo + ' — ' + f.descricao;
            var topo = document.createElement('div');
            topo.className = 'tile-topo';
            var badge = document.createElement('span');
            badge.className = 'icone-badge';
            badge.innerHTML = icones.iconeSvg(f.icone, null, 22);
            topo.appendChild(badge);
            topo.appendChild(criarEstrela(f));
            tile.appendChild(topo);
            var nm = document.createElement('div');
            nm.className = 'tile-titulo';
            nm.innerText = tituloCurto(f.titulo);
            tile.appendChild(nm);
            var pe = document.createElement('div');
            pe.className = 'tile-pe';
            pe.innerText = 'CDR';
            tile.appendChild(pe);
            tile.onclick = function () { ferramentaAberta = f; render(); };
            cont.appendChild(tile);
          } else {
            var card = document.createElement('div');
            card.className = 'cartao';
            var cab = document.createElement('div');
            cab.className = 'cartao-cab';
            var badgeP = document.createElement('span');
            badgeP.className = 'icone-badge pequeno';
            badgeP.innerHTML = icones.iconeSvg(f.icone, null, 18);
            cab.appendChild(badgeP);
            var tit = document.createElement('div');
            tit.className = 'cartao-titulo';
            tit.innerText = f.titulo;
            cab.appendChild(tit);
            cab.appendChild(criarEstrela(f));
            card.appendChild(cab);
            var desc = document.createElement('div');
            desc.className = 'cartao-descricao';
            desc.innerText = f.descricao;
            card.appendChild(desc);
            var ac = document.createElement('div');
            ac.className = 'cartao-acoes';
            var bEx = document.createElement('button');
            bEx.type = 'button';
            bEx.className = 'btn-acao';
            bEx.innerText = 'Abrir';
            bEx.onclick = function () { ferramentaAberta = f; render(); };
            ac.appendChild(bEx);
            card.appendChild(ac);
            cont.appendChild(card);
          }
        })(visiveis[j]);
      }
    }

    elFiltro.onkeyup = render;
    btnGrade.onclick = function () { gerenciando = false; ferramentaAberta = null; prefs.modoVis = 'grade'; salvarPrefs(); render(); };
    btnLista.onclick = function () { gerenciando = false; ferramentaAberta = null; prefs.modoVis = 'lista'; salvarPrefs(); render(); };
    btnGerenciar.onclick = function () { ferramentaAberta = null; gerenciando = !gerenciando; render(); };
    elAbas.onclick = function (ev) {
      var t = (ev && ev.target) || (window.event && window.event.srcElement);
      while (t && t !== elAbas && !(t.getAttribute && t.getAttribute('data-aba'))) t = t.parentNode;
      if (t && t.getAttribute && t.getAttribute('data-aba')) {
        gerenciando = false;
        ferramentaAberta = null;
        abaAtiva = t.getAttribute('data-aba');
        render();
      }
    };
    document.getElementById('btn-dock-l').onclick = function () { prefs.dock = 'L'; salvarPrefs(); encaixarPainel(prefs.dock); };
    document.getElementById('btn-dock-r').onclick = function () { prefs.dock = 'R'; salvarPrefs(); encaixarPainel(prefs.dock); };
    document.getElementById('btn-reconectar').onclick = function () { atualizarConexao(); encaixarPainel(prefs.dock); };

    render();
    atualizarConexao();
    setTimeout(function () { encaixarPainel(prefs.dock); }, 350);
  }());
  </script>
</body>
</html>
`;

  return '\uFEFF' + paraCrlf(html);
}
