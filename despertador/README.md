# Despertador da pauta

Worker do Cloudflare que, de hora em hora, manda o GitHub executar o workflow
**Atualizar pauta**.

## Por que existe

O cron do GitHub Actions não dispara de forma confiável nesta conta. Nos cinco primeiros
dias de uso:

| Dia | Execuções automáticas | Esperadas |
|---|---|---|
| 06/08 | 0 | 12 |
| 07/08 | 2 | 12 |
| 08/08 | 2 | 12 |
| 09/08 | 6 | 12 |
| 10/08 | 0 | 12 |

Só que, **quando o workflow roda, ele nunca falha**: 17 de 17 execuções agendadas
concluíram com sucesso, lendo o Gmail e commitando as pautas. O problema nunca foi o
leitor — era o despertador. Por isso a solução é externa e mínima, em vez de reescrever
a leitura do Gmail em outra linguagem.

## Como está montado

```
Cloudflare Worker (cron de hora em hora)
        │  POST /actions/workflows/atualizar-pauta.yml/dispatches
        ▼
GitHub Actions executa o workflow (lê o Gmail por IMAP, commita)
        ▼
Cloudflare Pages publica o site
```

## Configuração no painel do Cloudflare

**Workers e Pages → despertador-pauta → Configurações**

Variáveis de ambiente:

| Nome | Tipo | Valor |
|---|---|---|
| `GITHUB_TOKEN` | **Secreta** | token do GitHub (veja abaixo) |
| `REPO` | Texto | `ascomleonardogiordano-droid/pauta-leonardo` |
| `WORKFLOW` | Texto | `atualizar-pauta.yml` |

Cron Triggers:

```
25 10-21 * * *
```

Horário é UTC — equivale a 07:25 até 18:25 de Brasília, de hora em hora.

## O token do GitHub

Crie em **github.com → Settings → Developer settings → Personal access tokens →
Fine-grained tokens**:

- **Repository access:** só o `pauta-leonardo`
- **Permissions → Actions:** *Read and write* (é o mínimo para disparar um workflow)
- **Expiration:** anote a data. Quando vencer, a automação para até o token ser trocado.

Guarde o token apenas como variável **secreta** do Worker. Depois de salvo, o Cloudflare
não mostra mais o valor.

## Verificar se está funcionando

- Abrir a URL do Worker mostra o estado da configuração (não dispara nada de propósito —
  um endereço público que aciona a automação seria um convite a abuso).
- **Workers e Pages → despertador-pauta → Logs** mostra cada execução do cron.
- No GitHub, **Actions** deve passar a registrar execuções com evento `workflow_dispatch`
  a cada hora.
- No painel da pauta, a faixa do topo indica se a varredura esperada chegou.
