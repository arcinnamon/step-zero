# Hello World reference app

A single static page, [index.html](index.html). No build step, dependencies or configuration.

## Run locally

```sh
cd app && python3 -m http.server 3000
```

## Deploy to Vercel

Import the repository in Vercel and set **Root Directory** to `app`. Leave the framework preset as "Other" and the build and output settings empty. Vercel serves `index.html` as a static site.

Or from the CLI: `cd app && vercel`.
