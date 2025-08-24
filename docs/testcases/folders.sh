#!/bin/bash

# This script creates folders with names that include special characters, spaces, and quotes.

# Create the folders, enclosing each name in double quotes.
# The `mkdir -p` command creates parent directories as needed and does not error if a directory already exists.
mkdir -p "🎵 App Testing"
mkdir -p "Test Tracks_01"
mkdir -p "Regression Jams (2025)"
mkdir -p "UAT & Live Gigs"
mkdir -p "Performance_Mix%"
mkdir -p "Rhythm.Checks"
mkdir -p "Test-Compositions_v2.1"
mkdir -p "Sanity-Smoke#Tunes"
mkdir -p "\$Audio_Files"
# The backslash `\` is used to escape the special character `$`
mkdir -p "Builds @ 3-24-25"

echo "Folder creation complete."
