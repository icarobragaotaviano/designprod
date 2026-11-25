@echo off
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.ibd.cep.ferramentas"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%~dp0." "%DEST%\" /E /I /Y /Q >nul
for %%V in (8 9 10 11 12 13 14 15 16) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)
echo IBD Ferramentas (CEP) instalado em: %DEST%
echo Reinicie o aplicativo Adobe e abra Janela ^> Extensoes ^> IBD Ferramentas.
pause
