/* Todas as coordenadas desta rotina usam milímetros, com Y crescente para baixo. */
var imposicaoPt = 72 / 25.4;
var imposicaoTraco = 0.25 / imposicaoPt;

function imposicaoOpcoes(texto) {
    var campos = texto.split(";");
    if (campos.length !== 8) throw Error("Informe os oito parâmetros separados por ponto e vírgula.");
    for (var i = 0; i < campos.length; i++) {
        var campo = campos[i].replace(/^\s+|\s+$/g, "").replace(",", ".");
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(campo)) throw Error("Confira o parâmetro " + (i + 1) + ".");
        campos[i] = Number(campo);
        if (!isFinite(campos[i])) throw Error("Valor fora da faixa.");
    }
    var o = { largura: campos[0], altura: campos[1], margem: campos[2], espaco: campos[3],
        quantidade: campos[4], offset: campos[5], marcas: campos[6], retangulo: campos[7] };
    if (o.largura <= 0 || o.altura <= 0 || o.margem < 0 || o.espaco < 0 ||
        o.quantidade < 0 || o.quantidade % 1 || Math.abs(o.offset) > 100 ||
        (o.marcas !== 0 && o.marcas !== 1) || (o.retangulo !== 0 && o.retangulo !== 1)) {
        throw Error("Use folha positiva, margem e espaço ≥ 0, quantidade inteira, offset até ±100 mm e opções 0 ou 1.");
    }
    if (o.marcas && o.margem < 8) throw Error("As cruzes de registro exigem margem mínima de 8 mm.");
    return o;
}

var imposicaoPergunta = "Largura; altura; margem; intervalo; quantidade; deslocamento da faca; cruzes; tipo de faca\n" +
    "Medidas em mm. Quantidade 0 = automática. Deslocamento + para fora, − para dentro.\n" +
    "Cruzes: 0 = não, 1 = sim. Faca: 0 = curva selecionada, 1 = retângulo da seleção.";
var imposicaoPadrao = "328;478;10;5;0;0;1;0";

function imposicaoGrade(o, arte, faca) {
    var raio = imposicaoTraco / 2;
    var x = Math.min(arte[0], faca[0] - raio);
    var y = Math.min(arte[1], faca[1] - raio);
    var w = Math.max(arte[2], faca[2] + raio) - x;
    var h = Math.max(arte[3], faca[3] + raio) - y;
    if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) throw Error("Dimensões da peça inválidas.");
    var colunas = Math.max(0, Math.floor((o.largura - 2 * o.margem + o.espaco + 1e-8) / (w + o.espaco)));
    var linhas = Math.max(0, Math.floor((o.altura - 2 * o.margem + o.espaco + 1e-8) / (h + o.espaco)));
    var maximo = colunas * linhas;
    if (!maximo) throw Error("A peça com a faca e a margem não cabe nesta folha.");
    var n = o.quantidade || maximo;
    if (n > maximo) throw Error("Cabem até " + maximo + " peças nesta folha.");
    if (n > 500) throw Error("A montagem admite até 500 cópias por folha. Informe uma quantidade manual de até 500.");
    var posicoes = [], marcas = [];
    for (var i = 0; i < n; i++) {
        posicoes.push([o.margem - x + (i % colunas) * (w + o.espaco),
            o.margem - y + Math.floor(i / colunas) * (h + o.espaco)]);
    }
    if (o.marcas) {
        var xs = [5, o.largura - 5], ys = [5, o.altura - 5];
        for (var c = 0; c < 2; c++) for (var l = 0; l < 2; l++) {
            var mx = xs[c], my = ys[l];
            marcas.push([mx - 2, my, mx + 2, my], [mx, my - 2, mx, my + 2]);
        }
    }
    return { posicoes: posicoes, marcas: marcas, maximo: maximo };
}

function imposicaoRetangulo(caixa, offset) {
    var r = [caixa[0] - offset, caixa[1] - offset, caixa[2] + offset, caixa[3] + offset];
    if (r[0] >= r[2] || r[1] >= r[3]) throw Error("O recuo anula o retângulo de corte.");
    return r;
}

function imposicaoVertices(b) {
    return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
}

function imposicaoCaixa(p) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < p.length; i++) {
        b[0] = Math.min(b[0], p[i][0]); b[1] = Math.min(b[1], p[i][1]);
        b[2] = Math.max(b[2], p[i][0]); b[3] = Math.max(b[3], p[i][1]);
    }
    return b;
}

/* Intersecta as retas paralelas a cada lado. Rejeita recuos colapsados e contornos não convexos. */
function imposicaoPoligono(p, offset) {
    var n = p.length, lados = [], q = [], area = 0, eps = 1e-7;
    if (n < 3 || n > 256) throw Error("O deslocamento vetorial exige um polígono convexo de 3 a 256 nós.");
    var i, j, a, b;
    for (i = 0; i < n; i++) {
        a = p[i]; b = p[(i + 1) % n];
        area += (a[0] - p[0][0]) * (b[1] - p[0][1]) - (a[1] - p[0][1]) * (b[0] - p[0][0]);
    }
    if (Math.abs(area) < eps) throw Error("A curva não tem área de corte.");
    var sinal = area > 0 ? 1 : -1;
    for (i = 0; i < n; i++) {
        a = p[i]; b = p[(i + 1) % n];
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
        if (len < eps) throw Error("Remova os nós coincidentes antes de deslocar a faca.");
        var nx = sinal * dy / len, ny = -sinal * dx / len;
        var limite = nx * a[0] + ny * a[1];
        for (j = 0; j < n; j++) {
            if (nx * p[j][0] + ny * p[j][1] > limite + eps) throw Error("O deslocamento desta versão exige um polígono convexo.");
        }
        lados.push([nx, ny, limite + offset]);
    }
    for (i = 0; i < n; i++) {
        a = lados[(i + n - 1) % n]; b = lados[i];
        var det = a[0] * b[1] - a[1] * b[0];
        if (Math.abs(det) < eps) throw Error("Simplifique os nós colineares antes de deslocar a faca.");
        var x = (a[2] * b[1] - a[1] * b[2]) / det, y = (a[0] * b[2] - a[2] * b[0]) / det;
        for (j = 0; j < n; j++) {
            if (lados[j][0] * x + lados[j][1] * y > lados[j][2] + eps) throw Error("O recuo elimina um ou mais lados da faca.");
        }
        q.push([x, y]);
    }
    for (i = 0; i < n; i++) {
        j = (i + 1) % n;
        if ((p[j][0] - p[i][0]) * (q[j][0] - q[i][0]) + (p[j][1] - p[i][1]) * (q[j][1] - q[i][1]) <= eps)
            throw Error("O recuo colapsa a faca.");
    }
    return q;
}

function imposicaoResumo(grade) {
    return grade.posicoes.length + " peças montadas. Capacidade da folha: " + grade.maximo +
        ".\nExporte ARTE e FACA separadamente em escala 1:1.";
}
