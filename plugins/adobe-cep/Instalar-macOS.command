#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.ibd.cep.ferramentas"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$DIR" "$DEST"
for v in 8 9 10 11 12 13 14 15 16; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done
echo "IBD Ferramentas (CEP) instalado em: $DEST"
echo "Reinicie o Illustrator / After Effects / InDesign e abra: Janela > Extensoes > IBD Ferramentas."
