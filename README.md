# Madeireira Sol Nascente

Aplicativo Electron de gestão operacional. Node.js 22 (>= 22.12.0) e npm são usados para
instalação reproduzível; `package-lock.json` é o lockfile do build e do CI.

## Desenvolvimento e verificação

```sh
npm ci
npm run dev
npm run lint
npm test
```

`npm run electron:dev` abre o Electron com o servidor Vite. As variáveis opcionais
continuam documentadas em `.env.example`. As credenciais Google OAuth continuam
sendo fornecidas pelo ambiente local; não são incluídas no instalador.

## RPM para Fedora (formato principal)

Com Podman instalado, gere o pacote em Fedora 44 sem instalar ferramentas de
compilação no host e sem precisar de sudo:

```sh
npm run dist:rpm:fedora
```

Esse comando instala as dependências com `npm ci`, verifica TypeScript, executa
os testes e gera o RPM em `release/`. Usa um volume anônimo separado para `node_modules` e gera checksum SHA-256 e
metadados da versão. Para build **e** instalação validada: `npm run release:check`.

Para compilar diretamente no Fedora:

```sh
sudo dnf install git nodejs22 nodejs22-npm rpm-build ruby ruby-devel rubygems gcc make
sudo gem install fpm -v 1.18.0 --no-document
npm ci
npm run lint
npm test
npm run dist:rpm
```

O script usa o FPM do sistema (>= 1.18.0): o FPM 1.9 incluído no electron-builder
25 é incompatível com o build root do RPM 6 e depende de `libcrypt.so.1` antiga.
A correção do FPM afeta apenas o empacotamento.
`npm run dist:linux` e `npm run electron:build` também geram RPM.

Instalação no Fedora x86_64:

```sh
rpm_path=$(node scripts/release.cjs path)
sudo dnf install "$rpm_path"
madeireira-sol-nascente
```

O aplicativo também aparece no menu como **Madeireira Sol Nascente**.
Execute-o como usuário comum na sessão gráfica. O DNF resolve as dependências do
sistema. O nome do artefato inclui versão e arquitetura.

## AppImage (fallback opcional)

```sh
npm ci
npm run dist:appimage
chmod +x release/*.AppImage
```

O AppImage é gerado somente quando solicitado por esse comando.

## Validar o RPM instalado

```sh
npm run verify:rpm:fedora
# Ou: bash scripts/verify-rpm-fedora.sh /caminho/pacote-da-versao-atual.rpm
# Mantenha SHA256SUMS e release.json ao lado do RPM, com seu nome original.
```

A validação instala o pacote via DNF em Fedora 44 limpo, verifica bibliotecas e
atalho desktop, e abre o aplicativo como usuário comum em Xvfb, com perfil
separado e sandbox habilitado. Confere Dashboard, imagens, preload Electron e
ausência de exceções no renderer. Evidências ficam em `release/validation/`.
O contêiner é removido ao final. Login real no Firebase/Google Drive não faz
parte desse teste de inicialização.

## Electron 44

Electron atualizado de 33.4.11 para 44.2.0, fixado no `package.json` e no
`package-lock.json`. Use npm para instalar e compilar; `bun.lock` é legado e
não é usado pelo build ou CI.

No Linux, os padrões X11 e GTK 3 foram explicitados para preservar o comportamento
de janela e foco da versão anterior. Flags explícitas continuam tendo prioridade.
As APIs de preload, contextIsolation, IPC, safeStorage e OAuth foram mantidas.
A validação do RPM também verifica a versão do runtime, o isolamento do renderer
e a restauração de sessão por IPC em um perfil temporário sem credenciais.

Referências da revisão: [versões oficiais](https://releases.electronjs.org/) e
[mudanças de APIs do Electron](https://www.electronjs.org/docs/latest/breaking-changes).

## Versionamento, releases e atualização

Consulte [o guia de release](docs/RELEASE.md) para o fluxo SemVer → tag → CI →
GitHub Releases, comandos da próxima versão e atualização explícita via DNF.
O CI instala e valida o RPM em Fedora limpo antes de permitir publicação.
