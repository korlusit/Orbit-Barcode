import type { RxCollection } from 'rxdb';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { supabase } from '../supabase';

export const startProductReplication = async (collection: RxCollection) => {
    // "as any" diyerek TypeScript kontrolünü tamamen kapattık.
    return replicateSupabase({
        replicationIdentifier: 'product-sync-v1',
        supabaseClient: supabase,
        collection,
        pull: {
            realtimePostgresChanges: true,
            handler: async (lastCheckpoint: any, batchSize: number) => {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .gt('updated_at', lastCheckpoint?.updated_at || new Date(0).toISOString())
                    .limit(batchSize)
                    .order('updated_at');

                if (error) throw error;

                return {
                    documents: data || [],
                    checkpoint: data.length > 0 ? { updated_at: data[data.length - 1].updated_at } : lastCheckpoint
                };
            }
        },
        push: undefined
    } as any); 
};

export const startOrderReplication = async (collection: RxCollection) => {
    return replicateSupabase({
        replicationIdentifier: 'order-sync-v1',
        supabaseClient: supabase,
        collection,
        pull: undefined,
        push: {
            handler: async (rows: any[]) => {
                const { error } = await supabase.from('orders').upsert(rows.map((r: any) => r.newDocument));
                if (error) throw error;
                return [];
            }
        }
    } as any);
};