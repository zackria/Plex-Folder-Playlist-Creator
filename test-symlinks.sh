#!/bin/bash
# Quick test for symlink playlist support

echo "🧪 Testing Symlink Playlist Support"
echo ""

# Create test directories
TEST_DIR="/tmp/plex-symlink-test-$$"
MUSIC_DIR="$TEST_DIR/music"
PLAYLIST_DIR="$TEST_DIR/playlist"

mkdir -p "$MUSIC_DIR/Artist-A"
mkdir -p "$MUSIC_DIR/Artist-B"
mkdir -p "$PLAYLIST_DIR"

# Create dummy music files
echo "test audio data" > "$MUSIC_DIR/Artist-A/track1.mp3"
echo "test audio data" > "$MUSIC_DIR/Artist-B/track2.mp3"

# Create symlinks in playlist folder
ln -s "$MUSIC_DIR/Artist-A/track1.mp3" "$PLAYLIST_DIR/track1.mp3"
ln -s "$MUSIC_DIR/Artist-B/track2.mp3" "$PLAYLIST_DIR/track2.mp3"

echo "✅ Created test structure:"
echo "   Music:    $MUSIC_DIR"
echo "   Playlist: $PLAYLIST_DIR"
echo ""

echo "📂 Playlist folder contents:"
ls -la "$PLAYLIST_DIR"
echo ""

echo "🔗 Symlink targets:"
readlink "$PLAYLIST_DIR/track1.mp3"
readlink "$PLAYLIST_DIR/track2.mp3"
echo ""

echo "📝 Next steps:"
echo "1. Launch the app: npm start"
echo "2. Select folder: $PLAYLIST_DIR"
echo "3. Create playlist"
echo "4. Check console logs for:"
echo "   [findPlaylistTracksBySymlinks] Found 2 files"
echo ""

echo "🧹 Cleanup command:"
echo "   rm -rf $TEST_DIR"
echo ""

echo "Test structure created at: $TEST_DIR"
