/**
 * Despertador da pauta — Cloudflare Worker.
 *
 * Faz uma coisa só: de hora em hora, manda o GitHub executar o workflow
 * "Atualizar pauta", que lê os rascunhos do Gmail e commita as pautas novas.
 *
 * Por que ele existe: o cron do GitHub Actions não dispara de forma confiável
 * nesta conta — houve dias com zero execuções. Quando o workflow roda, porém,
 * ele funciona sempre. Então o que faltava era um despertador externo, e não
 * um leitor novo.
 *
 * Variáveis (configuradas no painel do Cloudflare):
 *   GITHUB_TOKEN  secreta — token do GitHub com permissão de Actions (escrita)
 *   REPO          texto  — ascomleonardogiordano-droid/pauta-leonardo
 *   WORKFLOW      texto  — atualizar-pauta.yml
 */

const RAMO = "main";

async function dispararWorkflow(env) {
  const repo = env.REPO;
  const workflow = env.WORKFLOW || "atualizar-pauta.yml";
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // o GitHub recusa requisições sem User-Agent
      "User-Agent": "despertador-pauta",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: RAMO }),
  });

  // 204 é o sucesso esperado deste endpoint: aceito, sem corpo de resposta
  if (resposta.status === 204) return { ok: true, status: 204 };

  const corpo = await resposta.text();
  return { ok: false, status: resposta.status, corpo: corpo.slice(0, 300) };
}

export default {
  // chamado pelo agendador do Cloudflare
  async scheduled(evento, env, ctx) {
    const r = await dispararWorkflow(env);
    if (r.ok) {
      console.log("Workflow disparado com sucesso.");
    } else {
      // aparece em Workers → Logs, no painel do Cloudflare
      console.error(`Falha ao disparar: HTTP ${r.status} — ${r.corpo}`);
    }
  },

  // abrir a URL do Worker no navegador mostra o estado, sem disparar nada.
  // Deixar o disparo aberto na web daria a qualquer pessoa o poder de acionar
  // a automação; para forçar uma atualização, use Actions → Run workflow.
  async fetch(request, env) {
    const configurado = Boolean(env.GITHUB_TOKEN) && Boolean(env.REPO);
    const texto = [
      "Despertador da pauta — Leonardo Giordano",
      "",
      configurado
        ? `Configurado. Repositório: ${env.REPO}`
        : "ATENÇÃO: falta configurar GITHUB_TOKEN e/ou REPO nas variáveis do Worker.",
      "",
      "Este endereço não dispara nada — ele só informa.",
      "O disparo acontece pelo agendamento (Cron Triggers).",
      "Para forçar agora: GitHub → Actions → Atualizar pauta → Run workflow.",
    ].join("\n");

    return new Response(texto, {
      status: configurado ? 200 : 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
