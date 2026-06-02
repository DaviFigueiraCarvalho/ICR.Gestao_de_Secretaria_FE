@echo off
npm.cmd run dev
set "EXIT_CODE=%errorlevel%"
if not "%EXIT_CODE%"=="0" (
	echo.
	echo O comando falhou com codigo %EXIT_CODE%.
)
echo.
echo Toque uma tecla para continuar...
pause >nul
exit /b %EXIT_CODE%	