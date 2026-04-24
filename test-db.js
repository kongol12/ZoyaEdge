import admin from 'firebase-admin';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const config = JSON.parse(configStr);

admin.initializeApp({
  projectId: config.projectId,
  credential: admin.credential.applicationDefault()
});

async function run() {
  try {
    const db = admin.firestore(admin.app(), config.firestoreDatabaseId);
    await db.collection('_test').limit(1).get();
    console.log(`Successfully connected to ${config.firestoreDatabaseId}!`);
  } catch (e) {
    console.error(`Error connecting to ${config.firestoreDatabaseId}:`, e.message);
  }

  try {
    const dbDefault = admin.firestore(admin.app(), "(default)");
    await dbDefault.collection('_test').limit(1).get();
    console.log(`Successfully connected to (default)!`);
  } catch (e) {
    console.error(`Error connecting to (default):`, e.message);
  }
}

run();
