![DesQTA](https://socialify.git.ci/BetterSEQTA/DesQTA/image?description=1&font=Raleway&forks=1&issues=1&language=1&logo=data%3Aimage%2Fsvg%2Bxml%2C%253Csvg%20height%3D%27656pt%27%20fill%3D%27white%27%20preserveAspectRatio%3D%27xMidYMid%20meet%27%20viewBox%3D%270%200%20658%20656%27%20width%3D%27658pt%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%253E%253Cg%20transform%3D%27matrix(.1%200%200%20-.1%200%20656)%27%253E%253Cpath%20d%3D%27m2960%206499c-918-100-1726-561-2278-1299-196-262-374-609-475-925-171-533-203-1109-91-1655%20228-1115%201030-2032%202104-2408%20356-124%20680-177%201080-176%20269%201%20403%2014%20650%2064%20790%20159%201503%20624%201980%201290%20714%20998%20799%202342%20217%203420-488%20902-1361%201515-2382%201671-113%2017-196%2022-430%2024-159%202-328-1-375-6zm566-1443c476-99%20885-385%201134-791%20190-309%20282-696%20250-1045-22-240-73-420-180-635-78-156-159-275-274-401l-77-84h445%20446v-235-236l-1162%204-1163%203-100%2023c-449%20101-812%20337-1071%20697-77%20107-193%20335-233%20459-115%20358-116%20726-1%201078%20209%20644%20766%201101%201446%201187%20128%2016%20405%204%20540-24z%27%2F%253E%253Cpath%20d%3D%27m3065%204604c-250-36-396-89-576-209-280-187-470-478-535-821-25-135-16-395%2019-525%2095-351%20331-644%20651-806%2098-49%20225-93%20331-114%2092-18%20368-18%20460%200%20481%2095%20853%20444%20982%20921%2035%20129%2044%20389%2019%20524-36%20191-121%20387-228%20531-186%20249-476%20428-783%20485-65%2012-291%2021-340%2014z%27%2F%253E%253C%2Fg%253E%253C%2Fsvg%253E&name=1&owner=1&pattern=Signal&stargazers=1&theme=Auto)



<p align="center">
  <a target="_blank" href="https://discord.gg/YzmbnCDkat"><img src="https://github.com/SethBurkart123/EvenBetterSEQTA/assets/108050083/23055730-b16e-44c0-9bef-221d8545af92" width="240" style="border-radius:10%;" />
  </a>
</p>

- [Features](#features)
- [Weekly Builds](#weekly-builds)
- [Full Releases](#full-releases)
- [Getting Started](#getting-started)
  - [Building For Production](#building-for-production)
  - [Folder Structure](#folder-structure)
- [Contributors](#contributors)

  
## Features

- **Custom Homepage**: A personalized homepage that displays upcoming assessments, lessons, and notices with subject-specific colors.

- **All SEQTA functionality kept**: Most SEQTA actions can be performed here.

- **Timetable Colors**: Integration of timetable colors for subjects to enhance visual identification throughout the entire app.

- **Sidebar Navigation**: A sidebar with quick navigation links to various sections like Home, News, Assessments, Courses, Dashboard, etc.

- **Session Management**: 
  - Handles user sessions with login and logout functionality.
  - Stores session data securely.

- **API Integration**: 
  - Fetches data from SEQTA APIs for assessments, subjects, and user preferences.
  - Utilizes Rust for backend operations with Tauri.

- **Responsive Design**: 
  - Utilizes Tailwind CSS for styling.
  - Ensures a responsive and modern UI across different devices.

## Weekly Builds
Nightly builds are available under the releases tab, tagged with nightly-release.   
[Quick access link](https://github.com/BetterSEQTA/DesQTA/actions/workflows/nightlybuild.yml)

## Full Releases
Full Releases are available under the releases tab.  
[Quick access link](https://github.com/BetterSEQTA/DesQTA/releases/latest)


## Getting Started
> [!IMPORTANT]  
> To run the dev script you must have [rust, cargo (included with rust)](https://www.rust-lang.org/tools/install) and pnpm (`npm install -g pnpm`) on your system or it will not build.
>

Clone the repo:
```bash
git clone --branch develop https://github.com/betterseqta/desqta 
```
Run the program:
```bash
npm run start
```

# Optionally run both commands manually:
Install modules
```bash
npm install
```
Run the script
```
npm run tauri dev
```

# Building for production:
Build app
```bash
npm run tauri build
```

> [!WARNING]
> Do not run `npm run dev` as it starts the backend webui only; the pages loaded by DesQTA are built to be run by a framework not present in regular browsers. This is the same with `npm run build`; it will only build the webpage files, not the app.


## Folder Structure

<details>
<summary>Folder Structure:</summary>

### Root Directory
- `.gitignore` - Git ignore rules
- `bun.lockb` - Bun Lockfile
- `LICENSE` - License file
- `package-lock.json` - Lockfile for npm
- `package.json` - Project's metadata and dependencies
- `pnpm-lock.yaml` - Lockfile
- `postcss.config.js` - Configuration for PostCSS
- `README.md` - Project documentation
- `svelte.config.js` - Configuration for Svelte
- `tailwind.config.js` - Configuration for Tailwind
- `TODO.md` - Project todos
- `tsconfig.json` - TypeScript compiler configuration
- `vite.config.js` - Configuration for the Vite build tool

### `.github`
- `workflows/`
  - `build.yml` - Build workflow

### `.vscode`
- `extensions.json` - Recommended VSCode extensions
- `settings.json` - Required project-specific VSCode settings

### `src` - Source Directory
- `app.css` - Global styles
- `app.html` - Base HTML template

#### `components` - Reusable Svelte components.
- `Editor/` - Editor module components.
  - `Editor.svelte`
  - `EditorStyles.css`
  - `Plugins/` - Editor plugin system.
    - `Commands/`
      - `command.ts`
      - `CommandList.svelte`
      - `stores.ts`
      - `suggestion.ts`

#### `routes` - Route-based pages for the app
- `+layout.svelte`
- `+layout.ts`
- `+page.svelte`

##### `assessments` - Assessments page
- `+page.svelte`
- `[id]/`
  - `[metaclass]/`
    - `+page.svelte`
    - `+page.ts`

##### `courses` - Courses Page
- `+page.svelte`
- `types.ts`
- `utils.ts`
- `components/`
  - `CourseContent.svelte`
  - `LinkPreview.svelte`
  - `ScheduleSidebar.svelte`
  - `SubjectSidebar.svelte`

##### `dashboard` - Dashboard Page
- `+page.svelte`

##### `direqt-messages` - Direqt Messages Page
- `+page.svelte`
- `types.ts`
- `components/`
  - `ComposeModal.svelte`
  - `Message.svelte`
  - `MessageList.svelte`
  - `Sidebar.svelte`

##### `news` - News Page
- `+page.svelte`

##### `notices` - Notices Page
- `+page.svelte`

##### `reports` - Reports Page
- `+page.svelte`

##### `settings` - Settings Page
- `+page.svelte`
- `plugins/` - Plugin store (coming soom)
  - `+page.svelte`

##### `timetable` - Timetable Page
- `+page.svelte`

##### `welcome` - Welcome page
- `+page.svelte`

#### `utils` - General Utilities
- `cache.ts`
- `notify.ts`
- `seqtaFetch.ts`

### `src-tauri` - Tauri Backend (Rust).
- `.gitignore`
- `build.rs`
- `Cargo.lock`
- `Cargo.toml`
- `tauri.conf.json`

#### `capabilities` - Platform capabilities/permissions
- `default.json`

#### `gen` - XCode Project Files for iOS devices
- `apple/`
  - `.gitignore`
  - `ExportOptions.plist`
  - `LaunchScreen.storyboard`
  - `Podfile`
  - `project.yml`
  - `Assets.xcassets/` - iOS icon and UI assets
    - `Contents.json`
    - `AppIcon.appiconset/` - iOS app icons
  - `desqta.xcodeproj/` - Xcode project structure
  - `desqta_iOS/` - iOS-specific metadata
  - `Sources/` - Objective-C/Swift bridging code
    - `desqta/`
      - `main.mm`
      - `bindings/`
        - `bindings.h`

#### `icons`
- Various icon files for different platforms
- `android/` - Android-specific icons
  - `mipmap-hdpi/`
  - `mipmap-mdpi/`
  - `mipmap-xhdpi/`
  - `mipmap-xxhdpi/`
  - `mipmap-xxxhdpi/`
- `ios/` - iOS icon sizes

#### `src` - Rust source files
- `lib.rs`
- `main.rs`
- `auth/` - Authentication logic
  - `login.rs`
- `mobilechanges/` - Mobile-specific overrides
  - `login.rs`
- `utils/` - Backend utility
  - `netgrab.rs`
  - `session.rs`
  - `settings.rs` - Settings object for user settings

### `static`
- Various static assets
- `images/`
  - `editor/` - Icons used in the editor
    - `commands/` - Command icons

</details>

## Contributors

<a href="https://github.com/betterseqta/desqta/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=betterseqta/desqta" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=BetterSEQTA/desqta&type=Date)](https://star-history.com/#BetterSEQTA/desqta&Date)
