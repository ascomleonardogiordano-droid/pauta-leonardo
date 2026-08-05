---
description: Força uma atualização da pauta agora, fora do horário automático
---

O caminho normal é automático: o GitHub Actions roda às 07:25 e 12:25 (BRT), lê o Gmail e
republica o site em https://ascomleonardogiordano-droid.github.io/pauta-leonardo/.
Este comando serve só para **forçar uma atualização fora de hora**.

Prefira sempre disparar pelo GitHub, que roda com as credenciais já configuradas:

```
gh workflow run "Atualizar pauta e publicar" --repo ascomleonardogiordano-droid/pauta-leonardo
```

Depois acompanhe até terminar e relate ao usuário o que entrou:

```
gh run list --repo ascomleonardogiordano-droid/pauta-leonardo --limit 1
gh run watch <ID> --repo ascomleonardogiordano-droid/pauta-leonardo
```

No log, as linhas úteis são as do passo "Ler os rascunhos do Gmail": quantos rascunhos achou,
quais pautas entraram e quantos itens cada uma tem.

## Se precisar rodar localmente

Só faça isso se o GitHub estiver indisponível — e **sempre com `git pull` antes**, senão o
repositório local diverge do remoto e o próximo pull dá conflito:

```
git pull
GMAIL_USER=... GMAIL_APP_PASSWORD=... python scripts/sync_gmail.py
git add data/ && git commit -m "Pauta atualizada" && git push
```

As credenciais não ficam salvas nesta máquina — estão só nos Secrets do GitHub. Peça ao
usuário se precisar delas, e nunca as escreva em arquivo.

## Se o workflow falhar

Leia o erro com `gh run view <ID> --repo ascomleonardogiordano-droid/pauta-leonardo --log-failed`.
O script já explica as causas prováveis de falha de login. Não tente contornar criando dados
à mão: relate o erro ao usuário.
