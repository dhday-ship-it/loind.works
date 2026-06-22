import {initializeApp} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {getAnalytics,isSupported} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {getFirestore} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {getStorage} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
const firebaseConfig={apiKey:"AIzaSyBnJ_bgRb51sUUDlatipuREsfrDcoTQy1U",authDomain:"loind-472cd.firebaseapp.com",projectId:"loind-472cd",storageBucket:"loind-472cd.firebasestorage.app",messagingSenderId:"405998534289",appId:"1:405998534289:web:4c88acf2cf14f36291c930",measurementId:"G-W24XTRX777"};
export const app=initializeApp(firebaseConfig);export const auth=getAuth(app);export const db=getFirestore(app);export const storage=getStorage(app);isSupported().then(v=>v&&getAnalytics(app)).catch(()=>{});
