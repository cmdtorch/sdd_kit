# sdd-kit documentation site

The documentation of sdd-kit as a static site: [Astro Starlight](https://starlight.astro.build) with React
components for the interactive parts. It is not part of the installed kit and has its own dependencies.

## Commands

Run them in `site/`:

| Command | What it does |
|---|---|
| `npm install` | install the dependencies |
| `npm run dev` | local server at `localhost:4321` (search works only in a build) |
| `npm run build` | build the static site into `dist/` |
| `npm run preview` | serve `dist/` locally |

## Deploy

`dist/` is plain static files: any web server can serve it. With Docker, from the repository root:

```bash
docker build -f site/Dockerfile -t sdd-kit-docs .
docker run --rm -p 8080:80 sdd-kit-docs
```

The site is built for the root of a domain. To serve it under a path, set `base` in `astro.config.mjs`.

## Layout

| Path | What |
|---|---|
| `src/content/docs/` | the pages, Markdown and MDX; the sidebar is listed in `astro.config.mjs` |
| `src/styles/glass.css` | the look: colour tokens, glass panes, Starlight overrides |
| `src/components/Header.astro`, `Sidebar.astro` | the header capsules and the sidebar, replacing Starlight's |
| `src/components/Flow.tsx` | the clickable flow of a change |
| `src/data/flows/` | the flows as plain data: one stage is one scene of the future video guide |

The header shows the kit version from the root `package.json`.

## Adding a flow

Add a file to `src/data/flows/` that exports a `Flow` (see `types.ts`) and put it on an MDX page:

```mdx
import Flow from '../../../components/Flow.tsx';
import { myFlow } from '../../../data/flows/my-flow.ts';

<Flow client:load flow={myFlow} />
```

The sidebar shows the mini-map of the flow on that page by itself.
