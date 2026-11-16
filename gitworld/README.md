# GitWorld generator

Draws an animated city from your GitHub activity, in 22 switchable themes.
Everything is one script: `generate.mjs` plus the files in `src/`. No packages to install.

## Set up (once)

1. On GitHub, create a public repo named exactly like your username (for example `octocat/octocat`). GitHub shows its `README.md` on your profile.
2. Put this whole folder in that repo.
3. In `gitworld.config.json`, set `"username"` to your GitHub username.
4. On GitHub, go to the repo's **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**, so the workflow can save the images.
5. Open the **Actions** tab, pick **GitWorld city**, and click **Run workflow**. From then on it redraws itself every day.

### Optional: full details

The workflow's built-in token can't read every detail of your other repos (open issues, pull requests, release and star dates). Those parts of the city are simply left out. To include them, create a fine-grained token at **Settings → Developer settings → Personal access tokens** with read-only access to your public repos, then add it to this repo under **Settings → Secrets and variables → Actions** as `GITWORLD_TOKEN`.

## Switch themes

| What you want | How |
| --- | --- |
| Always one theme | `"theme": "synthwave"` in `gitworld.config.json` |
| A different theme every day | `"theme": "rotate"` (uses `rotate_list`, or all themes if empty) |
| Surprise me | `"theme": "random"` |
| Try one theme once | Actions tab → **GitWorld city** → **Run workflow** → pick from the dropdown |
| Different theme for light-mode visitors | `"light_theme": "github-light"` |
| Festival themes on their dates | `"auto": { "festivals": true }` (Diwali, Holi, New Year, Halloween) |
| Season themes | `"auto": { "seasons": true }` (winter, sakura spring, autumn) |

Browse every theme in [THEMES.md](../THEMES.md), or open `gallery.html` locally.

## Themes

`classic-blue` `synthwave` `neon-rain` `winter-night` `diwali` `pastel-day` `github-light` `sakura-dusk` `golden-hour` `gameboy` `mars-colony` `underwater` `matrix` `aurora` `cyberpunk` `autumn` `halloween` `new-year` `holi` `noir` `desert-oasis` `lunar-base`

## What the city shows

Nothing is made up: if the data isn't there, that detail is left out.

| In the city | Comes from |
| --- | --- |
| Tallest towers | Your top 12 public repos (height = stars + size); other buildings are scenery |
| Repo name signs (classic-blue, neon-rain, cyberpunk) | Those same repos' names |
| Tower colors (synthwave) | Each repo's main language |
| How many windows are lit | Contributions in the last 7 days (more activity, brighter city) |
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
