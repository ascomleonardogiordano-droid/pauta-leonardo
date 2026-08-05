---
description: Puxa os rascunhos de pauta do Gmail e atualiza o dashboard
---

Atualize o dashboard de pauta diária deste projeto com os rascunhos mais recentes do Gmail.

Duas rotinas em nuvem alimentam o dashboard, ambas criando rascunhos para
`ascomleonardogiordano@gmail.com`:

| Rotina | Horário (BRT) | Assunto do rascunho | Turno |
|---|---|---|---|
| `trig_01BGqcJM44Rq1FCxx3gzgKeR` — Pauta diária + e-mail | 07h | `Pauta do dia — …` | manhã |
| `trig_01CnbLB8PX3yipmt3vwBdBzp` — Pauta da tarde | 12h | `Pauta da tarde — …` | tarde |

Passos:

1. Liste os rascunhos com `list_drafts` do conector Gmail, `pageSize: 10`, `view: DRAFT_VIEW_FULL`,
   uma vez para cada assunto: `subject:"Pauta do dia"` e `subject:"Pauta da tarde"`.

2. Leia `data/manifest.js` para ver o que já está no dashboard. Os identificadores são
   `AAAA-MM-DD` para a manhã e `AAAA-MM-DD-tarde` para a tarde. Ignore o que já existe,
   a menos que o usuário peça para regravar.

3. Para cada rascunho novo, extraia o bloco entre `<!--PAUTA_JSON-->` e `<!--/PAUTA_JSON-->`
   do `plaintextBody`. Se um rascunho não tiver esse bloco (versões antigas da rotina),
   pule-o e avise o usuário no final.

4. Crie o arquivo do dia — `data/dias/AAAA-MM-DD.js` (manhã) ou `data/dias/AAAA-MM-DD-tarde.js`
   (tarde), com o conteúdo:

   ```js
   registrarPauta({ ...JSON do rascunho..., "gmail_thread": "<threadId do rascunho>" });
   ```

   Mantenha o JSON exatamente como veio (o dashboard já desembrulha sozinho os links
   `google.com/url?q=` do Gmail). Só acrescente o campo `gmail_thread`. O JSON da tarde já
   traz `"turno": "tarde"`; se faltar, acrescente. Uma pauta da tarde com `"itens": []` é
   válida — significa que não houve fato novo, e o dashboard mostra isso.

5. Acrescente o novo identificador ao array em `data/manifest.js`.

6. Rode `python scripts/build_share.py` para regerar `dist/dashboard-completo.html`
   (arquivo único para mandar por WhatsApp) e `dist/artifact.html`.

7. Republique o link compartilhado, chamando a ferramenta Artifact com
   `file_path: dist/artifact.html` e
   `url: https://claude.ai/code/artifact/3ac739f8-a85d-45e8-b70c-ac2d7aeb1bc0`
   — assim o link do cliente continua o mesmo.

8. Confirme ao usuário: quais pautas entraram (dia e turno), quantos itens cada uma tem,
   a temperatura do dia e que o link compartilhado já está atualizado.

Não envie e-mails e não altere os rascunhos — apenas leia.
