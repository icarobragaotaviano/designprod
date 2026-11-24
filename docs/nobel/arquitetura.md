# Arquitetura e contrato de produção

## Organização proposta

| Caminho | Responsabilidade |
|---|---|
| `site/src/` e `tools/build-site.mjs` | Manter a vitrine existente. Acrescentar busca por tarefa, plataforma, versão testada e situação da ferramenta. |
| `apps/web/<app>/` | Cada PWA tem rota estável, identificação, manifesto, escopo, ícones e cache próprios. Iniciar com Endereços da OS. |
| `core/producao/` | Lógica portável de contratos, conversões e validação. Para motores externos, fixar origem e revisão, verificar licença e compatibilidade e executar casos de referência antes de distribuir. |
| `apps/<editor>/`, `plugins/` | Preservar os scripts Adobe e o painel Photoshop. Acrescentar adaptadores nos diretórios dos novos editores à medida que forem entregues. |
| `perfis/nobel/` | Perfis versionados de máquina, papel, produto e saída, com valores aprovados pela bancada. |
| `tools/windows/` | Abrir e preparar pastas usando os acessos do operador. |
| `tools/fixtures/nobel/` | Dados sintéticos compartilhados por testes web, scripts e inspeção manual. |

O gerador atual interpreta metadados dos scripts Adobe. Ao adicionar um novo tipo de ferramenta, ampliar leitor, validação, vitrine e testes no mesmo incremento. Preservar IDs e campos que as versões distribuídas do painel já consomem. Estender o catálogo com plataforma, mecanismo de execução, versão testada, perfil e estágio de homologação. Um item de planejamento só recebe link de instalação quando houver artefato disponível.

## Contrato inicial de uma peça

Exemplo de intercâmbio proposto, com medidas do produto acabado e origem no canto superior esquerdo. O cliente e o pedido permanecem strings para preservar zeros.

```json
{
  "versaoContrato": 1,
  "os": "0123-004567",
  "item": "000001",
  "revisao": 2,
  "estado": "em_prova",
  "produto": "calendario_mesa",
  "unidade": "mm",
  "origem": "superior_esquerdo_do_corte",
  "corte": {"largura": 210, "altura": 150},
  "sangria": {"superior": 3, "direita": 3, "inferior": 3, "esquerda": 3},
  "acabamento": {"tipo": "wire_o", "lado": "superior", "reserva": 11, "segurancaAdicional": 3},
  "perfil": {"id": "nobel-calendario-210x150", "versao": 1}
}
```

**Regras.** A chave da revisão é OS + item + revisão. Cálculos avulsos usam um identificador local até serem vinculados ao pedido. A versão principal do contrato controla leitura e migração. Validar dimensões finitas e positivas, unidades e campos obrigatórios; apresentar o campo que falhou. Rejeitar uma versão principal desconhecida antes de alterar a arte. Manter os parâmetros efetivos do perfil na revisão para permitir reimpressão.

**Extensões por tarefa.** Uma montagem acrescenta folha, máquina, área útil e posições com face, rotação e coordenadas. Uma campanha inclui IDs de produto e campos comerciais. A saída guarda finalidade, arquivo, revisão, preset e autor da liberação. CSV transporta registros de ofertas e numeração; SVG transporta geometria de referência. O PDF para impressão segue o perfil validado do equipamento.

## Fluxo, concorrência e acesso

- O atendimento existente pode virar OS. Enviar a chave do atendimento com a conversão para que uma repetição recupere a mesma ordem.
- A revisão passa por rascunho, em prova, aprovada e liberada. Alterar a arte aprovada cria outra revisão que volta à prova. O impressor vê a última **liberada**, mesmo durante a criação da próxima.
- A PWA guarda cálculos locais e a fila de ações offline. Cada alteração enviada tem identificador e versão de origem. Uma edição concorrente exibe as versões para resolução antes de sobrescrever o registro.
- A identidade e as permissões operacionais vêm do gerenciador. O QR contém referência à ficha. Ações na rede Windows usam a sessão do operador e raiz configurada na estação. Uma saída compartilhada com o cliente contém os campos da aprovação.
- No piloto, transportar um plano JSON por arquivo. Integrar uma API autenticada quando as regras de revisão e repetição estiverem aprovadas. Erro ao exportar deve manter a revisão anterior disponível.

## Instalação e manutenção

Publicar PWAs em HTTPS, com rota própria, cache versionado e tela de funcionamento offline. Testar instalação no Chrome Android e Edge/Chrome Windows. A primeira abertura prepara a interface e os dados necessários para os cálculos. Distinguir “salvo neste aparelho”, “pendente de envio” e “sincronizado”. Ao atualizar, preservar rascunhos e migrar dados locais antes de descartar caches antigos.

Distribuir macros, scripts e extensões com versão e editor compatível. Manter a última versão homologada acessível e registrar o perfil usado em cada saída. Uma regressão de editor pode suspender a distribuição daquele adaptador enquanto os demais continuam disponíveis.
