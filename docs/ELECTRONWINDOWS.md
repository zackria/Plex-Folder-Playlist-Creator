## Signing Instructions

### For Windows Install Windows SDK
[https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/)



## Install individually

`npm install --save-dev electron`

`npm install --save-dev @electron-forge/cli`

`npm install --save-dev @electron-forge/maker-squirrel`

`npm install --save-dev electron-squirrel-startup`

`npm install --save-dev @electron-forge/maker-deb`

`npm install --save-dev @electron-forge/maker-zip`

## Or Run in single shot
`npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-deb @electron-forge/maker-zip`

`npm exec --package=@electron-forge/cli -c "electron-forge import"`

`npm install --save-dev electron-builder`

`npm run make`


`npm run package-linux`


`npm run package-linux-deb`


`npm run package-linux-rpm`


`npm run package-win`


`npm run package-mac`



## TODO WIX Maker is not working in Windows

```JSON
    {
      name: "@electron-forge/maker-wix",
      config: {
        icon: "assets/PlexFolderPlaylistCreator.ico",
        language: 1033,
        manufacturer: 'Zack Dawood'
      },
    },
```


### Download dotnet tool on Windows Only [https://dotnet.microsoft.com/en-us/download](https://dotnet.microsoft.com/en-us/download)

### Install WIX Tool Kit on Windows Only [https://wixtoolset.org/](https://wixtoolset.org/)

`dotnet tool install --global wix`

### Documentation for Electron WIX [https://github.com/electron-userland/electron-wix-msi](https://github.com/electron-userland/electron-wix-msi)

`npm install --save-dev @electron-forge/maker-wix`

`npm i --save-dev electron-wix-msi`


### General free SSL Certificate

` openssl pkcs12 -export -out output.pfx -inkey privatekey.pem -in certificate.crt -certfile intermediate.crt -certfile root.crt`

