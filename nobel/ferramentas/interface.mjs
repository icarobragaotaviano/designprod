import { PAPER_PRESETS, PROCESS_PROFILES } from './calculo.mjs';

const modosLegados={folhas:'suggest',montagem:'flat',cadernos:'book',lona:'visual','montagem-rapida':'free','comparar-folhas':'compare'};

function lerModelos(chave) {
    try {
        const registros=JSON.parse(localStorage.getItem(chave));
        if (Array.isArray(registros)) return registros.filter(m=>m && typeof m.name==='string' && m.state && typeof m.state==='object');
    } catch { /* Uso local opcional. */ }
    return [];
}

export function migrarModelo(state,appId) {
    const valores={...state,preset:'custom',paisagem:false};
    if (appId==='lona') valores.margem=Math.max(state.left??0,state.right??0);
    if (appId==='folhas' && state.customPapers?.[0]) {
        valores.customW=state.customPapers[0].sw;
        valores.customH=state.customPapers[0].sh;
    }
    if (appId==='comparar-folhas' && Array.isArray(state.compareSheets) && state.compareSheets.length) {
        const folhas=state.compareSheets.slice(0,8);
        valores.quantidade=folhas.length;
        folhas.forEach((f,i)=>{
            if (f) Object.assign(valores,{['nome'+i]:f.name,['w'+i]:f.w,['h'+i]:f.h});
        });
    }
    return valores;
}

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
    if (c.tipo==='text') Object.assign(input,{type:'text',value:c.valor,maxLength:c.max});
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
    const appId=document.body.dataset.app;
    const chave='designprod:'+appId+':v1';
    const campos=app.grupos.flatMap(g=>g.campos);
    const edicao=app.iniciarEdicao?.();
    const urls=[];
    const botao=form.querySelector('button[type=submit]');
    botao.textContent=app.acao;

    const padroes=Object.fromEntries(campos.map(c=>[c.id,c.valor]));
    function preencher(valores) {
        if (!valores || typeof valores!=='object') return;
        for (const c of campos) {
            const valor=valores[c.id], input=form.elements[c.id];
            if (c.tipo==='checkbox' && typeof valor==='boolean') input.checked=valor;
            if (c.tipo==='number' && Number.isFinite(valor) && valor>=c.min && valor<=c.max) input.value=valor;
            if (c.tipo==='text' && typeof valor==='string') input.value=valor.slice(0,c.max);
            if (c.tipo==='select' && c.opcoes.some(([id])=>id===valor)) input.value=valor;
        }
    }

    const gruposCondicionais=[];
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
        if (grupo.exibir) gruposCondicionais.push([lista,grupo.exibir]);
    }
    try {
        preencher(JSON.parse(localStorage.getItem(chave)));
    } catch { /* O formulário também funciona sem armazenamento local. */ }
    const valoresDoLink=app.lerLink?.(new URLSearchParams(location.search));
    if (valoresDoLink) {
        preencher(padroes);
        preencher(valoresDoLink);
    }
    function atualizarGrupos() {
        for (const [lista,exibir] of gruposCondicionais) {
            lista.hidden=!exibir(form.elements);
            lista.disabled=lista.hidden;
        }
    }
    if (gruposCondicionais.length) {
        atualizarGrupos();
        form.addEventListener('input',atualizarGrupos);
    }

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
    function lerValores() {
        return Object.fromEntries(campos.map(c=>{
            const input=form.elements[c.id];
            return [c.id,c.tipo==='checkbox' ? input.checked : c.tipo==='number' ? input.valueAsNumber : input.value];
        }));
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
            ui.erro(texto);
        },
        erro(texto) {
            aviso.textContent=texto;
            aviso.dataset.estado='erro';
        },
        ferramenta(componente) {
            controles.append(componente);
        },
        diagrama(svg,nome,legenda,cores,baixavel=true) {
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
            const zoom=elemento('button','Ampliar diagrama');
            zoom.type='button';
            zoom.setAttribute('aria-expanded','false');
            zoom.addEventListener('click',()=>{
                const ampliar=palco.classList.toggle('palco-ampliado');
                zoom.textContent=ampliar?'Ajustar à tela':'Ampliar diagrama';
                zoom.setAttribute('aria-expanded',String(ampliar));
            });
            palco.tabIndex=0;
            palco.setAttribute('aria-label',legenda);
            rodape.append(chave,zoom);
            if (baixavel) rodape.append(download);
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
        arquivoPlano(plano,nome='plano-folha') {
            if (!plano.materializavel || plano.diagnosticos.some(d=>d.gravidade==='erro')) return;
            alvo.append(baixar('Baixar plano JSON',nome+'.json',JSON.stringify(plano,null,2),'application/json'));
        },
        link(label,href) {
            const link=elemento('a',label,'acao');
            link.href=href;
            alvo.append(link);
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
        const valores=lerValores();
        try {
            const alteracoes=edicao?.ler(valores);
            app.mostrar(app.calcular(valores,alteracoes),valores,ui,edicao,calcular);
            aviso.textContent ||= 'Resultado atualizado.';
            try {
                localStorage.setItem(chave,JSON.stringify(valores));
                if (alteracoes) localStorage.setItem(chave+':edicao',JSON.stringify(alteracoes));
            } catch { /* Uso local opcional. */ }
        } catch(e) { ui.mensagem(e.message); }
        return true;
    }
    const chaveModelos=chave+':modelos';
    const modelos=lerModelos(chaveModelos);
    const legados=lerModelos('folha-models').filter(m=>m.state.mode===modosLegados[appId]);
    const secao=elemento('details',undefined,'parametros-avancados editor-posicoes');
    const linhas=elemento('div',undefined,'editor-campos');
    const titulo=elemento('summary','Modelos');
    const nome=elemento('input');
    Object.assign(nome,{type:'text',maxLength:80});
    const nomeLabel=elemento('label','Nome do modelo');
    nomeLabel.append(nome);
    const lista=elemento('select');
    const listaLabel=elemento('label','Modelo salvo');
    listaLabel.append(lista);
    const mensagem=elemento('p',undefined,'nota-campo');
    mensagem.setAttribute('role','status');
    const comandos=elemento('div',undefined,'editor-comandos');
    const salvar=elemento('button','Salvar modelo'),abrir=elemento('button','Abrir modelo');
    salvar.type=abrir.type='button';
    function listarModelos(selecao='') {
        lista.replaceChildren(new Option('Selecione um modelo',''));
        modelos.forEach((m,i)=>lista.append(new Option(m.name,'local-'+i)));
        legados.forEach((m,i)=>lista.append(new Option(m.name+' · Folha','legado-'+i)));
        lista.value=selecao;
        abrir.disabled=!lista.value;
    }
    lista.addEventListener('change',()=>{abrir.disabled=!lista.value;});
    salvar.addEventListener('click',()=>{
        const name=nome.value.trim();
        if (!name) { mensagem.textContent='Dê um nome ao modelo.'; nome.focus(); return; }
        if (!form.reportValidity()) return;
        if (modelos.some(m=>m.name===name)) { mensagem.textContent='Já existe um modelo com esse nome.'; return; }
        const valores=lerValores();
        const state={...valores,...edicao?.ler(valores)};
        try {
            const calculo=app.calcular(valores,edicao?.ler(valores));
            const erros=calculo.resultado?.errors??calculo.errors??[];
            if (erros.length) { mensagem.textContent=erros.join(' '); return; }
        } catch(e) { mensagem.textContent=e.message; return; }
        try {
            localStorage.setItem(chaveModelos,JSON.stringify([...modelos,{name,state}]));
            modelos.push({name,state});
            listarModelos('local-'+(modelos.length-1));
            mensagem.textContent='Modelo salvo neste navegador.';
        } catch { mensagem.textContent='O armazenamento local está indisponível.'; }
    });
    abrir.addEventListener('click',()=>{
        const [origem,indice]=lista.value.split('-');
        const m=(origem==='legado'?legados:modelos)[Number(indice)];
        if (!m) return;
        preencher(padroes);
        preencher(origem==='legado'?migrarModelo(m.state,appId):m.state);
        atualizarGrupos();
        edicao?.restaurar(lerValores(),m.state);
        nome.value=m.name;
        calcular();
        mensagem.textContent=origem==='legado'?'Parâmetros compatíveis carregados do modelo Folha.':'Modelo carregado.';
    });
    listarModelos();
    linhas.append(nomeLabel,listaLabel);
    comandos.append(salvar,abrir);
    secao.append(titulo,linhas,comandos,mensagem);
    botao.before(secao);
    form.addEventListener('submit',evento=>{
        evento.preventDefault();
        if (calcular() && matchMedia('(max-width: 850px)').matches) {
            document.querySelector('#painel-resultado').scrollIntoView({block:'start'});
        }
    });
    if (edicao && !valoresDoLink) {
        try { edicao.restaurar(lerValores(),JSON.parse(localStorage.getItem(chave+':edicao'))); }
        catch { /* Um rascunho inválido não impede o uso da ferramenta. */ }
    }
    if (calcular() && valoresDoLink) history.replaceState(null,'',location.pathname+location.hash);
}
