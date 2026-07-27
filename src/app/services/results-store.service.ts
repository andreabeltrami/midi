import { Injectable } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { firebaseApp } from '../config/firebase';
import { AuthService } from './auth.service';
import { GameRunRecord } from '../types/game-run-record';

@Injectable({
  providedIn: 'root',
})
export class ResultsStoreService {
  private firestore?: Firestore;

  constructor(private readonly auth: AuthService) {}

  async save(record: GameRunRecord): Promise<void> {
    const user = this.auth.user();
    if (!user) {
      return;
    }

    const { firestore, doc, setDoc } = await this.getFirestore();
    await setDoc(doc(firestore, 'users', user.uid, 'gameRuns', record.id), record);
  }

  async load(): Promise<GameRunRecord[]> {
    const user = this.auth.user();
    if (!user) {
      return [];
    }

    const { firestore, collection, getDocs, limit, orderBy, query } = await this.getFirestore();
    const snapshot = await getDocs(
      query(collection(firestore, 'users', user.uid, 'gameRuns'), orderBy('completedAtIso', 'desc'), limit(500)),
    );

    return snapshot.docs.map((entry) => entry.data() as GameRunRecord);
  }

  private async getFirestore() {
    if (!this.firestore) {
      const { getFirestore } = await import('firebase/firestore');
      this.firestore = getFirestore(firebaseApp);
    }
    const firestore = this.firestore;
    if (!firestore) {
      throw new Error('Firestore initialization failed');
    }

    return {
      firestore,
      ...(await import('firebase/firestore')),
    };
  }
}
