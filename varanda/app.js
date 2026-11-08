/* Varanda — protótipo. JS puro, sem dependências, sem rede.
   Todo o estado fica no localStorage deste navegador. */
(function () {
  'use strict';
  var KEY = 'varanda.v1';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var ago = function (h) { return new Date(Date.now() - h * 3600e3).toISOString(); };
  var uid = function () { return 'x' + Math.random().toString(36).slice(2, 9); };

  /* ---------- fotos e vídeos ----------
     Ficam no IndexedDB deste aparelho (o localStorage é pequeno demais).
     Fotos são redimensionadas e reencodadas: isso remove localização e outros metadados (EXIF).
     Vídeos entram como estão. Nada sobe para servidor. */
  var MAX_VIDEO = 25 * 1024 * 1024, MAX_ANEXOS = 4;
  var dbp = null, mem = {}, urlCache = {}, anexos = [];
  function db() {
    if (!dbp) dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('varanda-midia', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('m'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(modo, fn) {
    return db().then(function (d) {
      if (!d) { var o = fn(null); return o && o.result !== undefined ? o.result : o; }
      return new Promise(function (res) {
        try { var t = d.transaction('m', modo); var out = fn(t.objectStore('m')); t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = t.onabort = function () { res(null); }; }
        catch (e) { res(null); }
      });
    });
  }
  function midiaPut(id, blob) { return tx('readwrite', function (st) { if (!st) { mem[id] = blob; return true; } return st.put(blob, id); }); }
  function midiaGet(id) { return tx('readonly', function (st) { return st ? st.get(id) : { result: mem[id] || null }; }); }
  function midiaDel(id) { delete urlCache[id]; delete mem[id]; return tx('readwrite', function (st) { return st ? st.delete(id) : true; }); }
  function midiaLimpa() { urlCache = {}; mem = {}; return tx('readwrite', function (st) { return st ? st.clear() : true; }); }
  function lerDataURL(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(); }; r.readAsDataURL(blob); });
  }
  function reduzirImagem(file) {
    return lerDataURL(file).then(function (src) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', 0.85);
        };
        im.onerror = function () { rej(); };
        im.src = src;
      });
    });
  }
  function urlMidia(id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return midiaGet(id).then(function (b) { return b ? lerDataURL(b) : null; }).then(function (u) { if (u) urlCache[id] = u; return u; });
  }
  function tam(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function campoMidia() {
    return '<div class="midia-campo"><label class="btn" for="arq">📷 Foto ou vídeo</label>' +
      '<input class="sr" type="file" id="arq" accept="image/*,video/*" multiple>' +
      '<span class="meta">Até ' + MAX_ANEXOS + ' arquivos; vídeo até 25 MB. Nada começa a tocar sozinho.</span>' +
      '<div id="previas">' + htmlPrevias() + '</div></div>';
  }
  function htmlPrevias() {
    return anexos.map(function (a, i) {
      return '<div class="previa">' + (a.tipo === 'imagem' ? '<img src="' + a.prev + '" alt="">' : '<span class="vid-ico" aria-hidden="true">🎬</span>') +
        '<div class="previa-info"><span class="meta" style="margin:0">' + esc(a.nome) + ' · ' + tam(a.blob.size) + '</span>' +
        '<input type="text" data-alt="' + i + '" maxlength="140" placeholder="Descreva para quem não enxerga (opcional)" value="' + esc(a.alt) + '" aria-label="Descrição do arquivo ' + (i + 1) + '">' +
        '<button type="button" class="link" data-rm="' + i + '">remover</button></div></div>';
    }).join('');
  }
  function hidratarMidia() {
    [].forEach.call(document.querySelectorAll('.m[data-mid]'), function (el) {
      urlMidia(el.getAttribute('data-mid')).then(function (u) {
        if (!document.body.contains(el)) return;
        if (!u) { el.innerHTML = '<span class="vazio">Mídia indisponível neste aparelho.</span>'; return; }
        var alt = el.getAttribute('data-alt') || '';
        if (el.getAttribute('data-tipo') === 'video') {
          var v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.src = u; v.setAttribute('aria-label', alt || 'Vídeo'); el.textContent = ''; el.appendChild(v);
        } else {
          var im = document.createElement('img'); im.src = u; im.alt = alt; im.loading = 'lazy'; el.textContent = ''; el.appendChild(im);
        }
      });
    });
  }
  function adicionarArquivos(lista) {
    var seq = Promise.resolve();
    [].forEach.call(lista, function (f) {
      seq = seq.then(function () {
        if (anexos.length >= MAX_ANEXOS) { avisar('Máximo de ' + MAX_ANEXOS + ' arquivos por publicação.'); return; }
        if (f.type.indexOf('video/') === 0) {
          if (f.size > MAX_VIDEO) { avisar('Vídeo grande demais (' + tam(f.size) + '). O limite do protótipo é 25 MB.'); return; }
          anexos.push({ id: uid(), tipo: 'video', blob: f, nome: f.name || 'vídeo', alt: '' });
        } else if (f.type.indexOf('image/') === 0) {
          return reduzirImagem(f).then(function (b) { return lerDataURL(b).then(function (u) { anexos.push({ id: uid(), tipo: 'imagem', blob: b, nome: f.name || 'foto', alt: '', prev: u }); }); },
            function () { avisar('Não consegui abrir essa imagem. Tente JPG ou PNG.'); });
        } else avisar('Só foto e vídeo, por enquanto.');
      });
    });
    return seq.then(function () { var pv = $('#previas'); if (pv) pv.innerHTML = htmlPrevias(); });
  }

  /* ---------- dados de demonstração (fictícios) ---------- */
  function seed() {
    return {
      v: 1,
      eu: 'voce',
      lastVisit: ago(48),
      ritmo: { modo: 'off', horarios: ['08:00', '12:30', '19:00'], porPagina: 5 },
      users: {
        voce: { id: 'voce', nome: 'Você', ico: '🙂', cor: '#f4c95d', humor: 'tranquilo', trilha: 'Uma fita K7 que você ainda não achou', sobre: 'Escrevendo minha própria história, uma lembrança por vez.' },
        marina: { id: 'marina', nome: 'Marina', ico: '🎨', cor: '#f08a8a', humor: 'criativa', trilha: 'Trilha de abertura de anime, em loop', sobre: 'Ilustradora. Guardo caderno de espiral desde 2003.' },
        rafa: { id: 'rafa', nome: 'Rafa', ico: '🎧', cor: '#8ad0f0', humor: 'saudosista', trilha: 'MTV Hits, lado B', sobre: 'DJ de fim de semana. Vinil, fita e conversa.' },
        bia: { id: 'bia', nome: 'Bia', ico: '📚', cor: '#b9e28a', humor: 'curiosa', trilha: 'Playlist de estudo, sem letra', sobre: 'Professora. Cresci no Orkut e não me arrependo.' },
        caio: { id: 'caio', nome: 'Caio', ico: '🛠️', cor: '#d6b3f0', humor: 'prático', trilha: 'Rock nacional dos anos 2000', sobre: 'Dev. Conserto coisas e organizo a rua.' }
      },
      grupos: [
        { id: 'g1', nome: 'Turma do Digimon & Cia', desc: 'Desenho, anime, TV a cabo e tarde de domingo.', membros: ['voce', 'marina', 'rafa', 'bia'] },
        { id: 'g2', nome: 'Vizinhança — Rua da Padaria', desc: 'Recados úteis e encontros de quem mora perto.', membros: ['voce', 'caio', 'bia'] },
        { id: 'g3', nome: 'Sábado de Vinil', desc: 'Discos, fitas e quem leva o quê.', membros: ['rafa', 'marina', 'caio'] }
      ],
      posts: [
        { id: 'p1', tipo: 'mural', autor: 'marina', vis: 'publico', texto: 'Terminei a ilustração que comecei em um caderno de espiral lá atrás. Ficou do jeito que eu imaginava. 🎨', data: ago(5), abracos: ['bia', 'rafa'], respostas: [{ autor: 'bia', texto: 'Quero ver ao vivo, traz no sábado?', data: ago(4) }] },
        { id: 'p2', tipo: 'mural', autor: 'rafa', vis: 'grupo', grupo: 'g3', texto: 'Sábado tem sessão de MTV Hits em vinil e fita. Levem lembranças, deixem o celular na bolsa.', data: ago(9), abracos: ['marina'], respostas: [] },
        { id: 'p3', tipo: 'mural', autor: 'bia', vis: 'grupo', grupo: 'g1', texto: 'Alguém lembra da abertura do Digimon em português? Não saiu da minha cabeça desde ontem.', data: ago(20), abracos: ['voce', 'marina'], respostas: [{ autor: 'marina', texto: 'Eu sei até a pausa antes do refrão.', data: ago(18) }, { autor: 'rafa', texto: 'Cantei no chuveiro hoje. Sem vergonha.', data: ago(17) }] },
        { id: 'p4', tipo: 'mural', autor: 'caio', vis: 'grupo', grupo: 'g2', texto: 'A rua da padaria está sem luz desde cedo. Alguém já avisou a concessionária?', data: ago(26), abracos: [], respostas: [{ autor: 'bia', texto: 'Liguei agora, protocolo anotado. Mando no grupo.', data: ago(25) }] },
        { id: 'p5', tipo: 'mural', autor: 'voce', vis: 'publico', texto: 'Abri a Varanda. A ideia é simples: um lugar para estar, não para ser puxado pra baixo o dia todo.', data: ago(30), abracos: ['marina', 'bia'], respostas: [{ autor: 'marina', texto: 'Já gostei de saber que tem fim de página.', data: ago(29) }] },
        { id: 'p6', tipo: 'mural', autor: 'bia', vis: 'publico', texto: 'Domingo, tarde chuvosa, chá e álbum de fotos antigo. Recomendo.', data: ago(50), abracos: ['rafa'], respostas: [] },
        { id: 'p7', tipo: 'mural', autor: 'marina', vis: 'grupo', grupo: 'g1', texto: 'Fiz um desenho do meu primeiro digimon favorito. Posto aqui só pra turma por enquanto.', data: ago(55), abracos: ['bia'], respostas: [] },
        { id: 'p8', tipo: 'mural', autor: 'rafa', vis: 'publico', texto: 'Achei uma fita K7 gravada do rádio em 1998, com a voz do locutor no começo. Estou emocionado.', data: ago(72), abracos: ['voce', 'marina', 'bia'], respostas: [] },
        { id: 'p9', tipo: 'mural', autor: 'caio', vis: 'publico', texto: 'Sábado de manhã a rua faz mutirão para limpar o bueiro. Quem puder, apareça.', data: ago(80), abracos: [], respostas: [] },
        { id: 'p10', tipo: 'mural', autor: 'bia', vis: 'grupo', grupo: 'g2', texto: 'Quem quer dividir uma compra de cadeiras de praia para a calçada? Tarde de domingo merece.', data: ago(100), abracos: ['caio'], respostas: [] },
        { id: 'p11', tipo: 'mural', autor: 'voce', vis: 'privado', texto: 'Anotação só minha: lembrar de ligar para a tia e de procurar aquela foto da formatura.', data: ago(110), abracos: [], respostas: [] },
        { id: 'm1', tipo: 'memoria', autor: 'voce', vis: 'privado', titulo: 'O primeiro perfil que eu tive', ano: '2005', texto: 'Passei uma semana escolhendo a foto e a música do perfil. Parecia a coisa mais importante do mundo, e de certo modo era: era o meu canto.', data: ago(300), abracos: [], respostas: [] },
        { id: 'm2', tipo: 'memoria', autor: 'voce', vis: 'grupo', grupo: 'g1', titulo: 'Domingo à tarde com a TV ligada', ano: '1999', texto: 'Voltar da casa da avó, sentar no chão da sala e ficar até o último episódio. Ninguém olhava para o relógio.', data: ago(400), abracos: [], respostas: [] },
        { id: 'm3', tipo: 'memoria', autor: 'voce', vis: 'publico', titulo: 'Cartas, bilhetes e recados', ano: '2002', texto: 'Guardo uma caixa de sapato com bilhetes de colégio. Alguns eu não consigo mais ler sem sorrir.', data: ago(500), abracos: [], respostas: [] },
        { id: 'm4', tipo: 'memoria', autor: 'marina', vis: 'publico', titulo: 'Meu caderno de espiral', ano: '2003', texto: 'Cada página era um mundo. Eu desenhava na aula e achava que ninguém via.', data: ago(310), abracos: [], respostas: [] }
      ],
      depoimentos: [
        { id: 'd1', para: 'voce', de: 'marina', texto: 'Pessoa que lembra de tudo e nunca te faz sentir velha por lembrar.', aprovado: true, data: ago(200) },
        { id: 'd2', para: 'voce', de: 'rafa', texto: 'Tem sempre uma história boa e um lugar na mesa. Dez de dez.', aprovado: false, data: ago(10) },
        { id: 'd3', para: 'marina', de: 'bia', texto: 'Desenha o que a gente só consegue sentir.', aprovado: true, data: ago(220) }
      ]
    };
  }

  var S;
  var slideIdx = 0, pagina = 1, pend = null, mostrarJson = false, toastT = null;
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { S = JSON.parse(r); return; } } catch (e) { /* sem storage: segue em memória */ }
    S = seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sem storage */ } }

  /* ---------- regras de visibilidade (o coração do protótipo) ---------- */
  function grupo(id) { return S.grupos.filter(function (g) { return g.id === id; })[0]; }
  function membro(gid, u) { var g = grupo(gid); return !!g && g.membros.indexOf(u) >= 0; }
  function pode(p, viewer) {
    if (p.autor === viewer) return true;
    if (p.vis === 'publico') return true;
    if (p.vis === 'grupo') return membro(p.grupo, viewer);
    return false; // privado
  }
  var VIS = { privado: ['só eu', 'pri'], grupo: ['círculo', 'grp'], publico: ['público', 'pub'] };
  function tagVis(p) {
    var v = VIS[p.vis];
    var nome = p.vis === 'grupo' && grupo(p.grupo) ? 'círculo: ' + grupo(p.grupo).nome : v[0];
    return '<span class="tag ' + v[1] + '">' + esc(nome) + '</span>';
  }

  /* ---------- utilidades de interface ---------- */
  function quando(iso) {
    var d = new Date(iso), h = (Date.now() - d.getTime()) / 3600e3;
    if (h < 1) return 'agora há pouco';
    if (h < 24) return 'há ' + Math.floor(h) + ' h';
    if (h < 48) return 'ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  function av(u) { var p = S.users[u]; return '<span class="avatar" style="background:' + esc(p.cor) + '" aria-hidden="true">' + esc(p.ico) + '</span>'; }
  function autorLink(u) { return '<a class="autor" href="#perfil-' + esc(u) + '">' + av(u) + esc(S.users[u].nome) + '</a>'; }
  function fim(msg) { return '<div class="fim"><strong>Por hoje é só.</strong>' + esc(msg || 'Você viu tudo desta página. Respire, tome uma água, volte quando quiser.') + '</div>'; }

  function opcoesVis(sel) {
    var meus = S.grupos.filter(function (g) { return membro(g.id, S.eu); });
    var o = '<option value="publico">Público (qualquer pessoa na Varanda)</option><option value="privado">Só eu</option>';
    meus.forEach(function (g) { o += '<option value="grupo:' + g.id + '">Círculo: ' + esc(g.nome) + '</option>'; });
    return o;
  }

  function cartao(p, opts) {
    opts = opts || {};
    var mine = p.autor === S.eu;
    var ab = p.abracos.indexOf(S.eu) >= 0;
    var h = '<article class="card" id="' + esc(p.id) + '">';
    h += '<div class="meta">' + autorLink(p.autor) + ' · ' + quando(p.data) + ' · ' + tagVis(p) + (p.ano ? ' · <span class="tag">lembrança de ' + esc(p.ano) + '</span>' : '') + '</div>';
    if (p.titulo) h += '<h3>' + esc(p.titulo) + '</h3>';
    if (p.texto) h += '<p class="texto">' + esc(p.texto) + '</p>';
    if (p.midia && p.midia.length) h += '<div class="midia">' + p.midia.map(function (m) { return '<div class="m" data-mid="' + esc(m.id) + '" data-tipo="' + esc(m.tipo) + '" data-alt="' + esc(m.alt) + '"><span class="vazio">Carregando…</span></div>'; }).join('') + '</div>';
    h += '<div class="linha">';
    if (!mine) h += '<button data-abraco="' + esc(p.id) + '" aria-pressed="' + ab + '" title="Só quem escreveu vê que você mandou.">🤗 ' + (ab ? 'Abraço enviado' : 'Mandar um abraço') + '</button>';
    else h += '<span class="meta" style="margin:0">' + (p.abracos.length ? '🤗 ' + p.abracos.length + ' abraço(s) — só você vê esse número' : 'Nenhum abraço ainda') + '</span>';
    if (mine && !opts.semApagar) {
      if (pend === 'del:' + p.id) h += '<span class="meta" style="margin:0">Apagar de vez?</span> <button data-apagar-sim="' + esc(p.id) + '">Sim, apagar</button> <button class="link" data-nao="1">Não</button>';
      else h += '<button class="link" data-apagar="' + esc(p.id) + '">apagar</button>';
    }
    h += '</div>';
    p.respostas.forEach(function (r) {
      h += '<div class="resp"><strong>' + esc(S.users[r.autor].nome) + '</strong> <small>' + quando(r.data) + '</small><br>' + esc(r.texto) + '</div>';
    });
    h += '<form class="linha" data-resp="' + esc(p.id) + '" style="margin-top:10px"><input type="text" name="t" placeholder="Responder com calma…" maxlength="400" aria-label="Responder"><button>Responder</button></form>';
    return h + '</article>';
  }

  function compositor(rotulo, visPadrao) {
    return '<form class="card" id="novo"><h2>' + esc(rotulo) + '</h2>' +
      '<label class="campo">O que você quer guardar ou compartilhar?<textarea name="texto" maxlength="1200"></textarea></label>' + campoMidia() +
      '<label class="campo">Quem pode ver?<select name="vis">' + opcoesVis() + '</select></label>' +
      '<div id="extra"></div>' +
      '<button class="pri">Publicar</button> <span class="meta" id="hint">A escolha de visibilidade vale só para esta publicação.</span></form>';
  }

  /* ---------- telas ---------- */
  var ROTAS = [
    ['praca', 'Praça'], ['grupos', 'Círculos'], ['diario', 'Meu diário'], ['cartinha', 'Cartinha do dia'],
    ['ritmo', 'Ritmo'], ['dados', 'Meus dados'], ['porque', 'Por que é assim']
  ];

  function telaPraca() {
    var por = S.ritmo.porPagina;
    var todos = S.posts.filter(function (p) { return p.tipo === 'mural' && pode(p, S.eu); })
      .sort(function (a, b) { return b.data.localeCompare(a.data); });
    var pags = Math.max(1, Math.ceil(todos.length / por));
    pagina = Math.min(pags, Math.max(1, pagina));
    var fatia = todos.slice((pagina - 1) * por, pagina * por);
    var h = '<h1>Praça</h1><p class="sub">Em ordem cronológica, sem algoritmo escolhendo por você. Arraste para o lado: cada passo é uma pessoa, e o caminho tem fim.</p>';
    h += compositor('Escrever na praça');
    h += '<section class="carrossel" aria-roledescription="carrossel" aria-label="Publicações da praça"><div class="ctrl"><button data-slide="-1" aria-label="Publicação anterior">←</button><span id="pos" class="meta" aria-live="polite">1 de ' + (fatia.length + 1) + '</span><button data-slide="1" aria-label="Próxima publicação">→</button></div>';
    h += '<div class="trilho" id="trilho" tabindex="0" role="group" aria-label="Passe para o lado para ver mais">';
    fatia.forEach(function (p) { h += '<div class="slide">' + cartao(p) + '</div>'; });
    h += '<div class="slide">' + (pagina === pags ? fim('Você chegou ao começo da conversa. Não existe “carregar mais” nesta casa.') : fim()) +
      '<div class="linha" style="justify-content:center">' +
      (pagina > 1 ? '<button data-pag="-1">← Voltar às mais novas</button>' : '') +
      (pagina < pags ? '<button class="pri" data-pag="1">Ver as mais antigas →</button>' : '') + '</div>' +
      '<p class="meta" style="text-align:center">Página ' + pagina + ' de ' + pags + '</p></div>';
    return h + '</div></section>';
  }

  function telaGrupos() {
    var h = '<h1>Círculos</h1><p class="sub">Grupos pequenos, de bairro, de fandom, de turma. Quem escreve num círculo escolhe esse público.</p><div class="grid">';
    S.grupos.forEach(function (g) {
      var dentro = membro(g.id, S.eu);
      h += '<div class="card"><h2>' + esc(g.nome) + '</h2><p>' + esc(g.desc) + '</p><p class="meta">' + g.membros.length + ' pessoas: ' +
        g.membros.map(function (m) { return esc(S.users[m].nome); }).join(', ') + '</p>' +
        (dentro ? '<a class="btn pri" href="#grupo-' + esc(g.id) + '">Abrir círculo</a>' : '<button data-entrar="' + esc(g.id) + '">Pedir para entrar (demo: entra direto)</button>') + '</div>';
    });
    h += '</div><form class="card" id="novoGrupo"><h2>Criar um círculo</h2><label class="campo">Nome<input type="text" name="nome" maxlength="60" required></label><label class="campo">Descrição<input type="text" name="desc" maxlength="140"></label><button class="pri">Criar</button></form>';
    return h;
  }

  function telaGrupo(id) {
    var g = grupo(id);
    if (!g) return '<p class="vazio">Círculo não encontrado.</p>';
    if (!membro(id, S.eu)) return '<div class="card"><h2>' + esc(g.nome) + '</h2><p>Este círculo é fechado. Peça para entrar na tela de Círculos.</p></div>';
    var lista = S.posts.filter(function (p) { return p.vis === 'grupo' && p.grupo === id; }).sort(function (a, b) { return b.data.localeCompare(a.data); });
    var h = '<h1>' + esc(g.nome) + '</h1><p class="sub">' + esc(g.desc) + '</p>';
    h += '<form class="card" id="novoNoGrupo" data-g="' + esc(id) + '"><label class="campo">Escrever para o círculo<textarea name="texto" maxlength="1200"></textarea></label>' + campoMidia() + '<button class="pri">Publicar no círculo</button></form>';
    if (!lista.length) h += '<p class="vazio">Nada por aqui ainda.</p>';
    lista.forEach(function (p) { h += cartao(p); });
    return h + fim('Não há mais nada neste círculo.');
  }

  function telaDiario() {
    var minhas = S.posts.filter(function (p) { return p.tipo === 'memoria' && p.autor === S.eu; }).sort(function (a, b) { return a.ano.localeCompare(b.ano); });
    var h = '<h1>Meu diário</h1><p class="sub">Sua linha do tempo, na ordem da vida e não da última hora. Cada lembrança tem sua própria porta: só você, um círculo ou todo mundo.</p>';
    h += '<form class="card" id="novaMemoria"><h2>Guardar uma lembrança</h2>' +
      '<label class="campo">Título<input type="text" name="titulo" maxlength="80" required></label>' +
      '<label class="campo">Ano (ou época)<input type="text" name="ano" maxlength="9" placeholder="ex.: 2004" required></label>' +
      '<label class="campo">A história<textarea name="texto" maxlength="1500" required></textarea></label>' + campoMidia() +
      '<label class="campo">Quem pode ver?<select name="vis">' + opcoesVis() + '</select></label>' +
      '<button class="pri">Guardar</button></form>';
    if (!minhas.length) h += '<p class="vazio">Seu diário ainda está em branco.</p>';
    minhas.forEach(function (p) { h += cartao(p); });
    return h;
  }

  function telaPerfil(id) {
    var u = S.users[id];
    if (!u) return '<p class="vazio">Pessoa não encontrada.</p>';
    var meu = id === S.eu;
    var h = '<div class="card"><div class="perfil-topo">' + av(id).replace('class="avatar"', 'class="avatar" ') +
      '<div><h1 style="margin:0">' + esc(u.nome) + '</h1><div class="meta">humor: ' + esc(u.humor) + '</div></div></div>' +
      '<p>' + esc(u.sobre) + '</p><div class="trilha">🎵 Trilha do momento: ' + esc(u.trilha) + '</div></div>';
    if (meu) {
      h += '<form class="card" id="editarPerfil"><h2>Meu cantinho</h2><label class="campo">Humor<input type="text" name="humor" value="' + esc(u.humor) + '" maxlength="30"></label>' +
        '<label class="campo">Trilha do momento<input type="text" name="trilha" value="' + esc(u.trilha) + '" maxlength="80"></label>' +
        '<label class="campo">Sobre mim<textarea name="sobre" maxlength="240">' + esc(u.sobre) + '</textarea></label><button>Salvar</button></form>';
    }
    var cs = S.grupos.filter(function (g) { return membro(g.id, id); });
    h += '<div class="card"><h2>Círculos</h2>' + (cs.length ? cs.map(function (g) { return '<span class="tag grp">' + esc(g.nome) + '</span> '; }).join('') : '<span class="vazio">Nenhum.</span>') + '</div>';
    var mem = S.posts.filter(function (p) { return p.tipo === 'memoria' && p.autor === id && pode(p, S.eu); });
    h += '<div class="card"><h2>Lembranças que posso ver</h2>' + (mem.length ? '<ul>' + mem.map(function (p) { return '<li>' + esc(p.ano) + ' — ' + esc(p.titulo) + ' ' + tagVis(p) + '</li>'; }).join('') + '</ul>' : '<span class="vazio">Nada visível para você.</span>') + '</div>';
    var deps = S.depoimentos.filter(function (d) { return d.para === id && (d.aprovado || meu); });
    h += '<div class="card"><h2>Depoimentos</h2>';
    if (!deps.length) h += '<span class="vazio">Nenhum depoimento ainda.</span>';
    deps.forEach(function (d) {
      h += '<div class="resp"><strong>' + esc(S.users[d.de].nome) + '</strong> <small>' + quando(d.data) + '</small><br>' + esc(d.texto) +
        (!d.aprovado ? '<br><span class="tag pri">aguardando sua aprovação</span> <button class="link" data-aprovar="' + esc(d.id) + '">aprovar</button> <button class="link" data-recusar="' + esc(d.id) + '">recusar</button>' : '') + '</div>';
    });
    if (!meu) h += '<form class="linha" data-dep="' + esc(id) + '" style="margin-top:10px"><input type="text" name="t" placeholder="Deixe um depoimento (a pessoa aprova antes de aparecer)" maxlength="240"><button>Enviar</button></form>';
    return h + '</div>';
  }

  function telaCartinha() {
    var desde = S.lastVisit;
    var itens = [];
    S.posts.forEach(function (p) {
      if (p.autor === S.eu) {
        p.respostas.forEach(function (r) { if (r.autor !== S.eu && r.data > desde) itens.push({ d: r.data, t: S.users[r.autor].nome + ' respondeu: “' + r.texto + '”' }); });
      } else if (p.tipo === 'mural' && pode(p, S.eu) && p.data > desde && (p.vis === 'grupo')) {
        itens.push({ d: p.data, t: S.users[p.autor].nome + ' escreveu no círculo ' + grupo(p.grupo).nome + '.' });
      }
    });
    S.depoimentos.forEach(function (d) { if (d.para === S.eu && !d.aprovado) itens.push({ d: d.data, t: S.users[d.de].nome + ' deixou um depoimento esperando sua aprovação.' }); });
    itens.sort(function (a, b) { return a.d.localeCompare(b.d); });
    var h = '<h1>Cartinha do dia</h1><p class="sub">Tudo o que aconteceu desde a sua última passada, reunido num só lugar, uma vez. É o contrário de um alerta a cada curtida.</p><div class="card">';
    h += itens.length ? '<ul>' + itens.map(function (i) { return '<li>' + esc(i.t) + ' <span class="meta">' + quando(i.d) + '</span></li>'; }).join('') + '</ul>' : '<p class="vazio">Nada novo. Você está em dia.</p>';
    h += '<button class="pri" data-lido="1">Marcar como lido</button></div>';
    h += '<div class="card suave"><strong>Seu ritmo atual:</strong> ' + esc(textoRitmo()) + ' <a href="#ritmo">mudar</a></div>';
    return h + fim('Isso é tudo. Nenhuma outra coisa está esperando por você aqui.');
  }

  function textoRitmo() {
    var r = S.ritmo;
    if (r.modo === 'off') return 'sem avisos. Você decide quando olhar.';
    if (r.modo === 'tres') return 'três avisos por dia (' + r.horarios.join(', ') + ').';
    return 'um resumo por dia, às ' + r.horarios[2] + '.';
  }

  function telaRitmo() {
    var r = S.ritmo;
    function opt(v, tit, desc) { return '<label class="sel"><input type="radio" name="modo" value="' + v + '"' + (r.modo === v ? ' checked' : '') + '><span><strong>' + tit + '</strong><br><span class="meta">' + desc + '</span></span></label>'; }
    var h = '<h1>Ritmo</h1><p class="sub">Aqui é você quem dita o compasso. O padrão é o mais silencioso.</p><form class="card" id="formRitmo"><h2>Avisos</h2>' +
      opt('off', 'Nenhum aviso (padrão)', 'A Varanda nunca te chama. A Cartinha do dia espera quando você abrir.') +
      opt('tres', 'Três horários', 'Manhã, almoço e fim do dia. Fora disso, silêncio.') +
      opt('resumo', 'Um resumo por dia', 'Uma cartinha só, no fim do dia.') +
      '<div class="linha" style="margin:8px 0">' + [0, 1, 2].map(function (i) { return '<label class="meta">' + ['manhã', 'almoço', 'noite'][i] + ' <input type="time" name="h' + i + '" value="' + r.horarios[i] + '"></label>'; }).join('') + '</div>' +
      '<h2 style="margin-top:14px">Tamanho de cada página</h2><select name="pp">' + [3, 5, 8].map(function (n) { return '<option' + (r.porPagina === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select> publicações. Toda página termina.' +
      '<p><button class="pri">Salvar ritmo</button> <span class="meta" id="salvo"></span></p></form>' +
      '<div class="card suave"><h2>Regras fixas (não ficam à escolha de ninguém)</h2><ul>' +
      '<li>Não existe rolagem infinita: toda lista tem fim.</li><li>Não existe contador público de curtidas, seguidores ou alcance.</li>' +
      '<li>Abraços só aparecem para quem escreveu.</li><li>A ordem é sempre cronológica. Nenhum algoritmo escolhe o que você vê.</li>' +
      '<li>Não há anúncios nem rastreadores.</li></ul>' +
      '<p class="meta">Por que fixas: se proteger fosse só uma opção, a responsabilidade cairia sobre cada pessoa. A pesquisa que inspira este protótipo discute justamente isso. Ver “Por que é assim”.</p></div>';
    return h;
  }

  function telaDados() {
    return '<h1>Meus dados</h1><p class="sub">O que existe sobre você e como levar embora ou apagar.</p>' +
      '<div class="card"><h2>O que este protótipo guarda</h2><p>Só o que você escreve aqui, e <strong>apenas neste navegador</strong>. Nenhum servidor recebe nada.</p></div>' +
      '<div class="card"><h2>O que a Varanda não coleta</h2><table><tr><th>Dado</th><th>Coletado?</th></tr>' +
      '<tr><td>Tempo de tela</td><td>Não</td></tr><tr><td>Cliques, rolagem, hesitação</td><td>Não</td></tr><tr><td>Lista de contatos</td><td>Não</td></tr><tr><td>Localização</td><td>Não</td></tr><tr><td>Conteúdo de fotos e vídeos</td><td>Não sai deste aparelho. Fotos perdem localização (EXIF) ao entrar; vídeos mantêm os metadados do arquivo original</td></tr><tr><td>Perfil para anúncios</td><td>Não, não há anúncios</td></tr></table></div>' +
      '<div class="card"><h2>Levar ou apagar</h2><p class="linha"><button data-exportar="1">' + (mostrarJson ? 'Esconder meus dados' : 'Ver meus dados (JSON)') + '</button>' +
      (pend === 'reset' ? '<span class="meta" style="margin:0">Apagar tudo?</span><button data-resetar-sim="1">Sim, apagar tudo</button><button class="link" data-nao="1">Não</button>' : '<button data-resetar="1">Apagar tudo e recomeçar</button>') + '</p>' +
      (mostrarJson ? '<label class="campo" for="json">Seus dados, para copiar e guardar</label><textarea id="json" readonly rows="8"></textarea><button data-copiar="1">Copiar</button>' : '') + '</div>' +
      '<div class="aviso"><strong>Limite honesto:</strong> numa versão com servidor, “não coletar” precisa ser auditável (código aberto, relatório de transparência). Hoje isso é só intenção de projeto.</div>';
  }

  function telaPorque() {
    function q(t, f) { return '<div class="quote">“' + esc(t) + '”<small>' + esc(f) + '</small></div>'; }
    return '<h1>Por que é assim</h1><p class="sub">A pesquisa aplicada à arquitetura. Cada decisão do produto responde a um mecanismo descrito na literatura, e vem marcada pela origem.</p>' +
      '<div class="aviso"><strong>Como ler esta página.</strong> <em>Autor diz</em> = trecho de um texto citado. <em>Proposta</em> = decisão de produto minha, não do autor. As citações vêm do documento de contexto do projeto de mestrado e <strong>não foram conferidas nos originais por quem programou este protótipo</strong>. Confira antes de publicar.</div>' +
      '<div class="card"><h2>1. Plataformas impõem sua lógica</h2>' + q('[…] precisam se sujeitar à sua funcionalidade, à sua lógica de engajamento', 'Bastos, 2022, p. 13 (autor diz)') +
      '<p><strong>Proposta:</strong> a lógica de engajamento é o que a Varanda desliga. Sem feed algorítmico, sem métrica pública, sem notificação de captura.</p></div>' +
      '<div class="card"><h2>2. Falar sem ser ouvido</h2>' + q('um ambiente em que muitos se expressam, e poucos realmente ouvem', 'Cabral Filho, 2021, p. 94 (autor diz)') + q('estar audível não é garantia de ter escuta', 'Tomaz, 2023, p. 11 (autor diz)') +
      '<p><strong>Proposta:</strong> o abraço só é visto por quem escreveu, e a interface empurra para a resposta, não para o número.</p></div>' +
      '<div class="card"><h2>3. Não é só responsabilidade individual</h2><p><strong>Autor diz (projeto):</strong> o design predatório não é problema de responsabilidade individual, é tecnologia de poder. <em>“Design predatório” é termo do autor do projeto, não de um autor citado.</em></p>' +
      '<p><strong>Proposta:</strong> as proteções centrais (fim de página, ordem cronológica, sem contadores) são <strong>regras fixas</strong>. Só o ritmo dos avisos fica à escolha, e o padrão é o silêncio.</p></div>' +
      '<div class="card"><h2>Mecanismo → decisão</h2><table><tr><th>Mecanismo apontado no projeto</th><th>Decisão na Varanda (proposta)</th><th>Onde ver</th></tr>' +
      '<tr><td>Rolagem infinita</td><td>Páginas com fim e mensagem “por hoje é só”</td><td>Praça</td></tr>' +
      '<tr><td>Notificações intermitentes</td><td>Padrão desligado; três horários ou resumo diário, por escolha</td><td>Ritmo, Cartinha</td></tr>' +
      '<tr><td>Recompensa variável</td><td>Sem curtidas públicas; abraço privado</td><td>Qualquer publicação</td></tr>' +
      '<tr><td>Extração de dados comportamentais</td><td>Nenhum rastreio; exportar e apagar tudo</td><td>Meus dados</td></tr>' +
      '<tr><td>(não consta na lista do projeto) vídeo que toca sozinho e engata o próximo</td><td>Proposta minha: nada toca sozinho e não existe “próximo vídeo”</td><td>Qualquer publicação com mídia</td></tr><tr><td>Hipervisibilidade sem escuta</td><td>Círculos pequenos; escolha de público por publicação</td><td>Círculos, Diário</td></tr></table></div>' +
      '<div class="card"><h2>Limites e o que ainda não sabemos</h2><ul>' +
      '<li>A base neurocientífica do projeto trata de <strong>adolescentes</strong>. O público 27+ da Varanda é uma decisão de produto (nostalgia, memória, comunidade), não uma conclusão da neurociência.</li>' +
      '<li>Este protótipo <strong>não prova</strong> que o desenho reduz uso compulsivo. É uma hipótese de design a testar.</li>' +
      '<li>Teste sugerido: grupos pequenos usam por semanas; comparar relato de bem-estar e padrão de volta, com consentimento e sem rastrear conteúdo.</li>' +
      '<li>Risco de produto: sem estímulo, o círculo pode esvaziar. É o problema do “bairro vazio”.</li></ul></div>';
  }

  /* ---------- roteador ---------- */
  function rota() {
    var h = (location.hash || '#praca').slice(1), k = h.indexOf('-');
    return { nome: (k < 0 ? h : h.slice(0, k)) || 'praca', arg: k < 0 ? undefined : h.slice(k + 1) };
  }

  function render() {
    var r = rota(), h = '';
    if (r.nome === 'praca') h = telaPraca();
    else if (r.nome === 'grupos') h = telaGrupos();
    else if (r.nome === 'grupo') h = telaGrupo(r.arg);
    else if (r.nome === 'diario') h = telaDiario();
    else if (r.nome === 'perfil') h = telaPerfil(r.arg || S.eu);
    else if (r.nome === 'cartinha') h = telaCartinha();
    else if (r.nome === 'ritmo') h = telaRitmo();
    else if (r.nome === 'dados') h = telaDados();
    else if (r.nome === 'porque') h = telaPorque();
    else h = telaPraca();
    $('#app').innerHTML = h;
    var ativo = r.nome === 'grupo' ? 'grupos' : r.nome;
    $('#nav').innerHTML = ROTAS.map(function (x) { return '<a href="#' + x[0] + '"' + (x[0] === ativo ? ' class="on" aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') +
      '<a href="#perfil-' + esc(S.eu) + '"' + (r.nome === 'perfil' ? ' class="on"' : '') + '>Meu perfil</a>';
    $('#quem').innerHTML = Object.keys(S.users).map(function (k) { return '<option value="' + k + '"' + (k === S.eu ? ' selected' : '') + '>' + esc(S.users[k].nome) + '</option>'; }).join('');
    if (r.nome === 'dados' && mostrarJson) { var ta = $('#json'); if (ta) ta.value = JSON.stringify(S, null, 2); }
    if (r.nome === 'praca') ligarCarrossel();
    hidratarMidia();
  }

  /* visibilidade "círculo": o select já traz grupo:ID */
  function lerVis(v) { return v.indexOf('grupo:') === 0 ? { vis: 'grupo', grupo: v.slice(6) } : { vis: v }; }
  function slides() { var t = $('#trilho'); return t ? [].slice.call(t.children) : []; }
  function idxAtual() {
    var t = $('#trilho'), best = 0, d = 1e9;
    slides().forEach(function (c, i) { var x = Math.abs(c.offsetLeft - t.offsetLeft - t.scrollLeft); if (x < d) { d = x; best = i; } });
    return best;
  }
  function irPara(i, suave) {
    var t = $('#trilho'), c = slides()[i]; if (!t || !c) return;
    var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollTo({ left: c.offsetLeft - t.offsetLeft - 2, behavior: suave && !quieto ? 'smooth' : 'auto' });
  }
  function ligarCarrossel() {
    var t = $('#trilho'); if (!t) return;
    var n = slides().length; slideIdx = Math.min(slideIdx, n - 1);
    irPara(slideIdx, false);
    $('#pos').textContent = (slideIdx + 1) + ' de ' + n;
    var tick = null;
    t.addEventListener('scroll', function () {
      if (tick) return;
      tick = requestAnimationFrame(function () { tick = null; slideIdx = idxAtual(); var p = $('#pos'); if (p) p.textContent = (slideIdx + 1) + ' de ' + n; });
    });
  }
  function avisar(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500);
  }

  function publicar(base, f) {
    var lista = anexos.slice(); anexos = [];
    return Promise.all(lista.map(function (a) {
      return midiaPut(a.id, a.blob).then(function () { return { id: a.id, tipo: a.tipo, alt: a.alt || '', nome: a.nome }; });
    })).then(function (m) { base.midia = m; novoPost(base, f); });
  }
  function novoPost(base, f) {
    var v = lerVis(f.vis);
    var p = Object.assign({ id: uid(), autor: S.eu, vis: v.vis, texto: '', data: new Date().toISOString(), abracos: [], respostas: [] }, base);
    if (v.vis === 'grupo') { if (!membro(v.grupo, S.eu)) return; p.grupo = v.grupo; }
    S.posts.push(p); save(); render();
  }

  /* ---------- eventos (delegação) ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target, d = new FormData(f);
    e.preventDefault();
    if (f.id === 'novo') { var t = String(d.get('texto')).trim(); if (t || anexos.length) publicar({ tipo: 'mural', texto: t }, { vis: d.get('vis') }); }
    else if (f.id === 'novaMemoria') publicar({ tipo: 'memoria', titulo: String(d.get('titulo')).trim(), ano: String(d.get('ano')).trim(), texto: String(d.get('texto')).trim() }, { vis: d.get('vis') });
    else if (f.id === 'novoNoGrupo') { var tt = String(d.get('texto')).trim(); if (tt || anexos.length) publicar({ tipo: 'mural', texto: tt }, { vis: 'grupo:' + f.getAttribute('data-g') }); }
    else if (f.id === 'novoGrupo') { var nome = String(d.get('nome')).trim(); if (nome) { S.grupos.push({ id: uid(), nome: nome, desc: String(d.get('desc')).trim(), membros: [S.eu] }); save(); render(); } }
    else if (f.id === 'editarPerfil') { var u = S.users[S.eu]; u.humor = String(d.get('humor')); u.trilha = String(d.get('trilha')); u.sobre = String(d.get('sobre')); save(); render(); }
    else if (f.id === 'formRitmo') {
      S.ritmo.modo = d.get('modo') || 'off';
      S.ritmo.horarios = [d.get('h0'), d.get('h1'), d.get('h2')];
      S.ritmo.porPagina = parseInt(d.get('pp'), 10) || 5;
      save(); render();
    }
    else if (f.hasAttribute('data-resp')) {
      var txt = String(d.get('t')).trim(); if (!txt) return;
      var p = S.posts.filter(function (x) { return x.id === f.getAttribute('data-resp'); })[0];
      if (p && pode(p, S.eu)) { p.respostas.push({ autor: S.eu, texto: txt, data: new Date().toISOString() }); save(); render(); }
    }
    else if (f.hasAttribute('data-dep')) {
      var dt = String(d.get('t')).trim(); if (!dt) return;
      S.depoimentos.push({ id: uid(), para: f.getAttribute('data-dep'), de: S.eu, texto: dt, aprovado: false, data: new Date().toISOString() });
      save(); render(); avisar('Enviado. O depoimento só aparece depois que a pessoa aprovar.');
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a;
    if ((a = b.getAttribute('data-rm'))) { anexos.splice(+a, 1); var pv = $('#previas'); if (pv) pv.innerHTML = htmlPrevias(); }
    else if ((a = b.getAttribute('data-abraco'))) {
      var p = S.posts.filter(function (x) { return x.id === a; })[0], i = p.abracos.indexOf(S.eu);
      if (i >= 0) p.abracos.splice(i, 1); else p.abracos.push(S.eu);
      save(); render();
    } else if ((a = b.getAttribute('data-apagar'))) { pend = 'del:' + a; render(); }
    else if ((a = b.getAttribute('data-apagar-sim'))) { S.posts.forEach(function (x) { if (x.id === a && x.autor === S.eu && x.midia) x.midia.forEach(function (m) { midiaDel(m.id); }); }); S.posts = S.posts.filter(function (x) { return x.id !== a || x.autor !== S.eu; }); pend = null; save(); render(); }
    else if (b.hasAttribute('data-nao')) { pend = null; render(); }
    else if ((a = b.getAttribute('data-slide'))) { var al = Math.max(0, Math.min(slides().length - 1, idxAtual() + parseInt(a, 10))); irPara(al, true); }
    else if ((a = b.getAttribute('data-pag'))) { pagina += parseInt(a, 10); slideIdx = 0; render(); window.scrollTo(0, 0); }
    else if ((a = b.getAttribute('data-entrar'))) { grupo(a).membros.push(S.eu); save(); render(); }
    else if ((a = b.getAttribute('data-aprovar'))) { S.depoimentos.forEach(function (x) { if (x.id === a && x.para === S.eu) x.aprovado = true; }); save(); render(); }
    else if ((a = b.getAttribute('data-recusar'))) { S.depoimentos = S.depoimentos.filter(function (x) { return !(x.id === a && x.para === S.eu); }); save(); render(); }
    else if (b.hasAttribute('data-lido')) { S.lastVisit = new Date().toISOString(); save(); render(); }
    else if (b.hasAttribute('data-exportar')) { mostrarJson = !mostrarJson; render(); }
    else if (b.hasAttribute('data-copiar')) {
      var ta = $('#json'), ok = function () { avisar('Copiado.'); }, falha = function () { ta.focus(); ta.select(); avisar('Selecionado. Use copiar do seu aparelho.'); };
      try { navigator.clipboard.writeText(ta.value).then(ok, falha); } catch (x) { falha(); }
    }
    else if (b.hasAttribute('data-resetar')) { pend = 'reset'; render(); }
    else if (b.hasAttribute('data-resetar-sim')) { try { localStorage.removeItem(KEY); } catch (x) { /* ok */ } midiaLimpa(); S = seed(); pend = null; mostrarJson = false; save(); location.hash = '#praca'; render(); }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'arq') { var fs = e.target.files; adicionarArquivos(fs).then(function () { e.target.value = ''; }); }
  });
  document.addEventListener('input', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-alt');
    if (i !== null && i !== undefined && anexos[+i]) anexos[+i].alt = e.target.value;
  });
  $('#quem').addEventListener('change', function (e) { S.eu = e.target.value; slideIdx = 0; pagina = 1; pend = null; anexos = []; save(); render(); });
  window.addEventListener('hashchange', function () { slideIdx = 0; pend = null; anexos = []; render(); window.scrollTo(0, 0); });

  load();
  render();
})();
