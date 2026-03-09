# Symlink Playlist Support

## Overview

Create Plex playlists from folders containing **symlinks** to music files, avoiding file duplication.

## Use case

**Issue:** You want the same track in multiple playlists, but don't want duplicate files.

**Solution:** Keep one copy of each file, create multiple playlist folders with symlinks.

```
Library Structure:
/media/music/
  Artist-A/track1.mp3  (real file, 5MB)
  Artist-B/track2.mp3  (real file, 4MB)

Playlist Structure:
/playlists/
  Favorites/
    track1.mp3 → /media/music/Artist-A/track1.mp3  (symlink, 0 bytes)
    track2.mp3 → /media/music/Artist-B/track2.mp3  (symlink, 0 bytes)
  
  Others/
    track1.mp3 → /media/music/Artist-A/track1.mp3  (same symlink)
```

## Creating a Symlink Playlist

**Linux/macOS:**
```bash
# Create folder
mkdir ~/playlists/My-Favorites

# Add symlinks to your favorite tracks
ln -s "/media/music/Artist/Song1.mp3" ~/playlists/My-Favorites/
ln -s "/media/music/Artist/Song2.mp3" ~/playlists/My-Favorites/
ln -s "/media/music/Other/Song3.mp3" ~/playlists/My-Favorites/
```

**Windows (PowerShell - Run as Administrator or enable Developer Mode):**
```powershell
# Create folder
New-Item -ItemType Directory -Path "$HOME\playlists\My-Favorites"

# Create symlinks (requires admin or Developer Mode)
New-Item -ItemType SymbolicLink -Path "$HOME\playlists\My-Favorites\Song1.mp3" -Target "D:\music\Artist\Song1.mp3"
New-Item -ItemType SymbolicLink -Path "$HOME\playlists\My-Favorites\Song2.mp3" -Target "D:\music\Artist\Song2.mp3"
```

**Windows Alternative (Hard links - no admin needed):**
```powershell
# Hard links work without admin but only for files on same drive
New-Item -ItemType HardLink -Path "$HOME\playlists\My-Favorites\Song1.mp3" -Target "D:\music\Artist\Song1.mp3"
```

**Tip (Linux/macOS):** Use wildcards for bulk linking:
```bash
# Link all files from a folder
ln -s /media/music/Artist/*.mp3 ~/playlists/My-Favorites/

# Link specific pattern
ln -s /media/music/**/favorite*.mp3 ~/playlists/Best/
```

## Advanced Examples

### Genre-Based

```bash
# Create genre folders
mkdir -p ~/playlists/{Rock,Jazz,Classical,Electronic}

# Symlink by genre (manually or with script)
ln -s "/media/music/Rock Artist/song.mp3" ~/playlists/Rock/
ln -s "/media/music/Jazz Artist/song.mp3" ~/playlists/Jazz/
```

### Rating-Based

```bash
#!/bin/bash
# Create playlist from 5-star rated tracks

PLAYLIST_DIR=~/playlists/5-Stars
mkdir -p "$PLAYLIST_DIR"

# Find tracks with rating metadata (example using eyeD3)
find /media/music -name "*.mp3" | while read file; do
  rating=$(eyeD3 --no-color "$file" 2>/dev/null | grep -oP 'rating: \K\d+')
  if [ "$rating" = "5" ]; then
    ln -sf "$file" "$PLAYLIST_DIR/"
  fi
done
```

### Recently Added 

```bash
# Create playlist from files added in last 7 days
mkdir -p ~/playlists/New-Music
find /media/music -name "*.mp3" -mtime -7 -exec ln -sf {} ~/playlists/New-Music/ \;
```

### Normal files + symlinks

Mix both in the same folder:
```bash
mkdir ~/playlists/Mixed
cp /media/music/exclusive.mp3 ~/playlists/Mixed/  # Real file
ln -s /media/music/shared.mp3 ~/playlists/Mixed/  # Symlink
```