# Backend - Clean Periodic Table

API Node.js/Express para disponibilizar elementos químicos, persistir dados do produto e servir como backend de autorização administrativa do site, com suporte a fonte em memória ou MongoDB e autenticação externa.

## Repositórios

- Backend: https://github.com/ZippyBonhTM/clean-periodic-table-backend
- Frontend: https://github.com/ZippyBonhTM/clean-periodic-table-frontend
- Auth: https://github.com/ZippyBonhTM/clean-auth

## Execução local

```bash
npm install
npm run build
npm start
```

Use `.env` baseado em `.env.example`.

## Endpoints

### Públicos / opcionais

- `GET /health`
- `GET /elements`
- `GET /api/v1/feed`
- `GET /api/v1/feed/hashtag/:hashtag`
- `GET /api/v1/search?q=...`
- `GET /api/v1/articles/by-slug/:slug`
- `GET /api/v1/hashtags`

### Autenticados

Os endpoints abaixo exigem `Authorization: Bearer <token>` e dependem de `AUTH_REQUIRED=true` com `AUTH_SERVICE_URL` configurado:

- `GET /molecules`
- `GET /molecules/:moleculeId`
- `POST /molecules`
- `PUT /molecules/:moleculeId`
- `DELETE /molecules/:moleculeId`
- `GET /api/v1/me/articles/saved`
- `POST /api/v1/articles/:articleId/save`

### Administrativos

Os endpoints abaixo pertencem ao backend do produto e usam o token emitido pelo serviço de auth para resolver a conta local do produto:

- `GET /api/v1/admin/session`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/sync-directory`
- `GET /api/v1/admin/users/:userId`
- `POST /api/v1/admin/users/:userId/role`
- `POST /api/v1/admin/users/:userId/moderation`
- `POST /api/v1/admin/users/:userId/sessions/revoke`
- `GET /api/v1/admin/audit`

Notas:

- a role `ADMIN` pertence ao backend do produto
- admins iniciais são bootstrapados por `ADMIN_BOOTSTRAP_USER_IDS`
- o sync legado do diretório depende de:
  - `AUTH_LIST_USERS_PATH=/internal/users`
  - `AUTH_INTERNAL_SERVICE_TOKEN=<shared-secret-with-clean-auth>`
- a revogação de sessões via admin depende de:
  - `AUTH_REVOKE_USER_SESSIONS_PATH=/internal/users/:userId/sessions/revoke`
  - `AUTH_INTERNAL_SERVICE_TOKEN=<shared-secret-with-clean-auth>`
- `clean-auth` continua sendo o IdP e dono de tokens/sessões
- a revogação atual invalida a continuidade da sessão via refresh no auth; access tokens já emitidos continuam válidos até expirarem

Cada molécula salva contém:

- `name`
- `educationalDescription`
- `molecule` com `atoms` e `bonds`
- `editorState` do Molecular Editor
- `summary` com fórmula molecular, composição e contagens

O payload foi desenhado para suportar a futura galeria no client, incluindo preview em stick view, fórmula como `C6H6` e descrição educacional no hover.

## Créditos

- Projeto idealizado e desenvolvido por **ZippyBonhTM**.
- Colaboração técnica de implementação neste backend com **Codex (GPT-5/OpenAI)**.
