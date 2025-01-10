# Plex Folder Playlist Creator

Plex Folder Playlist Creator is a modern desktop application built with Electron JS that generates playlists for media files in a selected folder. This cross-platform app simplifies playlist creation by scanning your folder, extracting metadata, and structuring playlists for easy playback. It integrates seamlessly with the Plex API for advanced media management features and provides a sleek user interface using Bootstrap and Bootstrap Icons.

![alt text](./img/01PlexFolderPlaylist.png)

## Features
- Folder Scanning: Easily scan folders to detect media files.
- Playlist Generation: Automatically create playlists in supported formats.
- Persistent Settings: Save and load user preferences using electron-settings.
- Plex Integration: Connect to Plex Media Server for enhanced media metadata and playlist synchronization.
- Cross-Platform: Runs seamlessly on Windows, Mac, and Linux.
- Modern UI: Built with Bootstrap for a responsive and user-friendly interface, enhanced with Bootstrap Icons for intuitive navigation.

## How It Works
- Install the App: Download and install the app from the release folder.
- Launch the App: Open the Plex Playlist Creator App.
- Connect: Connect to your Plex server using `HOST IP`, `PORT`, `PLEX TOKEN`.
- Save Settings: User preferences (e.g., Host IP, Port, Plex token, theme) are saved for future use.
- Test the Connection: Test the connection and read metadata.
- Get Playlists: Retrieve the playlists.
- Create Playlist: A playlist file is generated automatically based on the media in the specific folder.
- Bulk Playlist Creation: Multiple playlist files are generated automatically based on the media in the specific folders.
- Plex Integration: Optionally connect to a Plex Media Server to fetch metadata and sync playlists.

#### How to find Host IP, PORT, and PLEX TOKEN 
- How to find HOST IP [Refer to this Link](FINDHOST_PORT.md)
- How to find the PORT [Refer to this Link](FINDHOST_PORT.md)
- How to find the PLEX TOKEN [Refer to this Link](FINDPLEXTOKEN.md)

![alt text](./img/02PlexTestConnection.png)

![alt text](./img/03PlexNavigationMenu.png)

![alt text](./img/04PlexGetPlaylist.png)

![alt text](./img/05PlexCreatePlaylistFolder.png)

![alt text](./img/06PlexBulkPlaylist.png)

## Platform Compatibility
- Electron Playlist Creator is designed to work on the following platforms:
    - Windows: Easily installable as a .exe file.
    - Mac: Available as a .dmg package.
    - Linux: Distributed as .deb or .AppImage formats for wide compatibility.

## Buy me a coffee
[Buy me a coffee](https://buymeacoffee.com/zackdawood)

## Libraries Used
This app leverages the following key libraries to deliver its functionality:

1. [electron-settings](https://github.com/nathanbuchar/electron-settings) `^4.0.4`
     A simple, persistent, and type-safe settings manager for Electron applications.
     Used for saving and retrieving user preferences like default folder paths and playlist configurations.

2. [plex-api](https://github.com/phillipj/node-plex-api) `^5.3.2`
     A lightweight and simple Node.js wrapper for interacting with the Plex Media Server API.
     Used for fetching metadata and integrating playlists with Plex.

3. [Bootstrap](https://getbootstrap.com/)
     A powerful front-end framework for building responsive, mobile-first web interfaces.
     Used to create a modern, sleek, and responsive desktop app design.

4. [Bootstrap Icons](https://icons.getbootstrap.com/)
     A collection of free, high-quality icons designed to integrate seamlessly with Bootstrap.
     Used to enhance user experience with visually appealing and intuitive icons.

## Want to add a feature? Follow the steps below to clone, install, and update

- Contribute! I'll be happy to accept pull requests!
- Bug hunting! [Report](https://github.com/zackria/Plex-Folder-Playlist-Creator/issues) them!
- Feature request? Please let me know by filling an [issue](https://github.com/zackria/Plex-Folder-Playlist-Creator/issues)!
- Star this project on [GitHub](https://github.com/zackria/Plex-Folder-Playlist-Creator).

## Installation

1. Clone the repository:
     `git clone https://github.com/zackria/Plex-Folder-Playlist-Creator.git`

2. Navigate to the project directory:
     `cd Plex-Folder-Playlist-Creator`

3. Install dependencies:
     `npm install`

4. Start the app:
     `npm start`


```NOTE: Rebuild instructions```

`rm package-lock.json`

`rm -rf node_modules`

`rm -rf out`

`rm -rf dist`

`npm install`

## Electron Build Instructions
`npm install --save-dev electron`

`npm install --save-dev @electron-forge/maker-wix`

`npm run make`


`npm run package-linux`


`npm run package-linux-deb`


`npm run package-linux-rpm`


`npm run package-win`


`npm run package-mac`

## Roadmap
- Add support for custom playlist formats.
- Advanced media file filtering and categorization.
- Real-time metadata updates with Plex.
- Additional themes and customization options for the UI.
