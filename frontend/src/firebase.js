import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase config — these values are public by design (restricted by domain on Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyCU6zW4Fg54oSGcMLBvJ0QT1khxpdobqSE",
  authDomain: "yt-insight-engine.firebaseapp.com",
  projectId: "yt-insight-engine",
  appId: "1:758058962999:web:581daf6ef93e8206482fb2",
  messagingSenderId: "758058962999",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
