// Script para resetar o banco de dados
// Execute com: node scripts/reset-database.js

const fs = require('fs');
const path = require('path');

console.log('🗑️  Resetando banco de dados...');

// Caminhos possíveis do banco de dados Expo SQLite
const possiblePaths = [
  // Android
  path.join(process.env.USERPROFILE || process.env.HOME, 'AppData', 'Local', 'Temp', 'ExpoSQLite', 'ebd_insights.db'),
  // iOS Simulator
  path.join(process.env.HOME, 'Library', 'Developer', 'CoreSimulator', 'Devices'),
];

let deleted = false;

// Tentar deletar em todos os caminhos possíveis
possiblePaths.forEach(dbPath => {
  try {
    if (fs.existsSync(dbPath)) {
      if (fs.lstatSync(dbPath).isDirectory()) {
        // Buscar recursivamente em diretórios iOS
        const files = fs.readdirSync(dbPath, { recursive: true });
        files.forEach(file => {
          if (file.includes('ebd_insights.db')) {
            const fullPath = path.join(dbPath, file);
            fs.unlinkSync(fullPath);
            console.log('✅ Banco deletado:', fullPath);
            deleted = true;
          }
        });
      } else {
        fs.unlinkSync(dbPath);
        console.log('✅ Banco deletado:', dbPath);
        deleted = true;
      }
    }
  } catch (error) {
    // Silenciar erros de arquivos não encontrados
  }
});

if (!deleted) {
  console.log('⚠️  Banco não encontrado nos caminhos padrão.');
  console.log('💡 Para deletar manualmente:');
  console.log('   1. Desinstale o app do dispositivo/emulador');
  console.log('   2. Reinstale executando: npm start');
} else {
  console.log('✅ Reset concluído! Execute "npm start" para recriar o banco.');
}
