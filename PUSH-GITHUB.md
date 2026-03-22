# Manual — Push para o GitHub

Guia para enviar alterações deste projeto para o repositório remoto (ex.: [perfil-carol](https://github.com/leandro3415/perfil-carol)).

---

## 1. Sempre use a pasta certa do projeto

Este repositório Git fica **só** dentro da pasta do projeto, por exemplo:

`C:\Users\leand\OneDrive\Desktop\privacy carol`

Antes de qualquer comando `git`, abra o PowerShell e:

```powershell
cd "C:\Users\leand\OneDrive\Desktop\privacy carol"
```

**Por quê:** se o Git estiver inicializado na pasta do usuário (`C:\Users\leand`) ou em outro lugar acima do Desktop, o `git status` pode listar arquivos do computador inteiro. O correto é ter **`.git` apenas dentro desta pasta**.

---

## 2. Ver o que mudou

```powershell
git status
```

Arquivos em vermelho = não preparados; em verde = já no próximo commit (após `git add`).

---

## 3. Adicionar arquivos ao commit

Incluir **todas** as alterações:

```powershell
git add -A
```

Ou arquivos específicos:

```powershell
git add index.html vip/site-data.json
```

---

## 4. Criar o commit

```powershell
git commit -m "Descrição curta do que você alterou"
```

Exemplos de mensagem:

- `Atualiza textos do perfil VIP`
- `Corrige link do rodapé`
- `Ajusta estatísticas de mídia`

Se aparecer *“nothing to commit”*, não há mudanças novas desde o último commit.

**Primeira vez usando Git neste PC:** o Git pode pedir nome e e-mail:

```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

---

## 5. Enviar para o GitHub (push)

Branch principal deste projeto: **`main`**.

```powershell
git push origin main
```

Se já configurou o *upstream* uma vez:

```powershell
git push
```

---

## 6. Repositório remoto (`origin`)

Para ver para onde o `push` vai:

```powershell
git remote -v
```

Deve aparecer algo como:

`https://github.com/leandro3415/perfil-carol.git`

Para **trocar** o remoto (outro repo):

```powershell
git remote set-url origin https://github.com/USUARIO/REPO.git
```

---

## 7. Login — GitHub não usa mais senha da conta no terminal

Ao fazer `push`, se pedir usuário/senha:

- **Usuário:** seu usuário do GitHub  
- **Senha:** use um **Personal Access Token** (não a senha do site)

Criar token: [github.com/settings/tokens](https://github.com/settings/tokens) → *Generate new token* → marque o escopo **repo** (para repositórios privados ou push em geral) → copie o token e use onde o Git pedir “senha”.

Outras opções: **GitHub Desktop** ou `gh auth login` ([GitHub CLI](https://cli.github.com/)).

---

## 8. Quando o push é recusado (*non-fast-forward*)

Mensagem típica: *updates were rejected because the remote contains work that you do not have*.

Significa que no GitHub há commits que você **não** tem no PC.

**Opção A — integrar o remoto (recomendado no dia a dia):**

```powershell
git pull origin main --rebase
git push origin main
```

Se der conflito, o Git avisa; edite os arquivos marcados, depois:

```powershell
git add -A
git rebase --continue
git push origin main
```

**Opção B — sobrescrever o GitHub com o que está no PC (perigoso):**

```powershell
git push origin main --force
```

Use **só** se tiver certeza de que pode **apagar** o histórico atual do `main` no remoto (ex.: primeiro envio de um projeto novo no mesmo repo).

---

## 9. Fluxo resumido (dia a dia)

```powershell
cd "C:\Users\leand\OneDrive\Desktop\privacy carol"
git status
git add -A
git commit -m "sua mensagem"
git push
```

---

## 10. Onde isso aparece no GitHub

Depois do push, as alterações ficam em:

`https://github.com/leandro3415/perfil-carol` (ajuste se o seu `origin` for outro).

Se o site estiver na **Vercel** ligado a esse repositório, um novo deploy costuma começar automaticamente após o push.

---

## Referência rápida

| Comando        | Função                          |
|----------------|----------------------------------|
| `git status`   | Ver alterações                  |
| `git add -A`   | Preparar tudo para o commit     |
| `git commit`   | Gravar snapshot local           |
| `git push`     | Enviar commits para o GitHub    |
| `git pull`     | Trazer commits do GitHub        |
| `git log -3`   | Ver últimos 3 commits           |

Para servidor local, admin e rotas `/vip` e `/admin`, veja também **`MANUAL.md`**.
