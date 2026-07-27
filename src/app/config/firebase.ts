import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../../environments/environment';

export const firebaseApp = initializeApp(firebaseConfig);
