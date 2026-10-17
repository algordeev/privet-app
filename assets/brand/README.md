# Privet iOS app icon

`ios-app-icon.svg` reuses the four symbol shapes and colors from `public/icon.svg` without changing the website favicon or CSS wordmark. The original symbol is centered and scaled to 75.6% of the canvas width on solid brand cream (`#f8f6f0`). There is no outer corner rounding; iOS supplies the home-screen mask.

Regenerate the catalog PNG with the pinned, standalone Python rendering tools:

```sh
uv run scripts/render-ios-icon.py
```

Alternatively, install the versions declared at the top of that script in a temporary Python environment and run it there. These tools are only needed to regenerate the icon, not to build the app.

The script checks the symbol against the original favicon, renders the SVG at 1024×1024, verifies full opacity, exports RGB PNG without an alpha channel, and checks the current universal iOS asset-catalog reference. The existing catalog filename is retained.

Rebuild and install using the existing Capacitor project:

```sh
npm run build:native
npx cap sync ios
npx cap open ios
```

In Xcode, select the App scheme and your connected iPhone as the run destination, then press Run. Keep your existing team/signing settings. The home-screen icon may be cached; if the installed icon stays unchanged after rebuilding, deleting and reinstalling the app clears that cache but also removes its locally saved lesson progress.
