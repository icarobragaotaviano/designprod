param(
  [Parameter(Mandatory=$true)][string]$Pasta,
  [string]$Cli = 'photocraft-cli',
  [string]$Saida = 'inspecao-psd.json'
)
$ErrorActionPreference = 'Stop'
$arquivos = @(Get-ChildItem -LiteralPath $Pasta -File -Filter '*.psd')
if (!$arquivos.Count) { throw 'Nenhum PSD na pasta.' }
$resultados = foreach ($arquivo in $arquivos) {
  $dados = & $Cli info --compact $arquivo.FullName
  if ($LASTEXITCODE) { [pscustomobject]@{ arquivo=$arquivo.Name; erro="Codigo $LASTEXITCODE" }; continue }
  [pscustomobject]@{ arquivo=$arquivo.Name; dados=(($dados -join [Environment]::NewLine) | ConvertFrom-Json) }
}
if (Test-Path -LiteralPath $Saida) { throw 'Escolha outro nome para preservar o relatorio existente.' }
ConvertTo-Json -InputObject @($resultados) -Depth 30 | Out-File -LiteralPath $Saida -Encoding utf8
