# Varanda — protótipo executável

Rede social calma para quem viveu Orkut, MTV, anime e o começo das redes. Protótipo para mostrar a um orientador ou apoiador.

## Como abrir

Dê dois cliques em `index.html`. Não precisa de servidor, conta nem internet. (Alternativa: `python3 -m http.server` dentro desta pasta.)
Tudo fica no `localStorage` do navegador. O botão **Meus dados → Apagar tudo** volta à demonstração.

## Roteiro de demonstração (5 minutos)

1. **Praça**: lista cronológica, 5 por página, termina com "Por hoje é só". Não existe "carregar mais".
2. **Entrar como** (canto superior direito): troque entre Você, Marina, Rafa, Bia e Caio. Veja que a Marina vê o "Sábado de Vinil" e você não, e que ninguém vê sua anotação privada.
3. **Abraço**: ao mandar, só quem escreveu vê o número. Não há curtida pública.
4. **Meu diário**: lembranças por ano, cada uma com sua visibilidade (só eu, círculo, público).
5. **Perfil**: humor, trilha do momento e depoimentos que a pessoa aprova antes de aparecerem (herança do Orkut).
6. **Ritmo** e **Cartinha do dia**: avisos desligados por padrão; três horários ou resumo diário por escolha.
7. **Por que é assim**: cada decisão ligada ao mecanismo da pesquisa, separando *autor diz* de *proposta*.

## Limites (leia antes de mostrar)

- **Não é um produto**: sem servidor, sem login real, sem moderação. A "visibilidade" é aplicada no navegador, então serve para demonstrar a regra, não para garantir privacidade.
- **Citações não verificadas**: os trechos de Bastos, Cabral Filho e Tomaz vêm do documento de contexto do projeto de mestrado. Quem programou não os conferiu nos originais.
- **Não prova nada sobre bem-estar**: o desenho é uma hipótese a testar. A base neurocientífica do projeto trata de adolescentes; o público 27+ é decisão de produto.
- **Risco principal**: círculos sem estímulo podem esvaziar (o "bairro vazio").

## Próximos passos sugeridos

1. Validar com 8 a 15 pessoas reais num círculo, por algumas semanas, com consentimento.
2. Só então servidor (Postgres + autenticação), convite por quem já está dentro, exportação e exclusão reais.
3. Auditoria externa da promessa de "sem rastreio" antes de qualquer lançamento.
