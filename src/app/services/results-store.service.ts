import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from '../../environments/environment';
import { GameRunRecord } from '../types/game-run-record';

@Injectable({
  providedIn: 'root',
})
export class ResultsStoreService {
  private readonly app = initializeApp(firebaseConfig);
  private firestore?: Firestore;

  async save(record: GameRunRecord): Promise<void> {
    const { firestore, doc, setDoc } = await this.getFirestore();
    await setDoc(doc(firestore, 'gameRuns', record.id), record);
  }

  async load(): Promise<GameRunRecord[]> {
    const { firestore, collection, getDocs, limit, orderBy, query } = await this.getFirestore();
    const snapshot = await getDocs(
      query(collection(firestore, 'gameRuns'), orderBy('completedAtIso', 'desc'), limit(500)),
    );

    return snapshot.docs.map((entry) => entry.data() as GameRunRecord);
  }

  private async getFirestore() {
    if (!this.firestore) {
      const { getFirestore } = await import('firebase/firestore');
      this.firestore = getFirestore(this.app);
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
