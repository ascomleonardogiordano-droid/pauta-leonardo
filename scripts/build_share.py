# -*- coding: utf-8 -*-
"""
Gera as versoes compartilhaveis do dashboard a partir de index.html + data/.

Saidas (em dist/):
  dashboard-completo.html  -> arquivo unico, abre em qualquer celular/navegador,
                              bom para mandar por WhatsApp/e-mail.
  artifact.html            -> mesmo conteudo sem doctype/html/head/body,
                              formato exigido pela ferramenta Artifact.

Uso:  python scripts/build_share.py
"""
import io, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def ler(caminho):
    with io.open(caminho, encoding="utf-8") as f:
        return f.read()

def main():
    html = ler(os.path.join(RAIZ, "index.html"))

    manifesto = ler(os.path.join(RAIZ, "data", "manifest.js"))
    datas = re.findall(r'"(\d{4}-\d{2}-\d{2})"', manifesto)
    if not datas:
        sys.exit("Nenhuma data encontrada em data/manifest.js")

    dias = []
    for d in datas:
        caminho = os.path.join(RAIZ, "data", "dias", d + ".js")
        if not os.path.exists(caminho):
            print("  aviso: %s listado no manifesto mas sem arquivo — ignorado" % d)
            continue
        dias.append(ler(caminho))

    # 1) tira o <script src> do manifesto (os dados vao embutidos)
    html = html.replace('<script src="data/manifest.js"></script>\n', "")

    # 2) carregar() dinamico da erro em arquivo unico; os dados chamam iniciar() sozinhos
    html = html.replace("\ncarregar();\n", "\n")

    # 3) injeta os dados depois do script principal
    dados = "<script>\n" + "\n".join(dias) + "\niniciar();\n</script>\n"
    html = html.replace("</body>", dados + "</body>")

    dist = os.path.join(RAIZ, "dist")
    if not os.path.isdir(dist):
        os.makedirs(dist)

    completo = os.path.join(dist, "dashboard-completo.html")
    with io.open(completo, "w", encoding="utf-8") as f:
        f.write(html)

    # versao Artifact: so o miolo (a plataforma envolve com doctype/head/body)
    estilo = re.search(r"<style>.*?</style>", html, re.S).group(0)
    corpo = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    artifact = os.path.join(dist, "artifact.html")
    with io.open(artifact, "w", encoding="utf-8") as f:
        f.write("<title>Pauta Diária — Leonardo Giordano</title>\n" + estilo + "\n" + corpo)

    print("ok: %d dia(s) embutidos" % len(dias))
    print("  " + completo)
    print("  " + artifact)

if __name__ == "__main__":
    main()
