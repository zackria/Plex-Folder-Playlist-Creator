# Windows Store Publishing Instructions


`npm install -g electron-windows-store`

```shell
electron-windows-store `
    --input-directory C:\myelectronapp `
    --output-directory C:\output\myelectronapp `
    --package-version 1.0.0.0 `
    --package-name myelectronapp
```

## Electron Docs
[https://www.electronjs.org/docs/latest/tutorial/windows-store-guide](https://www.electronjs.org/docs/latest/tutorial/windows-store-guide)


## Windows SDK
[https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/)


## Publish to Microsoft Partner Center 
[https://partner.microsoft.com/en-us/dashboard/home](https://partner.microsoft.com/en-us/dashboard/home)


`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned`

`electron-windows-store`


electron-windows-store `
    --input-directory C:\Users\zackr\Downloads\Github\Plex-Folder-Playlist-Creator\out\PlexFolderPlaylistCreator-win32-arm64`
    --output-directory C:\Users\zackr\Downloads\Github\Plex-Folder-Playlist-Creator\out\output`
    --package-version 1.0.3 `
    --package-name PlexFolderPlaylistCreator