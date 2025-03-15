# Set environment variables
export APPLE_ID="username@gmail.com"
export APPLE_APP_SPECIFIC_PASSWORD="MY_APP_SPECIFIC_PASSWORD"
export APPLE_TEAM_ID="MY_TEAM_ID"
export CSC_LINK-=Cetrifcate.p12
export CSC_KEY_PASSWORD=password

# Get version from package.json or use provided argument
VERSION=$(node -p "require(require('path').resolve(process.cwd(), 'package.json')).version")
VERSION=${1:-$VERSION}

echo "Building version: $VERSION"

npm run package 

codesign --verify --verbose --deep --strict ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

codesign -dvvv ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

# Add a small delay before packaging
sleep 50


mkdir -p upload 

# Add a small delay before packaging
sleep 5

npm run package-mac


codesign --verify --verbose --deep --strict ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

codesign -dvvv ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

# Add a small delay before packaging
sleep 50

cp dist/PlexFolderPlaylistCreator-$VERSION-arm64.dmg upload/PlexFolderPlaylistCreator-$VERSION-arm64.dmg
cp dist/PlexFolderPlaylistCreator-$VERSION-arm64.zip upload/PlexFolderPlaylistCreator-$VERSION-arm64.zip


# Add a small delay before packaging
sleep 50

rm -rf dist


npm run package-mac-uni


codesign --verify --verbose --deep --strict ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

codesign -dvvv ./out/PlexFolderPlaylistCreator-darwin-arm64/PlexFolderPlaylistCreator.app

# Add a small delay before packaging
sleep 50

cp dist/PlexFolderPlaylistCreator-$VERSION-universal.dmg upload/PlexFolderPlaylistCreator-$VERSION-universal.dmg
cp dist/PlexFolderPlaylistCreator-$VERSION-universal.zip upload/PlexFolderPlaylistCreator-$VERSION-universal.zip


# Add a small delay before packaging
sleep 50

rm -rf dist

npm run package-linux

# Add a small delay before packaging
sleep 50

cp dist/PlexFolderPlaylistCreator-${VERSION}-x86_64.AppImage upload/PlexFolderPlaylistCreator-${VERSION}-x86_64.AppImage

# Add a small delay before packaging
sleep 120

cp PlexFolderPlaylistCreator-${VERSION}-amd64.snap upload/PlexFolderPlaylistCreator-${VERSION}-amd64.snap


# Add a small delay before packaging
sleep 50

rm -rf dist


npm run package-linux-deb

# Add a small delay before packaging
sleep 50

cp dist/PlexFolderPlaylistCreator-${VERSION}-arm64.deb upload/PlexFolderPlaylistCreator-${VERSION}-arm64.deb

# Add a small delay before packaging
sleep 50

rm -rf dist

npm run package-linux-rpm

# Add a small delay before packaging
sleep 50

cp dist/PlexFolderPlaylistCreator-${VERSION}-aarch64.rpm upload/PlexFolderPlaylistCreator-${VERSION}-aarch64.rpm