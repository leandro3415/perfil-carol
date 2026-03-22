# Manual — Foto (raiz), perfil VIP e admin

## Estrutura das URLs

| Caminho | Conteúdo |
|--------|-----------|
| `/` | App **Foto aleatória** (Google Drive) — igual ao que já estava no [perfilcarol.vercel.app](https://perfilcarol.vercel.app/) |
| `/vip/` | Perfil Carolzinha (`vip/index.html` + mídias em `vip/`) |
| `/admin/` | Painel admin (textos, mídias, feed; upload/exclusão na **web** via GitHub se `GITHUB_TOKEN` estiver na Vercel; no PC com `node server.mjs` grava em disco) |

Repositório sugerido: [github.com/leandro3415/perfil-carol](https://github.com/leandro3415/perfil-carol).

---

## O que você precisa (local)

- [Node.js](https://nodejs.org/) instalado.
- Pasta do projeto (onde estão `server.mjs`, `index.html`, `vip/`, `admin/`).

---

## 1. Subir o servidor local

```powershell
cd "C:\Users\leand\OneDrive\Desktop\privacy carol"
node server.mjs
```

**Deixe o terminal aberto.** Você verá algo como:

- `Foto (raiz):    http://localhost:3333/`
- `Perfil VIP:     http://localhost:3333/vip/`
- `Painel admin:   http://localhost:3333/admin/`

---

## 2. Abrir no navegador — **não digite a URL no PowerShell**

`http://localhost:3333/...` **não é um comando** do terminal. Se você colar isso no PowerShell, aparece *“não é reconhecido como cmdlet…”*.

**Correto:** abra o **Chrome/Edge**, use a **barra de endereço**:

- Foto: `http://localhost:3333/`
- VIP: `http://localhost:3333/vip/`
- Admin: `http://localhost:3333/admin/`

**Atalho no Windows:**

```powershell
start http://localhost:3333/admin/
```

O `node server.mjs` precisa estar rodando.

`http://localhost:3333/admin.html` redireciona para `/admin/`.

---

## 3. Login do admin

- Defina `ADMIN_USER` e `ADMIN_PASSWORD` no ambiente em produção.
- Localmente, o servidor usa o padrão do código se as variáveis não existirem.

**Na Vercel:** configure essas variáveis no painel do projeto (Settings → Environment Variables).

---

## 4. Onde ficam os dados do VIP

- Arquivo: **`vip/site-data.json`**
- **Local:** o admin em `/admin/` grava direto nesse arquivo (via servidor Node).
- **Vercel:** não há disco gravável; o **Salvar** do admin usa a API GitHub (veja abaixo) para atualizar `vip/site-data.json` no repositório. Depois disso a Vercel gera um **novo deploy** (~1–2 min) e o `/vip/` passa a refletir as mudanças.

---

## 5. Deploy na Vercel (GitHub)

1. Envie esta pasta para o repositório [perfil-carol](https://github.com/leandro3415/perfil-carol) (substituindo o `index.html` antigo pela estrutura nova: raiz = foto, pastas `vip/` e `admin/`).
2. Na [Vercel](https://vercel.com), projeto ligado ao mesmo repo.
3. Variáveis de ambiente (Settings → Environment Variables):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `ADMIN_USER` | recomendado | Usuário do painel |
| `ADMIN_PASSWORD` | **sim** | Senha do painel |
| `ADMIN_SESSION_SECRET` | opcional | Segredo para assinar o cookie (se vazio, usa `ADMIN_PASSWORD`) |
| `GITHUB_TOKEN` | **sim para salvar na nuvem** | [Personal Access Token](https://github.com/settings/tokens) com escopo **repo** — usado para **Salvar tudo** (`site-data.json`), **upload** e **exclusão** de mídia em `vip/Postagens`, `vip/Midias`, `vip/Feed teaser` |
| `GITHUB_OWNER` | opcional | Padrão: `leandro3415` |
| `GITHUB_REPO` | opcional | Padrão: `perfil-carol` |
| `GITHUB_BRANCH` | opcional | Padrão: `main` |
| `SITE_DATA_GITHUB_PATH` | opcional | Padrão: `vip/site-data.json` |

4. URLs públicas após o deploy:
   - `https://perfilcarol.vercel.app/` — foto aleatória  
   - `https://perfilcarol.vercel.app/vip` — perfil  
   - `https://perfilcarol.vercel.app/admin` — painel  

**Mídia pelo admin na web:** com `GITHUB_TOKEN` configurado, **Enviar** e **Excluir arquivo** gravam no repositório; a Vercel faz um novo deploy e **todos** passam a ver o `/vip` atualizado (costuma levar ~1–2 min). No plano Hobby da Vercel o corpo da requisição tem limite (~4,5 MB): imagens grandes podem precisar de `git push` manual.

---

## 6. `file://` e `localhost` vs `127.0.0.1`

- Não abra o HTML pelo Explorer (`file://`); o admin **precisa** de `http://` com servidor ou da Vercel.
- Use sempre o **mesmo host** (`localhost` **ou** `127.0.0.1`) para não perder o cookie de sessão.

---

## 7. Estatísticas (mídias)

No **`/vip/`**, os contadores acima do feed usam o **`site-data.json`**:

- **Postagens** = quantidade de itens no array `feed`
- **Vídeos** = quantos posts têm `type: "video"` (não conta arquivos `.mp4` soltos na pasta)

Se o `site-data.json` não puder ser lido ou não tiver `feed` em formato de lista, a página cai no fallback `vip/media-stats.json` (contagem de arquivos nas pastas — legado).

Para regenerar só o JSON por pastas (útil no terminal / servidor local):

```powershell
npm run stats
```

Atualiza `vip/media-stats.json` (não altera a lógica do `/vip` quando há `feed` no site-data).

---

## 8. Parar o servidor local

Na janela do `node server.mjs`: **Ctrl+C**.

---

## Resumo

| Onde | O que fazer |
|------|-------------|
| **Terminal** | `node server.mjs` |
| **Navegador** | `/`, `/vip/`, `/admin/` |
| **PowerShell** | Não “rodar” URL; use `start http://...` se quiser atalho |
