import { testConnection } from './src/config/database';

async function runTest() {
  console.log('Testing database connection...');
  const isConnected = await testConnection();
  
  if (isConnected) {
    console.log(' Database connection test passed!');
    process.exit(0);
  } else {
    console.error(' Database connection test failed!');
    process.exit(1);
  }
}

runTest().catch(console.error);
