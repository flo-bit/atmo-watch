# Movie, TV, and cast routes

This route group is intentionally self-contained. It owns the search page, movie/TV and cast pages, their UI components, TMDB types/helpers, and server-side TMDB client. Nothing here imports `$lib` or AT Protocol code.

To move the feature to another SvelteKit app, copy this entire `(app)` directory into `src/routes`.

## Host app requirements

- SvelteKit 2, Svelte 5, and Tailwind CSS 4
- `bits-ui` for the keyboard-accessible search command
- `@lorenzopant/tmdb` for typed TMDB requests and image URLs
- A private `TMDB_ACCESS_TOKEN` environment variable containing a TMDB API read access token (`TMDB_API_KEY` remains supported for compatibility)
- A private `OMDB_API_KEY` environment variable for IMDb and Rotten Tomatoes ratings
- `@ethercorps/sveltekit-og` and its `sveltekitOG()` Vite plugin for the movie/TV `og.png` endpoint
- The `base-*` and `accent-*` Tailwind color tokens used by the markup (or replace those utility classes with the new app's palette)

The `[kind]` route validates `movie` and `tv` itself, so it does not depend on a matcher in `src/params`.
