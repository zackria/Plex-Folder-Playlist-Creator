
module.exports = {
  packagerConfig: {
    name: 'PlexFolderPlaylistCreator',
    asar: true,
    osxSign: {},
    icon: "assets/PlexFolderPlaylistCreator.png",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "PlexFolderPlaylistCreator",
        authors: "Zack Dawood",
        description: "PlexFolderPlaylistCreator",
        setupIcon: "assets/PlexFolderPlaylistCreator.ico",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      config: {
        name: "PlexFolderPlaylistCreator",
        authors: "Zack Dawood",
        description: "PlexFolderPlaylistCreator",
        setupIcon: "assets/PlexFolderPlaylistCreator.ico",
      },
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          icon: "assets/PlexFolderPlaylistCreator.png",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        icon: "assets/PlexFolderPlaylistCreator.icns",
      },
    },
    {
      name: "@electron-forge/maker-wix",
      config: {
        icon: "assets/PlexFolderPlaylistCreator.ico",
      },
    },
  ],
};
