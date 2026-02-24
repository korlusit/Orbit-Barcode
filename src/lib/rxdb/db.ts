import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { productSchema, orderSchema } from './schema';
import { startProductReplication, startOrderReplication } from './replication';
import type { DatabaseCollections, OrbitDatabase } from './types';

// Pluginleri ekle
if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<OrbitDatabase> | null = null;

const _create = async (): Promise<OrbitDatabase> => {
    console.log('Database creating...');
    
    // Dev modda schema validator ile sar, production'da düz dexie kullan
    const baseStorage = getRxStorageDexie();
    const storage = import.meta.env.DEV
        ? wrappedValidateAjvStorage({ storage: baseStorage })
        : baseStorage;

    const db = await createRxDatabase<DatabaseCollections>({
        name: 'orbitpos_db',
        storage,
        ignoreDuplicate: true
    });

    // Koleksiyonları (Tabloları) ekle
    await db.addCollections({
        products: { schema: productSchema },
        orders: { schema: orderSchema }
    });

    console.log('Collections added. Starting replication...');

    // Replikasyonu başlat (Senkronizasyon)
    // 1. Ürünleri çek
    await startProductReplication(db.products);
    
    // 2. Satışları gönder
    await startOrderReplication(db.orders);

    return db;
};

export const getDatabase = () => {
    if (!dbPromise) dbPromise = _create();
    return dbPromise;
};