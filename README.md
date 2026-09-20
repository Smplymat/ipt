# KneadToKnow

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests once with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test --watch=false
```

Omit `--watch=false` if you want Vitest to stay in watch mode (re-runs on file changes).

## Roles & the first Admin (read before signing up)

`supabase/migrations/0001_roles_profiles.sql` (mirrored in `supabase/setup.sql`)
handles role assignment automatically:

- On an **empty** database, the **first account to sign up becomes `admin`**;
  every later signup becomes `customer`.
- On a database that **already has users** when the script first runs, the
  **oldest account (lowest `created_at`) is promoted to `admin`** during the
  backfill — this is the oldest user by creation time, **not** necessarily the
  person who originally bootstrapped the project.
- After that first backfill, new signups only become `admin` while
  `user_roles` is empty, which in practice never happens again.

If you need a specific person to be the admin, set the role directly:

```sql
insert into public.user_roles (user_id, role)
values ('<uuid>', 'admin')
on conflict (user_id) do update set role = 'admin';
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
