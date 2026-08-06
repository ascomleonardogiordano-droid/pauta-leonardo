# Dashboard — Pauta Diária | Leonardo Giordano

Painel da pauta diária de comunicação, alimentado automaticamente pelos rascunhos que as
rotinas de IA criam no Gmail. Publicado no GitHub Pages e atualizado sozinho, sem depender
de nenhuma máquina ligada.

```
Rotina 07h ┐
           ├─► rascunho no Gmail (bloco <!--PAUTA_JSON-->)
Rotina 12h ┘              │
                          ▼
       GitHub Actions (07:25 e 12:25 BRT) lê o Gmail por IMAP
                          │
                          ▼
          data/dias/*.js  →  commit no main  →  GitHub Pages publica
```

O workflow **só commita**. Quem publica é o próprio Pages, que observa o branch `main`.
A publicação leva cerca de um minuto depois do commit — e ocasionalmente bem mais, quando a
fila de build do Pages engasga. Os dados nunca se perdem nesse caso: ficam commitados e o
site alcança quando a fila drena.

> ⚠️ **O site é público.** Qualquer pessoa com o link vê a pauta, e o repositório é público —
> todo o histórico de posts sugeridos fica aberto e indexável. Foi uma escolha consciente;
> se um dia precisar fechar, veja "Fechando o acesso" no fim deste arquivo.

## Instalação (uma vez só)

### 1. Autenticar o GitHub CLI

```bash
gh auth login
```

Escolha *GitHub.com* → *HTTPS* → *Login with a web browser* e cole o código exibido.

### 2. Criar o repositório e enviar o código

```bash
gh repo create pauta-leonardo --public --source=. --remote=origin --push
```

### 3. Gerar uma senha de app do Gmail

A automação lê o Gmail por IMAP, e o Google não aceita a senha normal da conta nisso.

1. A conta precisa ter **verificação em duas etapas** ligada.
2. Vá em https://myaccount.google.com/apppasswords
3. Crie uma senha chamada "Dashboard pauta" e copie os 16 caracteres.

### 4. Guardar as credenciais no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**, crie dois:

| Nome | Valor |
|---|---|
| `GMAIL_USER` | `ascomleonardogiordano@gmail.com` |
| `GMAIL_APP_PASSWORD` | a senha de 16 caracteres do passo 3 |

Secrets são criptografados: nem o GitHub mostra o valor depois de salvo, e ele não aparece
nos logs de execução.

### 5. Ligar o GitHub Pages

Em **Settings → Pages → Build and deployment → Source**, escolha **Deploy from a branch**,
branch `main`, pasta `/ (root)`.

> Já tentamos o modo "GitHub Actions" (com `actions/deploy-pages`). A fila de deploy deste
> repositório travava, com as execuções presas em `deployment_queued` até estourar o tempo.
> Servir direto do branch é mais simples e não depende dessa fila: o site é estático puro,
> então o Pages só precisa copiar os arquivos. Se um dia voltar ao modo Actions, lembre que
> os dois modos se excluem — deixar o `deploy-pages` no workflow com o modo por branch ligado
> faz toda execução falhar.

### 6. Testar

Em **Actions → Atualizar pauta e publicar → Run workflow**. Em ~1 minuto o site sobe em
`https://SEU-USUARIO.github.io/pauta-leonardo/`.

## Rotina normal

Nada. O GitHub Actions roda sozinho às **07:25 e 12:25** (horário de Brasília), logo depois
das duas rotinas que criam os rascunhos. Se aparecer pauta nova, ele commita e republica; se
não aparecer, encerra sem mexer em nada.

O agendador do GitHub pode atrasar alguns minutos em horário de pico — é normal e não quebra
nada, o próximo ciclo pega o que faltou.

Para forçar uma atualização na hora: **Actions → Run workflow**.

## O que tem aqui

```
index.html                      o painel (HTML/CSS/JS, sem dependências)
data/manifest.js                lista de pautas disponíveis   ← gerado
data/dias/AAAA-MM-DD.js         pauta da manhã                ← gerado
data/dias/AAAA-MM-DD-tarde.js   pauta da tarde                ← gerado
scripts/sync_gmail.py           lê os rascunhos por IMAP e grava os dados
scripts/build_share.py          gera a versão de arquivo único
.github/workflows/              a automação
```

Rodar na mão, se precisar:

```bash
GMAIL_USER=... GMAIL_APP_PASSWORD=... python scripts/sync_gmail.py
```

## As rotinas que alimentam isso

| Rotina | Horário (BRT) | Assunto do rascunho | Turno |
|---|---|---|---|
| Pauta diária + e-mail | 07h | `Pauta do dia — …` | manhã |
| Pauta da tarde | 12h | `Pauta da tarde — …` | tarde |

Ambas escrevem, no fim do corpo do e-mail, um bloco entre `<!--PAUTA_JSON-->` e
`<!--/PAUTA_JSON-->`. É só esse bloco que a automação lê — o resto do e-mail é para leitura
humana. Rascunhos sem o bloco (versões antigas) são ignorados sem erro.

Se um dia mudar o formato do JSON nas rotinas, ajuste `scripts/sync_gmail.py` junto.

## Fechando o acesso

O GitHub Pages é sempre público nos planos gratuito e Pro — tornar o repositório privado
esconde o código e o histórico, mas **não** fecha o site. Para tirar a página do ar:
**Settings → Pages → Source → None**. A automação continua rodando e guardando as pautas no
repositório; aí você distribui `dashboard-completo.html` (arquivo único, gerado a cada
execução) para quem precisar.
