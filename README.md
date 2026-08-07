# Dashboard — Pauta Diária | Leonardo Giordano

**No ar em https://pauta-leonardo.pages.dev**

Painel da pauta diária de comunicação, alimentado automaticamente pelos rascunhos que as
rotinas de IA criam no Gmail. Atualiza sozinho, sem depender de nenhuma máquina ligada.

```
Rotina 07h ┐
           ├─► rascunho no Gmail (bloco <!--PAUTA_JSON-->)
Rotina 12h ┘              │
                          ▼
        GitHub Actions lê o Gmail por IMAP (de hora em hora)
                          │
                          ▼
       data/dias/*.js  →  commit no main  →  Cloudflare Pages publica
```

O workflow **só commita**. Quem publica é o Cloudflare, que observa o branch `main` e sobe o
site em cerca de um minuto a cada commit.

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

### 5. Publicar pelo Cloudflare Pages

1. Crie a conta gratuita em https://dash.cloudflare.com/sign-up (pode entrar com o GitHub).
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorize o GitHub e escolha o repositório `pauta-leonardo`.
4. Configuração do build:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** deixe **vazio**
   - **Build output directory:** `/`
5. **Save and Deploy**. Em cerca de um minuto o site está em
   `https://pauta-leonardo.pages.dev`.

Depois disso o Cloudflare republica sozinho a cada commit no `main`.

> **Por que não o GitHub Pages.** Foi a primeira escolha e falhou nos dois modos.
> No modo "GitHub Actions", os deploys ficavam presos em `deployment_queued` até estourar o
> tempo. No modo "por branch", os builds erravam de forma intermitente — o mesmo commit
> compilou numa tentativa e falhou na seguinte. A causa comum: o Pages, nos dois modos, é
> executado como workflow do GitHub Actions (`pages-build-deployment`), e a fila do Actions
> nesta conta não estava alocando runners. O Cloudflare publica por webhook, sem essa
> dependência.

O arquivo `_headers` na raiz define cache de um minuto para o painel e os dados — assim a
pauta nova aparece rápido para quem abre o link, em vez de ficar presa no CDN.

### 6. Testar

Em **Actions → Atualizar pauta → Run workflow**. O workflow commita, e o Cloudflare publica
em cerca de um minuto.

## Rotina normal

Nada. O workflow roda **de hora em hora, das 07:25 às 18:25** (horário de Brasília). As
rotinas criam os rascunhos às 07h e 12h; as demais execuções encerram em segundos sem
commitar, por não encontrarem novidade.

Rodar de hora em hora é proposital: o cron do GitHub Actions se mostrou pouco confiável —
houve dia em que simplesmente não disparou. Com a repetição horária, um horário perdido é
recuperado no seguinte, e o atraso máximo do painel cai de um dia para uma hora.

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

O site do Cloudflare Pages é público — qualquer pessoa com o link vê a pauta. Tornar o
repositório privado esconde o código e o histórico, mas **não** fecha o site.

Para tirar a página do ar: no painel do Cloudflare, **Workers e Pages → pauta-leonardo →
Configurações → Excluir projeto**. A automação continua rodando e guardando as pautas no
repositório; aí você distribui `dashboard-completo.html` (arquivo único, gerado a cada
execução) para quem precisar.

Para restringir sem tirar do ar, o Cloudflare tem o **Cloudflare Access**, que exige login
por e-mail antes de abrir a página. É gratuito até 50 usuários e fica em
**Zero Trust → Access → Applications**.

> O GitHub Pages foi desligado em 07/08/2026, depois que o Cloudflare entrou no ar. O
> endereço antigo `ascomleonardogiordano-droid.github.io/pauta-leonardo` não responde mais.
