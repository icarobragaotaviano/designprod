import { PAPER_PRESETS, PROCESS_PROFILES } from './calculo.mjs';

function elemento(tag,conteudo,classe) {
    const el=document.createElement(tag);
    if (conteudo!==undefined) el.textContent=conteudo;
    if (classe) el.className=classe;
    return el;
}

function campoSelect(opcoes,valor) {
    const select=elemento('select');
    for (const [id,label] of opcoes) select.append(new Option(label,id));
    select.value=valor;
    return select;
}

function construirCampo(c) {
    const label=elemento('label');
    const titulo=elemento('span',c.rotulo,c.tipo==='checkbox'?'':'medida-label');
    if (c.unidade) titulo.append(elemento('small',c.unidade,'unidade'));
    const input=c.tipo==='select' ? campoSelect(c.opcoes,c.valor) : elemento('input');
    input.name=c.id;
    if (c.tipo==='number') Object.assign(input,{type:'number',inputMode:'decimal',required:true,min:c.min,max:c.max,step:c.step,value:c.valor});
    if (c.tipo==='checkbox') {
        Object.assign(input,{type:'checkbox',checked:c.valor});
        label.classList.add('check-row','campo-largo');
        label.append(input,titulo);
    } else label.append(titulo,input);
    if (c.tipo==='select') label.classList.add('campo-largo');
    return label;
}

export function iniciarApp(app) {
    const form=document.querySelector('#parametros'), controles=document.querySelector('#controles-resultado');
    const alvo=document.querySelector('#resultado'), aviso=document.querySelector('#aviso');
    const chave='designprod:'+document.body.dataset.app+':v1';
    const campos=app.grupos.flatMap(g=>g.campos);
    const urls=[];
    const botao=form.querySelector('button[type=submit]');
    botao.textContent=app.acao;

    for (const grupo of app.grupos) {
        const lista=elemento('fieldset',undefined,'campos');
        lista.append(elemento('legend',grupo.titulo,grupo.fechado?'sr-only':''));
        for (const c of grupo.campos) lista.append(construirCampo(c));
        if (grupo.nota) lista.append(elemento('p',grupo.nota,'nota-campo'));
        if (grupo.fechado) {
            const avancado=elemento('details',undefined,'parametros-avancados');
            avancado.append(elemento('summary',grupo.titulo),lista);
            botao.before(avancado);
        } else botao.before(lista);
    }
    try {
        const salvos=JSON.parse(localStorage.getItem(chave));
        if (salvos && typeof salvos==='object') for (const c of campos) {
            const valor=salvos[c.id], input=form.elements[c.id];
            if (c.tipo==='checkbox' && typeof valor==='boolean') input.checked=valor;
            if (c.tipo==='number' && Number.isFinite(valor) && valor>=c.min && valor<=c.max) input.value=valor;
            if (c.tipo==='select' && c.opcoes.some(([id])=>id===valor)) input.value=valor;
        }
    } catch { /* O formulário também funciona sem armazenamento local. */ }

    const papel=form.elements.preset;
    if (papel) {
        papel.addEventListener('change',()=>{
            const p=PAPER_PRESETS.find(p=>p.id===papel.value);
            if (p) {
                form.elements.sw.value=p.sw;
                form.elements.sh.value=p.sh;
            }
        });
        for (const id of ['sw','sh']) form.elements[id].addEventListener('input',()=>{ papel.value='custom'; });
    }

    const processo=form.elements.process;
    processo?.addEventListener('change',()=>{
        const perfil=PROCESS_PROFILES[processo.value];
        if (!perfil) return;
        const medidas={
            left:perfil.defaultSideMargin,right:perfil.defaultSideMargin,grip:perfil.defaultGrip,
            tail:perfil.defaultTail,bar:perfil.defaultBar,setup:perfil.defaultSetup,waste:perfil.defaultWaste
        };
        for (const [nome,valor] of Object.entries(medidas)) if (form.elements[nome]) form.elements[nome].value=valor;
    });

    function limpar() {
        for (const u of urls.splice(0)) URL.revokeObjectURL(u);
        alvo.replaceChildren();
        aviso.textContent='';
        aviso.removeAttribute('data-estado');
    }
    function baixar(label,nome,conteudo,mime,classe) {
        const link=elemento('a',label,classe || 'acao');
        const href=URL.createObjectURL(new Blob([conteudo],{type:mime}));
        urls.push(href);
        link.href=href;
        link.download=nome;
        return link;
    }
    const ui={
        seletor(label,opcoes,valor,mudar) {
            const campo=campoSelect(opcoes,valor);
            campo.addEventListener('change',()=>mudar(campo.value));
            const rotulo=elemento('label',label);
            rotulo.append(campo);
            controles.append(rotulo);
            return campo;
        },
        resultado(pares) {
            limpar();
            const grade=elemento('dl',undefined,'metricas');
            for (const [label,valor] of pares) {
                const cartao=elemento('div');
                cartao.append(elemento('dt',label),elemento('dd',valor));
                grade.append(cartao);
            }
            alvo.append(grade);
        },
        mensagem(texto) {
            limpar();
            aviso.textContent=texto;
            aviso.dataset.estado='erro';
        },
        diagrama(svg,nome,legenda,cores) {
            const fig=elemento('figure',undefined,'diagrama');
            const palco=elemento('div',undefined,'palco');
            const img=elemento('img');
            img.alt=legenda;
            const download=baixar('Baixar esquema SVG',nome+'.svg',svg,'image/svg+xml','acao');
            img.src=download.href;
            palco.append(img);
            const rodape=elemento('figcaption');
            rodape.append(elemento('span',legenda));
            const chave=elemento('ul',undefined,'legenda');
            for (const [label,cor] of cores) {
                const li=elemento('li',label);
                li.style.setProperty('--amostra',cor);
                chave.append(li);
            }
            rodape.append(chave,download);
            fig.append(palco,rodape);
            alvo.append(fig);
        },
        fatos(pares) {
            const lista=elemento('dl',undefined,'fatos');
            for (const [label,texto] of pares) {
                const par=elemento('div');
                par.append(elemento('dt',label),elemento('dd',texto));
                lista.append(par);
            }
            alvo.append(lista);
        },
        tabela(nome,labels,linhas) {
            const tabela=elemento('table');
            tabela.createCaption().textContent=nome;
            const head=tabela.createTHead().insertRow();
            for (const label of labels) {
                const th=elemento('th',label);
                th.scope='col';
                head.append(th);
            }
            const corpo=tabela.createTBody();
            for (const linha of linhas) {
                const tr=corpo.insertRow();
                for (const valor of linha) tr.append(elemento('td',valor));
            }
            const wrap=elemento('div',undefined,'tabela-scroll');
            wrap.tabIndex=0;
            wrap.setAttribute('role','region');
            wrap.setAttribute('aria-label',nome);
            wrap.append(tabela);
            alvo.append(wrap);
        },
        csv(label,nome,linhas) {
            alvo.append(baixar(label,nome+'.csv','\uFEFF'+linhas.map(linha=>linha.map(valor=>
                typeof valor==='number' ? String(valor).replace('.',',') : '"'+String(valor).replaceAll('"','""')+'"'
            ).join(';')).join('\r\n'),'text/csv;charset=utf-8'));
        },
        avisos(avisos) {
            if (!avisos?.length) return;
            const box=elemento('details',undefined,'avisos-tecnicos');
            if (avisos.length<4) box.open=true;
            const lista=elemento('ul');
            for (const a of avisos) lista.append(elemento('li',a));
            box.append(elemento('summary','Conferência técnica ('+avisos.length+')'),lista);
            alvo.append(box);
        }
    };

    // Um grupo recolhido pode conter um campo com medida inválida.
    form.addEventListener('invalid',evento=>{
        const grupo=evento.target.closest('details');
        if (grupo) grupo.open=true;
    },true);
    function calcular() {
        if (!form.reportValidity()) return false;
        controles.replaceChildren();
        limpar();
        const valores=Object.fromEntries(campos.map(c=>{
            const input=form.elements[c.id];
            return [c.id,c.tipo==='checkbox' ? input.checked : c.tipo==='number' ? input.valueAsNumber : input.value];
        }));
        try {
            app.mostrar(app.calcular(valores),valores,ui);
            aviso.textContent ||= 'Resultado atualizado.';
            try { localStorage.setItem(chave,JSON.stringify(valores)); } catch { /* Uso local opcional. */ }
        } catch(e) { ui.mensagem(e.message); }
        return true;
    }
    form.addEventListener('submit',evento=>{
        evento.preventDefault();
        if (calcular() && matchMedia('(max-width: 850px)').matches) {
            document.querySelector('#painel-resultado').scrollIntoView({block:'start'});
        }
    });
    calcular();
}
