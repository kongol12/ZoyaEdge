import axios from 'axios';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const config = JSON.parse(configStr);

async function run() {
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
  try {
    const res = await axios.get(url);
    console.log("(default) exists:", res.data);
  } catch (e) {
    console.error("(default) error:", e.response?.data || e.message);
  }

  const url2 = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;
  try {
    const res = await axios.get(url2);
    console.log(`${config.firestoreDatabaseId} exists:`, res.data);
  } catch (e) {
    console.error(`${config.firestoreDatabaseId} error:`, e.response?.data || e.message);
  }
  const url3 = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/zoyafx-web-app/documents`;
  try {
    const res = await axios.get(url3);
    console.log(`zoyafx-web-app exists:`, res.data);
  } catch (e) {
    console.error(`zoyafx-web-app error:`, e.response?.data || e.message);
  }
}

run();
