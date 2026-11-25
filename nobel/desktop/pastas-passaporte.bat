@echo off
choice /C OE /M "O = OS de grafica, E = projeto de estudio"
if errorlevel 2 (
  powershell.exe -NoProfile -File "%~dp0pastas-passaporte.ps1" -Perfil Estudio
) else (
  powershell.exe -NoProfile -File "%~dp0pastas-passaporte.ps1" -Perfil OS
)
pause
