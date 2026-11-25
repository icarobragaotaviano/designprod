import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
/* @ibd-remendo-janela */

function cli(executavel, args) {
    try {
        return execFileSync(executavel, args, {encoding:'utf8', maxBuffer:32*1024*1024});
    } catch (e) {
        throw new Error(e.stderr?.trim() || e.message);
    }
}

function executar() {
    const [entrada, destino, medidas, ferramenta='photocraft-cli'] = process.argv.slice(2);
    if (!entrada || !destino || !medidas) {
        throw new Error('Uso: node remendo-adesivo-photocraft.mjs original.tif remendo.tif "X;Y;L;A;M" [caminho do photocraft-cli]');
    }
    if (!/^\.(?:tiff?|psd|pcraft)$/i.test(extname(destino))) throw new Error('Use saída TIFF, PSD ou PCRAFT para conservar a escala do documento.');
    const origem = resolve(entrada);
    const saida = resolve(destino);
    const mapa = saida + '.json';
    if (existsSync(saida) || existsSync(mapa)) throw new Error('Escolha um nome de saída novo.');
    const m = medidasRemendo(medidas);
    const info = JSON.parse(cli(ferramenta, ['info','--compact',origem]));
    if (!(info.resolution > 0)) throw new Error('A arte de origem precisa ter uma resolução física válida.');
    const escala = info.resolution / 25.4;
    const p = janelaRemendo(info.width/escala, info.height/escala, ...m);
    const x = Math.max(0, Math.floor(p[0]*escala + 1e-8));
    const y = Math.max(0, Math.floor(p[1]*escala + 1e-8));
    const largura = Math.min(info.width, Math.ceil((p[0]+p[2])*escala - 1e-8)) - x;
    const altura = Math.min(info.height, Math.ceil((p[1]+p[3])*escala - 1e-8)) - y;
    const pasta = mkdtempSync(join(dirname(saida),'.ibd-remendo-'));
    const arquivo = join(pasta,'arte'+extname(saida));
    const json = join(pasta,'mapa.json');
    const posicao = [x/escala,y/escala,largura/escala,altura/escala];
    let publicou = false;
    try {
        cli(ferramenta, ['run',origem,'--cmd','image.crop','--params',
            JSON.stringify({x,y,width:largura,height:altura,deleteCroppedPixels:true}),'--out',arquivo]);
        const conferido = JSON.parse(cli(ferramenta, ['info','--compact',arquivo]));
        if (conferido.width !== largura || conferido.height !== altura ||
            Math.abs(conferido.resolution-info.resolution) > .01 ||
            conferido.mode !== info.mode || conferido.depth !== info.depth) {
            throw new Error('O formato escolhido alterou dimensões, resolução, modo de cor ou profundidade.');
        }
        writeFileSync(json,JSON.stringify({unidade:'mm',origem:'superior esquerda',
            x:posicao[0],y:posicao[1],largura:posicao[2],altura:posicao[3],ppi:conferido.resolution},null,2)+'\n');
        linkSync(arquivo,saida);
        publicou = true;
        linkSync(json,mapa);
    } catch (e) {
        if (publicou) rmSync(saida);
        throw e;
    } finally {
        rmSync(pasta,{recursive:true,force:true});
    }
    console.log(resumoRemendo(posicao));
}
try { executar(); }
catch (e) { console.error(e.message); process.exitCode=1; }
