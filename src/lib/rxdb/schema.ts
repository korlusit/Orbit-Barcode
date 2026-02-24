
export type Product = {
    id: string;
    name: string;
    barcode: string;
    price: number;
    tax_rate: number;
    category: string;
    image_url?: string;
    stock_quantity: number; // For basic inventory tracking
};

export type OrderItem = {
    product_id: string;
    name: string;
    quantity: number;
    price: number;
};

export type Order = {
    id: string;
    items: OrderItem[];
    total: number;
    subtotal: number;
    tax: number;
    status: 'pending' | 'completed' | 'cancelled';
    created_at: number; // Unix timestamp
    payment_method: 'cash' | 'card';
};

export const productSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        name: {
            type: 'string'
        },
        barcode: {
            type: 'string',
            maxLength: 100 // indexable
        },
        price: {
            type: 'number'
        },
        tax_rate: {
            type: 'number'
        },
        category: {
            type: 'string'
        },
        image_url: {
            type: 'string'
        },
        stock_quantity: {
            type: 'number'
        }
    },
    required: ['id', 'name', 'barcode', 'price']
};

export const orderSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    product_id: { type: 'string' },
                    name: { type: 'string' },
                    quantity: { type: 'number' },
                    price: { type: 'number' }
                }
            }
        },
        total: {
            type: 'number'
        },
        subtotal: {
            type: 'number'
        },
        tax: {
            type: 'number'
        },
        status: {
            type: 'string'
        },
        created_at: {
            type: 'number',
            maxLength: 14 // indexable for sorting
        },
        payment_method: {
            type: 'string'
        }
    },
    required: ['id', 'items', 'total', 'status', 'created_at']
};
