# Dashboard — Pauta Diária | Leonardo Giordano

Painel visual da pauta diária de comunicação, alimentado pela rotina em nuvem
**“Pauta diária + e-mail — Leonardo Giordano”**.

## Como funciona

```
Rotina (todo dia 7h BRT)  →  rascunho no Gmail  →  bloco <!--PAUTA_JSON-->  →  data/dias/*.js  →  index.html
```

A rotina (`trig_01BGqcJM44Rq1FCxx3gzgKeR`) varre notícias das últimas 24h, escreve resumo,
ângulo, post pronto, legenda e hashtags de cada item, e cria um rascunho no Gmail para
`ascomleonardogiordano@gmail.com`. No fim do corpo do e-mail ela grava um bloco JSON
delimitado por `<!--PAUTA_JSON-->` — é esse bloco que vira o dashboard.

## Como usar

- **Abrir:** dê duplo clique em `index.html` (funciona offline, sem servidor).
- **Atualizar com a pauta de hoje:** no Claude Code, dentro desta pasta, rode `/atualizar-pauta`
  (ou simplesmente peça “atualiza o dashboard da pauta”).

No painel você tem: seletor de dia, termômetro do dia (quente/tranquilo), resumo, contagem por
área, filtro por área, busca livre, link para a matéria original e botões **Copiar** no post
pronto, na legenda e nas hashtags.

## Compartilhar / abrir no celular

- **Link:** https://claude.ai/code/artifact/3ac739f8-a85d-45e8-b70c-ac2d7aeb1bc0
  (nasce **privado**; libere em *Compartilhar*, na própria página, para o cliente enxergar).
- **Arquivo único:** `dist/dashboard-completo.html` — mande por WhatsApp, e-mail ou Drive;
  abre offline em qualquer celular, sem conta e sem internet.
- Ambos são regerados por `python scripts/build_share.py`. É uma **foto** dos dados: para
  refletir a pauta de um novo dia, rode `/atualizar-pauta`, que reconstrói e republica no
  mesmo link.

## Estrutura

```
index.html               painel completo (HTML/CSS/JS, sem dependências)
data/manifest.js         lista das datas disponíveis
data/dias/AAAA-MM-DD.js  uma pauta por arquivo
scripts/build_share.py   embute os dados e gera as versões de arquivo único
dist/                    versões compartilháveis (geradas, não edite à mão)
.claude/commands/        comando /atualizar-pauta
```

## Observações

- Rascunhos anteriores a 04/08/2026 20:23 não têm o bloco JSON (versão antiga da rotina) e por
  isso não aparecem no dashboard.
- Os links vêm embrulhados pelo Gmail (`google.com/url?q=…`); o painel desembrulha na hora de
  exibir, então os dados originais podem ser guardados como vieram.
