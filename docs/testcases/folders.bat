@echo off
rem This script creates folders with names that include special characters, spaces, and quotes.

rem Navigate to the directory where the script is located
cd /d "%~dp0"

rem Create the folders, enclosing each name in double quotes
mkdir "🎵 App Testing"
mkdir "Test Tracks_01"
mkdir "Regression Jams (2025)"
mkdir "UAT & Live Gigs"
mkdir "Performance_Mix%%"
rem The double percent sign "%%" is used to escape the special character "%" in a batch file
mkdir "Rhythm.Checks"
mkdir "Test-Compositions_v2.1"
mkdir "Sanity-Smoke#Tunes"
mkdir "$Audio_Files"
mkdir "Builds @ 3-24-25"
fold
echo.
echo Folder creation complete.
echo.
pause
