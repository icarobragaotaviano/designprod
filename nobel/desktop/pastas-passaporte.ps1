param(
    [string]$Raiz = (Read-Host 'Pasta raiz existente'),
    [ValidateSet('OS','Estudio')][string]$Perfil = 'OS',
    [string]$Passaporte = '',
    [string]$Cliente = '',
    [string]$Projeto = '',
    [string]$Referencia = '',
    [string]$MesAno = (Get-Date -Format 'MMyy')
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $Raiz -PathType Container)) { throw 'Escolha uma raiz existente.' }
function Segmento([string]$valor) {
    $valido = ($valor -replace '[\x00-\x1F\\/:*?"<>|]','_').Trim().TrimEnd([char[]]'. ')
    if (!$valido -or $valido -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') { throw 'Nome de pasta invalido.' }
    if ($valido.Length -gt 45) { return $valido.Substring(0,45).TrimEnd([char[]]'. ') }
    return $valido
}
function CriarArquivoNovo([string]$caminho,[string]$texto) {
    $a = [IO.File]::Open($caminho,[IO.FileMode]::CreateNew)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($texto)
        $a.Write($bytes,0,$bytes.Length)
    } finally { $a.Dispose() }
}
if ($Perfil -eq 'OS') {
    if (!$Passaporte) { $Passaporte = Read-Host 'Caminho do passaporte JSON exportado pelo DesignProd' }
    $d = Get-Content -LiteralPath $Passaporte -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($d.versao -ne 1 -or !$d.ficha.OS -or !$d.ficha.Cliente -or !$d.ficha.Produto) { throw 'Passaporte sem OS, cliente ou produto.' }
    $nome = 'OS' + (Segmento $d.ficha.OS) + '_' + (Segmento $d.ficha.Cliente) + '_' + (Segmento $d.ficha.Produto)
    $pasta = Join-Path $Raiz $nome
    foreach ($sub in '01_Recebido_Cliente','02_Editavel_Corel','03_PDF_Fechado','04_Imposicao_Preps','05_Corte_PLT') {
        [void][IO.Directory]::CreateDirectory((Join-Path $pasta $sub))
    }
    $tab = foreach ($p in $d.ficha.PSObject.Properties) {
        '<dt>' + [Net.WebUtility]::HtmlEncode($p.Name) + '</dt><dd>' + [Net.WebUtility]::HtmlEncode([string]$p.Value) + '</dd>'
    }
    $html = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Passaporte OS</title><h1>Passaporte OS</h1><dl>' + ($tab -join '') + '</dl></html>'
    $arquivo = Join-Path $pasta 'PASSAPORTE_OS.html'
    if (!(Test-Path -LiteralPath $arquivo)) { CriarArquivoNovo $arquivo $html }
} else {
    if (!$Cliente) { $Cliente = Read-Host 'Sigla do cliente' }
    if (!$Projeto) { $Projeto = Read-Host 'Referencia curta do projeto' }
    if (!$Referencia) { $Referencia = Read-Host 'Referencia interna para os arquivos' }
    if ($MesAno -notmatch '^(0[1-9]|1[0-2])\d{2}$') { throw 'Use MMAA no campo MesAno.' }
    $prefixo = (Segmento $Cliente) + ' ' + $MesAno
    $pasta = Join-Path $Raiz ($prefixo + ' ' + (Segmento $Projeto))
    $ref = $prefixo + ' ' + (Segmento $Referencia)
    $estruturas = [ordered]@{
        "$ref - Editaveis" = 'af','psd','ai','aep','prproj'
        "$ref - Arquivos Finais" = 'png','mp4','pdf','svg'
        "$ref - Midias do Cliente" = @()
        "$ref - Midias de Referencia" = @()
        "Assets\$ref - Imagens" = 'png','svg'
        "Assets\$ref - Audio" = 'mp3'
        "Assets\$ref - Video" = 'mp4'
        "Assets\$ref - Notas" = 'md'
    }
    foreach ($sub in $estruturas.Keys) {
        $diretorio = Join-Path $pasta $sub
        [void][IO.Directory]::CreateDirectory($diretorio)
        foreach ($ext in $estruturas[$sub]) {
            $placeholder = Join-Path $diretorio ($ref + '.' + $ext + '.placeholder.txt')
            if (!(Test-Path -LiteralPath $placeholder)) { CriarArquivoNovo $placeholder 'Espaco reservado. Salve o arquivo real com o nome indicado.' }
        }
    }
}
Write-Output $pasta
