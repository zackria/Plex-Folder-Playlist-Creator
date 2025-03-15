# MAC App Signing and App Store Publishing

[https://www.avast.com/random-password-generator#mac](https://www.avast.com/random-password-generator#mac)



- ###  Open Xcode --> Settings --> Account --> Manage Certifcates

Note: To validate your password with the certificate

`openssl pkcs12 -in your_p12_file.p12 -nodes -passin pass:<your_password> -out your_key.pem`

- ### Developer ID --> Application 


[https://account.apple.com/account/manage](https://account.apple.com/account/manage)

- ###  App-Specific Passwords 


### Clone [https://github.com/omkarcloud/macos-code-signing-example](https://github.com/omkarcloud/macos-code-signing-example)

`npm install`


### Package 

`npm run package`

### Sign the app

`chmod 755 ./build-assets/build-mac.sh`

`./build-assets/build-mac.sh`


## Code Sign Validation in Mac 

`codesign --verify --verbose --deep --strict ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app`


`codesign -dvvv ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app`

## Build for Mac 

`npm run package-mac`

`npm run package-mac-uni`