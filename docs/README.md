# FSH Hospital HMS — Backend Integration Docs

Dukumeentiyadan waxay ku caawinayaan in frontend-ka lagu xiro backend API.

| File | Content |
|------|---------|
| [SYSTEM_WORKFLOW.md](./SYSTEM_WORKFLOW.md) | Workflow charts (Mermaid) — bukaan, lab, surgery, inpatient, pharmacy, emergency |
| [SYSTEM_ANALYSIS.md](./SYSTEM_ANALYSIS.md) | Falanqayn user kasta — permissions, xogta uu xareyn karo (C/R/U), database tables |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | **Supabase full-stack setup** — env, migration SQL, sync architecture |

## Roles (7)

`admin` · `reception_cashier` · `doctor` · `nurse` · `laboratory` · `pharmacy` · `emergency`

## Bilow backend

1. Akhri `SYSTEM_WORKFLOW.md` — faham flow-ga
2. Akhri `SYSTEM_ANALYSIS.md` — API endpoints per role
3. Abuur database tables (Section 9)
4. Implement auth: `POST /api/auth/login` + permissions
5. Beddel `hmsStore.ts` calls → API calls
