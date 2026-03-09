# Backend - Clean Periodic Table

API Node.js/Express para disponibilizar elementos químicos e persistir moléculas por usuário, com suporte a fonte em memória ou MongoDB e autenticação externa.

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

### Autenticados

Os endpoints abaixo exigem `Authorization: Bearer <token>` e dependem de `AUTH_REQUIRED=true` com `AUTH_SERVICE_URL` configurado:

- `GET /molecules`
- `GET /molecules/:moleculeId`
- `POST /molecules`
- `PUT /molecules/:moleculeId`
- `DELETE /molecules/:moleculeId`

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
