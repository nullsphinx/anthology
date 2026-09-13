# Contributing to Anthology

Thank you for helping build Anthology. Please open an issue before beginning a large product or architecture change so the approach can be discussed first.

## Local development

Requirements:

- Node.js 22 or newer
- npm
- Docker Desktop for the local Supabase stack

Install dependencies and run the application:

```bash
npm install
npm run dev
```

Before submitting a pull request, run:

```bash
npm test
npm run build
```

Never commit populated environment files, database credentials, provider tokens, personal exports, or production data. Database changes must be represented by reviewed migrations and must include authorization tests.

By contributing, you agree that your contributions are licensed under the GNU Affero General Public License v3.0.
