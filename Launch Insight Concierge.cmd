@echo off
REM ---------------------------------------------------------------------------
REM Insight Concierge - portable launcher shim.
REM Double-click this file to start the local server and open the dashboard.
REM Works on any Windows 7+ machine. No Python, Node, or admin rights required.
REM ---------------------------------------------------------------------------
title Insight Concierge
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch Insight Concierge.ps1"
if errorlevel 1 (
    echo.
    echo Launcher exited with an error. See messages above.
    pause
)
