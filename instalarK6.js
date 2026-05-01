const { execSync } = require('child_process');
const os = require('os');

let k6Instalado = false;

try {
    execSync('k6 version', { stdio: 'ignore' });
    console.log('k6 ya está instalado. Omitiendo instalación y continuando con los demás procesos...');
    k6Instalado = true;
} catch (e) {
    console.log('k6 no está instalado. Procediendo con la instalación...');
}

if (!k6Instalado) {
    try {
        switch (os.platform()) {
            case 'win32':
                console.log('Instalando k6 en Windows...');
                execSync('choco install k6 -y', { stdio: 'inherit' });
                break;
            case 'darwin':
                console.log('Instalando k6 en macOS...');
                execSync('brew install k6', { stdio: 'inherit' });
                break;
            case 'linux':
                console.log('Instalando k6 en Linux...');
                execSync('sudo gpg -k', { stdio: 'inherit' });
                execSync('sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69', { stdio: 'inherit' });
                execSync('echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list', { stdio: 'inherit' });
                execSync('sudo apt-get update', { stdio: 'inherit' });
                execSync('sudo apt-get install k6', { stdio: 'inherit' });
                break;
            default:
                console.error('Sistema operativo no compatible para la instalación de k6.');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error durante la instalación de k6:', error);
        process.exit(1);
    }
}
