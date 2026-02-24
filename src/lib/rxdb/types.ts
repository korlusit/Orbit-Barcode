import type { RxDatabase, RxCollection } from 'rxdb';
import type { Product, Order } from './schema';

export type ProductCollection = RxCollection<Product>;
export type OrderCollection = RxCollection<Order>;

export type DatabaseCollections = {
    products: ProductCollection;
    orders: OrderCollection;
};

export type OrbitDatabase = RxDatabase<DatabaseCollections>;