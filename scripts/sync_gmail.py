# -*- coding: utf-8 -*-
"""
Le os rascunhos de pauta no Gmail via IMAP e grava os arquivos do dashboard.

Roda no GitHub Actions (e tambem na sua maquina). Nao depende de nenhum
assistente: e Python puro, so com a biblioteca padrao.

Credenciais (variaveis de ambiente / GitHub Secrets):
  GMAIL_USER          e-mail da conta (ex: ascomleonardogiordano@gmail.com)
  GMAIL_APP_PASSWORD  senha de app de 16 caracteres gerada em
                      https://myaccount.google.com/apppasswords

Saida:
  data/dias/AAAA-MM-DD.js         pauta da manha
  data/dias/AAAA-MM-DD-tarde.js   pauta da tarde
  data/manifest.js                lista de identificadores

Codigo de saida 0 sempre que a execucao foi bem sucedida, mesmo sem novidade.
"""
import email
import email.header
import imaplib
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_DIAS = os.path.join(RAIZ, "data", "dias")
MANIFESTO = os.path.join(RAIZ, "data", "manifest.js")

ASSUNTOS = [("Pauta do dia", "manha"), ("Pauta da tarde", "tarde")]
BLOCO = re.compile(r"<!--PAUTA_JSON-->(.*?)<!--/PAUTA_JSON-->", re.S)


def log(msg):
    print(msg, flush=True)


def conectar():
    usuario = os.environ.get("GMAIL_USER", "").strip()
    senha = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if not usuario or not senha:
        sys.exit("ERRO: defina GMAIL_USER e GMAIL_APP_PASSWORD.")
    imap = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    try:
        imap.login(usuario, senha)
    except imaplib.IMAP4.error as e:
        sys.exit("ERRO de login no Gmail (confira a senha de app): %s" % e)
    return imap


def pasta_rascunhos(imap):
    """Acha a pasta de rascunhos pela flag \\Drafts (o nome e traduzido)."""
    ok, linhas = imap.list()
    if ok == "OK":
        for linha in linhas:
            texto = linha.decode("utf-8", "replace")
            if "\\Drafts" in texto:
                return '"%s"' % texto.split(' "/" ')[-1].strip().strip('"')
    return '"[Gmail]/Drafts"'


def corpo_texto(msg):
    """Extrai o corpo em texto puro, lidando com multipart e codificacoes."""
    partes = msg.walk() if msg.is_multipart() else [msg]
    for parte in partes:
        if parte.get_content_type() != "text/plain":
            continue
        bruto = parte.get_payload(decode=True)
        if not bruto:
            continue
        charset = parte.get_content_charset() or "utf-8"
        try:
            return bruto.decode(charset, "replace")
        except LookupError:
            return bruto.decode("utf-8", "replace")
    return ""


def thread_id(imap, num):
    """X-GM-THRID em hexadecimal — e o que o Gmail usa na URL."""
    try:
        ok, dados = imap.fetch(num, "(X-GM-THRID)")
        if ok == "OK" and dados and dados[0]:
            m = re.search(rb"X-GM-THRID (\d+)", dados[0])
            if m:
                return format(int(m.group(1)), "x")
    except Exception:
        pass
    return ""


def identificadores_atuais():
    if not os.path.exists(MANIFESTO):
        return []
    with io.open(MANIFESTO, encoding="utf-8") as f:
        return re.findall(r'"([\w-]+)"', f.read())


def escrever_manifesto(ids):
    # ordena por data e, no mesmo dia, manha antes de tarde
    ids = sorted(set(ids), key=lambda i: (i[:10], i.endswith("-tarde")))
    linhas = ",\n".join('  "%s"' % i for i in ids)
    conteudo = (
        u"// Gerado por scripts/sync_gmail.py — nao edite a mao.\n"
        u"// Identificadores: AAAA-MM-DD (manha) e AAAA-MM-DD-tarde (tarde).\n"
        u"window.PAUTAS_DIAS = [\n%s\n];\n" % linhas
    )
    with io.open(MANIFESTO, "w", encoding="utf-8") as f:
        f.write(conteudo)


def processar(imap, assunto, turno_padrao, existentes, novos):
    ok, resposta = imap.search(None, 'HEADER SUBJECT "%s"' % assunto)
    if ok != "OK":
        log("  aviso: busca por '%s' falhou" % assunto)
        return
    numeros = resposta[0].split()
    log("  '%s': %d rascunho(s)" % (assunto, len(numeros)))

    for num in numeros:
        ok, dados = imap.fetch(num, "(RFC822)")
        if ok != "OK" or not dados or not isinstance(dados[0], tuple):
            continue
        msg = email.message_from_bytes(dados[0][1])
        texto = corpo_texto(msg)

        achado = BLOCO.search(texto)
        if not achado:
            continue  # versao antiga da rotina, sem bloco de dados

        try:
            # strict=False tolera quebra de linha literal dentro de um texto,
            # coisa que o modelo as vezes escreve no lugar de \n
            pauta = json.loads(achado.group(1).strip(), strict=False)
        except ValueError as e:
            log("    JSON invalido em um rascunho, ignorado: %s" % e)
            continue

        data = pauta.get("data", "")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", data):
            log("    campo 'data' invalido (%r), ignorado" % data)
            continue

        turno = (pauta.get("turno") or turno_padrao).lower()
        turno = "tarde" if turno.startswith("tarde") else "manha"
        ident = data + ("-tarde" if turno == "tarde" else "")

        if ident in existentes:
            continue

        thrid = thread_id(imap, num)
        if thrid:
            pauta["gmail_thread"] = thrid
        if turno == "tarde":
            pauta["turno"] = "tarde"

        caminho = os.path.join(DIR_DIAS, ident + ".js")
        with io.open(caminho, "w", encoding="utf-8") as f:
            f.write(u"registrarPauta(" + json.dumps(pauta, ensure_ascii=False, indent=2) + u");\n")

        existentes.add(ident)
        novos.append((ident, len(pauta.get("itens") or [])))
        log("    + %s (%d itens)" % (ident, len(pauta.get("itens") or [])))


def main():
    if not os.path.isdir(DIR_DIAS):
        os.makedirs(DIR_DIAS)

    existentes = set(identificadores_atuais())
    log("Ja no dashboard: %d pauta(s)" % len(existentes))

    imap = conectar()
    novos = []
    try:
        pasta = pasta_rascunhos(imap)
        log("Pasta de rascunhos: %s" % pasta)
        ok, _ = imap.select(pasta, readonly=True)
        if ok != "OK":
            sys.exit("ERRO: nao consegui abrir a pasta de rascunhos %s" % pasta)
        for assunto, turno in ASSUNTOS:
            processar(imap, assunto, turno, existentes, novos)
    finally:
        try:
            imap.close()
        except Exception:
            pass
        imap.logout()

    if novos:
        escrever_manifesto(existentes)
        log("Novidades: " + ", ".join("%s (%d itens)" % n for n in novos))
    else:
        log("Nenhuma pauta nova.")

    # deixa o resultado disponivel para o GitHub Actions
    saida = os.environ.get("GITHUB_OUTPUT")
    if saida:
        with io.open(saida, "a", encoding="utf-8") as f:
            f.write(u"novas=%d\n" % len(novos))


if __name__ == "__main__":
    main()
