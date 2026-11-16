# GitWorld generator

Draws an animated city from your GitHub activity, in 22 switchable themes.
Everything is one script: `generate.mjs` plus the files in `src/`. No packages to install.

## Set up (once)

1. On GitHub, create a public repo named exactly like your username (for example `octocat/octocat`). GitHub shows its `README.md` on your profile.
2. Put this whole folder in that repo.
3. In `gitworld.config.json`, set `"username"` to your GitHub username.
4. On GitHub, go to the repo's **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**, so the workflow can save the images.
5. Open the **Actions** tab, pick **GitWorld city**, and click **Run workflow**. From then on it redraws itself every hour.

### Optional: private repos and full details

Without a personal key, the city only knows your public repos. To add your private repos as unnamed towers (with blinking antennas when they have open issues), create a fine-grained token at **Settings → Developer settings → Personal access tokens → Fine-grained tokens**: repository access **All repositories**, permission **Issues: Read-only** (Metadata read-only is added automatically). Save it in this repo under **Settings** (the repo's own Settings tab, not your account settings) **→ Secrets and variables → Actions → New repository secret** as `GITWORLD_TOKEN`; the page is `https://github.com/<you>/<you>/settings/secrets/actions/new`. Private repo names, code and commits are never drawn; set `"private_repos": false` in the config to turn this off. Pick the longest expiration GitHub offers (or "No expiration"). If the key expires or is deleted, the city keeps updating with your public repos and the Actions run shows a warning until you replace the secret.

## Switch themes

| What you want | How |
| --- | --- |
| Always one theme | `"theme": "synthwave"` in `gitworld.config.json` |
| A different theme every day | `"theme": "rotate"` (uses `rotate_list`, or all themes if empty) |
| Surprise me | `"theme": "random"` |
| Pick a theme without editing files | Actions tab → **GitWorld city** → **Run workflow** → pick from the dropdown → **Run workflow**. It stays until you pick another. |
| Different theme for light-mode visitors | `"light_theme": "github-light"` (or `"same"` to match dark mode) |
| Festival themes on their dates | `"auto": { "festivals": true }` (Diwali, Holi, New Year, Halloween) |
| Season themes | `"auto": { "seasons": true }` (winter, sakura spring, autumn) |

Clicking the city on the profile opens `index.html` (served by GitHub Pages: Settings → Pages → Deploy from a branch → main, root). Visitors can search and scroll through every theme there; it changes only their own view and resets when they leave.

## Themes

`classic-blue` `synthwave` `neon-rain` `winter-night` `diwali` `pastel-day` `github-light` `sakura-dusk` `golden-hour` `gameboy` `mars-colony` `underwater` `matrix` `aurora` `cyberpunk` `autumn` `halloween` `new-year` `holi` `noir` `desert-oasis` `lunar-base`

## What the city shows

Nothing is made up: if the data isn't there, that detail is left out.

| In the city | Comes from |
| --- | --- |
| Buildings | Exactly one per repository you own (up to 60): public ones named, private ones (with the `GITWORLD_TOKEN` key) and the profile repo unnamed. Height = size + stars. Nothing else stands on the street |
| Repo name signs (classic-blue, neon-rain, cyberpunk) | Those same repos' names |
| Tower colors (synthwave) | Each repo's main language |
| Lit windows | One window = one day of that repo, read like a calendar (bottom-left = oldest, top-right = today). Lit = you committed that day; colour strength = commits that day (1, 2-3, 4-6, 7+), in the theme's colours (a theme can set its own 4 `levels`). Today's window flickers if you committed today. Repos whose daily history can't be read light up by how recently they were pushed |
| Windows (github-light) | Your real contribution calendar, in GitHub's greens |
| Moon phase (classic-blue) | Days since your last contribution, full moon = today |
| Billboard | Your latest commit messages |
| Shooting star | A repo got a new star in the last 14 days |
| Monsters / ghosts | Open issues on your repos |
| Cars (1-3), coins (up to 10), bubbles (up to 24) | Contributions in the last 7 days |
| Birds (golden-hour, pastel-day) | Followers, up to 16 birds |
| Cherry blossoms | Fuller as your streak grows |
| Rocket launch (mars-colony) | You pushed code in the last 7 days |
| Fireworks | Always on Diwali and New Year |
| Blimp banner | `"learning"` in the config, otherwise your top language |

## Run it on your computer

```bash
node gitworld/generate.mjs --demo                    # sample data, no token needed
node gitworld/generate.mjs --demo --theme cyberpunk  # make cyberpunk the live theme
node gitworld/generate.mjs --demo --date 2026-11-08  # see what Diwali day looks like
GITHUB_TOKEN=... node gitworld/generate.mjs          # your real data
```

Then run `python3 -m http.server` in the repo folder and open `http://localhost:8000/gallery.html`.

`node gitworld/test.mjs` renders every theme for an empty account, a busy one, and the sample one, and checks the festival dates.

## Add your own theme

Copy any theme in `src/themes.mjs`, give it a new `name`, change the colors, and pick features from `src/features.mjs`. Add the name to the dropdown in `.github/workflows/gitworld.yml` if you want it there too.
