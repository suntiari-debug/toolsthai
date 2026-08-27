# Baseline QA — 2026-08-27

- Repository: `suntiari-debug/toolsthai`
- Working tree: clean after clone.
- Requested checkpoint: `014c73f1` — not present in the cloned repository or reachable commit objects; the repository currently resolves to a later checkpoint history.
- Dependencies: installed successfully with `pnpm install --frozen-lockfile`.
- TypeScript: `pnpm check` passed.
- Tests: `pnpm test` passed, 12 files / 48 tests.
- Production build: `pnpm build` passed. Existing warnings: analytics placeholders are undefined during build and one analytics script is not a module; a large JS chunk warning is also present.
- Runtime: development server starts successfully on `http://localhost:3000/` when run with `node --import tsx server/_core/index.ts`; the `tsx watch` command in a detached shell hit an EBADF stdin issue, so the non-watch entrypoint is used for QA.
- Browser baseline: landing page loaded successfully and exposes public document tools, including quotation, invoice, receipt, tax invoice, delivery note, calculators, and account/history CTA.
- Current data model: `users`, `company_profiles`, and `saved_documents`; documents are stored as user-scoped JSON payloads and currently have no receivables/payment ledger tables.
- Current API: auth, company profile get/save, and documents list/save are protected where user data is involved.
- Module 1 backlog in `todo.md`: all existing checklist items are marked complete through the current checkpoint history.
