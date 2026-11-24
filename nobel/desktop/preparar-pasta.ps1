param(
  [string]$OS = (Read-Host 'OS (0000-000000)'),
  [string]$Raiz = 'Q:\0 - 2019\0 - OS SITE',
  [switch]$Abrir
)
$ErrorActionPreference = 'Stop'
if ($OS -notmatch '^(\d{4})-(\d{6})$') { throw 'Formato esperado: 0000-000000.' }
$cliente = $Matches[1]
$pedido = [int]$Matches[2]
if ($pedido -lt 1) { throw 'Pedido zero.' }
if (!(Test-Path -LiteralPath $Raiz -PathType Container)) { throw "Raiz indisponivel: $Raiz" }
$pasta = Join-Path (Join-Path $Raiz $cliente) "Pedido $pedido"
foreach ($sub in '01_Recebido_Cliente','02_Editavel_Corel','03_PDF_Fechado','04_Imposicao_Preps','05_Corte_PLT') {
  [void][System.IO.Directory]::CreateDirectory((Join-Path $pasta $sub))
}
Write-Output $pasta
if ($Abrir) { Invoke-Item -LiteralPath $pasta }
