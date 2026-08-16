@echo off
setlocal

echo Removendo sitemap.xml antigo...

if exist sitemap.xml (
    del /F /Q sitemap.xml
    if errorlevel 1 (
        echo Nao foi possivel apagar sitemap.xml da raiz.
        exit /b 1
    )
)

if exist public\sitemap.xml (
    del /F /Q public\sitemap.xml
    if errorlevel 1 (
        echo Nao foi possivel apagar public\sitemap.xml.
        exit /b 1
    )
)

if not exist sitemap.txt (
    echo Arquivo sitemap.txt nao encontrado na raiz do projeto.
    echo Crie o arquivo sitemap.txt antes de fazer o deploy.
    exit /b 1
)

echo Copiando arquivos do app para public...

if not exist public mkdir public

copy /Y index.html public\ >nul
if errorlevel 1 (
    echo Falha ao copiar index.html.
    exit /b 1
)

copy /Y app.js public\ >nul
if errorlevel 1 (
    echo Falha ao copiar app.js.
    exit /b 1
)

copy /Y i18n.js public\ >nul
if errorlevel 1 (
    echo Falha ao copiar i18n.js.
    exit /b 1
)

copy /Y styles.css public\ >nul
if errorlevel 1 (
    echo Falha ao copiar styles.css.
    exit /b 1
)

copy /Y sitemap.txt public\ >nul
if errorlevel 1 (
    echo Falha ao copiar sitemap.txt.
    exit /b 1
)

copy /Y robots.txt public\ >nul
if errorlevel 1 (
    echo Falha ao copiar robots.txt.
    exit /b 1
)

:: O HTML de verificacao do Search Console precisa continuar publicado: se ele
:: sumir, o Google revalida a propriedade e o site cai do Search Console.
if not exist google*.html (
    echo Arquivo google*.html de verificacao do Search Console nao encontrado na raiz.
    echo Baixe-o novamente no Search Console antes de fazer o deploy.
    exit /b 1
)

copy /Y google*.html public\ >nul
if errorlevel 1 (
    echo Falha ao copiar o HTML de verificacao do Search Console.
    exit /b 1
)

if not exist public\vendor mkdir public\vendor

copy /Y vendor\*.js public\vendor\ >nul
if errorlevel 1 (
    echo Falha ao copiar os arquivos da pasta vendor.
    exit /b 1
)

echo Verificando se o sitemap.xml foi realmente removido...

if exist sitemap.xml (
    echo ERRO: sitemap.xml ainda existe na raiz.
    exit /b 1
)

if exist public\sitemap.xml (
    echo ERRO: public\sitemap.xml ainda existe.
    exit /b 1
)

echo Fazendo deploy no Firebase Hosting...

call firebase deploy --only hosting
if errorlevel 1 (
    echo Deploy falhou.
    exit /b 1
)

echo.
echo Deploy concluido com sucesso.
echo sitemap.xml removido.
echo sitemap.txt publicado.
echo.

endlocal