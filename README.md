# three-combined

Két külön three.js-alapú projekt egy közös, rendezett mappában. A korábbi
felesleges dupla-mappázás (`three.js-dev/three.js-dev`, `threeui-main/threeui-main`)
meg lett szüntetve. A projektek **nem** lettek egymásba olvasztva — külön
maradnak, mert eltérő a szerepük, a build-rendszerük és a konfigurációjuk.

## Mappaszerkezet

```
three-combined/
├── three.js-dev/   # maga a three.js motor forráskódja
└── threeui/        # ThreeUI Community – React UI-könyvtár a three.js-re építve
```

## A két projekt

### `three.js-dev/` — a three.js motor
- Verzió: **0.186.0** (`package.json`)
- A hivatalos three.js forrásrepó: `src/` (motor forrás), `build/` (kész
  bundle-ök), `examples/`, `editor/`, `docs/`, `manual/`, `test/`.
- Ez az alacsony szintű 3D/WebGL motor. Önmagában is használható, és ez az
  alap, amire a ThreeUI épül.
- Licenc: MIT (lásd `three.js-dev/LICENSE`).

### `threeui/` — ThreeUI Community
- Csomag: **`@designcodeio/threeui`**, verzió: **1.2.0**
- Nyílt forrású React komponenskönyvtár és interaktív sablonok a three.js
  tetején (Vite-alapú projekt). Forrás: `src/`, `packages/`, `assets/`,
  `public/`, `index.html`.
- three.js-függőségek (npm-en át): `three@0.128.0`, `three@0.149.0`,
  `three@0.165.0` — tehát a ThreeUI a saját npm-es three verzióit használja,
  nem a szomszédos `three.js-dev/` forrást.
- Licenc: MIT (lásd `threeui/LICENSE`, plusz `ASSET-LICENSES.md`,
  `FONT-LICENSES.md`, `THIRD_PARTY_NOTICES.md`).

## Hogyan viszonyul a kettő egymáshoz?

A `threeui` a fő `three` függőséget a **helyi `three.js-dev` buildhez** köti.

- A `threeui/package.json` `three` függősége: `file:../three.js-dev`, így az
  `npm install` a `node_modules/three`-t a helyi `three.js-dev` mappára mutató
  **symlinkként** hozza létre (jelenleg three **0.186.0**). Ha újraépíted a
  motort (`cd three.js-dev && npm run build`), a ThreeUI azonnal az új buildet
  használja — nincs újratelepítés.
- A `three/addons/*` importok a helyi `three.js-dev/examples/jsm/*`-ra oldódnak
  fel (a three `exports` map alapján).
- **Kivétel:** a `three128` (three@0.128.0) és `three165` (three@0.165.0)
  aliasok **szándékosan** megmaradtak npm-es, verzióhoz kötött függőségnek —
  konkrét legacy shaderek (pl. bookshelf, warp-field) ezekhez a régi API-khoz
  készültek, a 0.186-ra irányítás eltörné őket.

### Standalone shader-források (srcdoc iframe-ek) is a lokális buildre kötve

A `src/shaders/**/sources/*.html` (és néhány `woven-cloth/*.html`) önálló, másolható
demók, amelyek sandboxolt `srcdoc` iframe-ben futnak, és korábban CDN-ről töltötték
a three-t. Ezek is a lokálisra lettek kötve:

- Lokálisan kiszolgált three a `threeui/public/vendor/three/` alatt:
  `three.module.js` + `three.core.js` (ESM), `addons/` (a `examples/jsm` másolata),
  és `three.global.js` — a lokális ESM-ből **esbuild**-del készült IIFE bundle,
  ami globális `window.THREE`-t ad az UMD-stílusú (`<script src>`) forrásoknak.
- Átírt hivatkozások (mind `/vendor/three/...`): `flux-vortex.html` (ESM
  importmap + postprocessing), `platform-core.html` (ESM), `lumen.html`,
  `lumina-weavers-cloth.html`, `woven-cloth-atelier/iridescent/washi.html` (UMD).
- A 6, iframe-ben **élőben renderelt** forrás host-komponensei
  (`NeuformBatchEffects`, `NeuformCraftEffects`, `NeuformIsolatedEffects`,
  `WovenCloth`) `sandbox="allow-scripts allow-same-origin"`-t kaptak, így a
  `srcdoc` same-origin tölti a `/vendor`-t. **Ez a kulcs:** enélkül az opak
  (null origójú) iframe „publikus" kontextus, és a böngésző **Private Network
  Access** szabálya blokkolja a **loopback (localhost)** felé menő betöltést
  (az eredeti CDN azért működött, mert publikus host). Az `allow-same-origin`
  localhoston és publikus prod-hoszton egyaránt megoldja.
- `lumen.html` **nem** él iframe-ben renderelődik (a `LumenCta` React-komponens
  rendereli); csak letölthető forrás-artefakt, ezért rá az `allow-same-origin`
  nem vonatkozik.

**Verifikálva:** a 6 élő forrás rendereli a helyi three 0.186-tal, konzolhiba
nélkül — a buildelt appon (production szerver) is (pl. flux-vortex bloom).

> ℹ️ **Portabilitás:** a források egyben másolható „source" artefaktok is. A
> `/vendor` (gyökér-relatív) hivatkozás csak a ThreeUI origóról oldódik fel, így
> a letöltött forrás önmagában (pl. `file://`) nem hordozható. Ha a hordozhatóság
> fontosabb, a `.bak`-ból visszaállítható a CDN-hivatkozás.

### Visszaállítás
Minden módosított forrás mellett van `.bak`, és a `threeui/package.json.bak` is.
- Fő three visszaállítása: `three` → `"0.149.0"` a `threeui/package.json`-ban + `npm install`.
- Standalone források visszaállítása: az adott `*.html.bak` visszamásolása
  (a `src/shaders/**/sources/` és `woven-cloth/` alatt).

### Verifikáció (elvégezve)
`npm install` → `npm run typecheck` (✅) → `npx vite build` (✅, a `three.module`
chunk a lokális buildből) → `npm run dev` + böngészős render-ellenőrzés minden
érintett komponensre (✅). Élő futtatás: `cd threeui && npm run dev`.

## Egységes felület: a three.js motor a ThreeUI-ban

A three.js hivatalos demói (Examples, Editor, Docs, Manual) **natívan be vannak
építve** a ThreeUI alkalmazásba — egy szerverről (5173), a ThreeUI oldalsávjából
elérhetően.

- **Kiszolgálás:** a `vite.config.js` a szomszédos `three.js-dev/` repót a `/tjs/`
  útprefix alatt szolgálja ki (zero-dependency statikus handler; a példák a
  lokális `three.js-dev/build`-et használják, r0.186). A middleware a **dev** és a
  **production preview** (`configurePreviewServer`) szerverre is fel van kötve.
- **UI:** új `threejs` oldal a ThreeUI saját, adatvezérelt routingjában
  (`/threejs` útvonal). Új/módosított fájlok:
  - `src/components/ThreejsHub.tsx` — fül-sáv (Examples/Editor/Docs/Manual) +
    iframe;
  - `src/App.tsx` — `AppPage` bővítés, `selectThreejs` handler, render-ág,
    Sidebar-propok;
  - `src/components/Sidebar.tsx` — „three.js Engine" nav-bejegyzés a
    DOCUMENTATION szekcióban;
  - `src/routes.js` — `/threejs` útvonal feloldása.
- **Elérés:** `cd threeui && npm run dev` → http://localhost:5173/threejs, vagy
  az oldalsáv „three.js Engine" gombja.

### Production-kiszolgálás

Deployolható, zero-dependency szerver: **`scripts/serve-combined.mjs`**
(`npm run serve:combined`). A `dist/`-et szolgálja (SPA-fallbackkel a
kliens-oldali útvonalakhoz, pl. `/threejs`), a `three.js-dev`-et a `/tjs/` úton,
és a `/vendor/`-ra beállítja a CORS + **Private Network Access** fejléceket.

```bash
npm run build:site          # dist/ előállítása
npm run serve:combined      # egységes szerver: http://localhost:4173/
```

Valós statikus/CDN hosztnál alternatíva: a `/tjs/` útra a `three.js-dev` mappa
statikus alias-a (nginx/Apache/CDN rewrite), plusz SPA-fallback az `index.html`-re.

**Verifikálva:** typecheck ✅; `build:site` ✅; a production szerveren (4173) a
`/threejs` egységes felület a beágyazott Examples-szel él, és egy `/vendor`-kötött
srcdoc-shader (flux-vortex bloom) is renderel a buildelt appban.

> A korábbi külön 8080-as three.js szerver **redundáns** és le lett állítva.

## Gyors indítás

three.js (motor) – buildek fejlesztése:
```bash
cd three.js-dev
npm install
npm run build      # a build/ mappa előállítása
```

ThreeUI (UI-könyvtár és demó oldal):
```bash
cd threeui
npm install
npm run dev        # fejlesztői szerver (Vite)
```

## Megjegyzés

- Egyik alprojektben sincs `.git` és `node_modules` — a `npm install` első
  futtatáskor tölti le a függőségeket.
- A mappák önállóak: bármelyiket önmagában is megnyithatod, buildelheted.
