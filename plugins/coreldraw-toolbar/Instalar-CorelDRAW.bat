@echo off
setlocal
set "DEST=%LOCALAPPDATA%\IBD_Ferramentas\CorelDRAW"
if not exist "%DEST%" mkdir "%DEST%"
xcopy "%~dp0." "%DEST%\" /E /I /Y /Q >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\IBD Painel - CorelDRAW.lnk'); $lnk.TargetPath='mshta.exe'; $lnk.Arguments='"%DEST%\IBD_Painel_Corel.hta"'; $lnk.WorkingDirectory='%DEST%'; $lnk.IconLocation='%DEST%\icones\painel-ibd.ico'; $lnk.Save()" >nul 2>&1

echo ====================================================================
echo  IBD Ferramentas - Painel Universal para CorelDRAW instalado!
echo ====================================================================
echo.
echo Pasta instalada: %DEST%
echo Atalho criado na Area de Trabalho: "IBD Painel - CorelDRAW"
echo.
echo O painel funciona em QUALQUER versao do CorelDRAW sem importar VBA.
echo.
echo [OPCIONAL] Para tambem criar a barra de icones fixa dentro do Corel:
echo   1. No CorelDRAW, pressione Alt + F11 (Editor VBA).
echo   2. Clique direito em GlobalMacros ^> Importar Arquivo... e importe:
echo      - Todos os arquivos .bas de: %DEST%\scripts\
echo      - %DEST%\IBD_PainelCorel.bas
echo      - %DEST%\IBD_InstalarBarraFerramentas.bas
echo   3. Execute InstalarBarraIBD (F5).
echo.
echo Abrindo o Painel IBD agora...
start "" mshta.exe "%DEST%\IBD_Painel_Corel.hta"
pause
