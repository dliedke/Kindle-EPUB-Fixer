@echo off
setlocal

echo Gerando sitemap.xml a partir de LANGUAGE_META...
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js nao encontrado. Instale o Node ou gere o sitemap manualmente.
    exit /b 1
)
call node tools\generate-sitemap.js
if errorlevel 1 (
    echo Geracao do sitemap falhou. Deploy abortado.
    exit /b 1
)

echo Copiando arquivos do app para public...
copy /Y index.html public\ >nul
copy /Y app.js public\ >nul
copy /Y i18n.js public\ >nul
copy /Y styles.css public\ >nul
copy /Y sitemap.xml public\ >nul
copy /Y robots.txt public\ >nul
copy /Y google*.html public\ >nul 2>nul

if not exist public\vendor mkdir public\vendor
copy /Y vendor\*.js public\vendor\ >nul

echo Fazendo deploy no Firebase Hosting...
call firebase deploy --only hosting
if errorlevel 1 (
    echo Deploy falhou.
    exit /b 1
)

echo Deploy concluido com sucesso.
endlocal
