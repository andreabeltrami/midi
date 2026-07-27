import { Injectable, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { firebaseApp } from '../config/firebase';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = getAuth(firebaseApp);
  private readonly provider = new GoogleAuthProvider();

  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);
      this.loading.set(false);
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.error.set(false);
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      await signInWithPopup(this.auth, this.provider);
    } catch (error) {
      this.error.set(true);
      console.error(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      this.error.set(true);
      console.error(error);
    }
  }
}
